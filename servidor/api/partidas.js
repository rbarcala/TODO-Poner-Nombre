import { Router } from "express";
import {
  obtenerPartidas,
  obtenerPartida,
  crearPartidaConMapa,
  obtenerEstadoCompletoPartida,
  actualizarTerritorio,
  actualizarEstadoPartida,
  borrarPartida,
  limpiarDatosDePartidas,
  incrementarMovimientosPartida,
  resetearMovimientosPartida
} from "../bdd/partidas.js";
import { obtenerPaises } from "../bdd/paises.js";
import { obtenerTerrenos } from "../bdd/terrenos.js";
import { obtenerTiposTropas } from "../bdd/tropas.js";

import { generateMap } from "../logic/mapLogic.js";
import { validateDeploymentAction, validateMoveAction } from "../logic/actionValidators.js";
import { calculateReinforcements, resolveCombat, buildTroopList } from "../logic/gameLogic.js";
import { getNextActivePlayer, checkVictoryCondition, executeBotTurn } from "../logic/turnManager.js";

export const endpointsPartidas = Router();

// GET /api/partidas - Listar partidas
endpointsPartidas.get("/", async (req, res) => {
  const partidas = await obtenerPartidas();
  if (!partidas) return res.status(500).json({ error: "Error al obtener partidas" });
  res.json(partidas);
});

// DELETE /api/partidas - Limpiar datos de juego, conservando catalogos
endpointsPartidas.delete("/", async (req, res) => {
  const eliminados = await limpiarDatosDePartidas();
  if (!eliminados) {
    return res.status(500).json({ error: "No se pudieron limpiar los datos de partidas" });
  }

  res.json({
    message: "Datos de partidas limpiados correctamente",
    eliminados,
  });
});

// GET /api/partidas/:id/estado - Estado completo del mapa y la partida
endpointsPartidas.get("/:id/estado", async (req, res) => {
  const id = parseInt(req.params.id);
  const estadoCompleto = await obtenerEstadoCompletoPartida(id);
  if (!estadoCompleto) return res.status(404).json({ error: "Partida no encontrada" });
  res.json(estadoCompleto);
});

// POST /api/partidas - Crear nueva partida generando mapa
endpointsPartidas.post("/", async (req, res) => {
  const { nombre, paises_ids, filas, columnas } = req.body;

  let paisesIds = Array.isArray(paises_ids)
    ? paises_ids.filter((id) => Number.isInteger(Number(id)) && Number(id) > 0).map((id) => Number(id))
    : [];

  if (paisesIds.length < 2) {
    const todosPaises = await obtenerPaises();
    if (!todosPaises || todosPaises.length < 2) {
      return res.status(400).json({ error: "Se necesitan al menos 2 países registrados en la base de datos." });
    }
    paisesIds = todosPaises.slice(0, 4).map((p) => p.id);
  }

  if (paisesIds.length > 4) {
    paisesIds = paisesIds.slice(0, 4);
  }

  const terrenosCat = await obtenerTerrenos();
  const terrenosIds = (terrenosCat && terrenosCat.length > 0)
    ? terrenosCat.map((t) => t.id)
    : [1];

  const tiposTropa = await obtenerTiposTropas();
  const numFilas = Number.isInteger(filas) && filas >= 2 ? filas : undefined;
  const numColumnas = Number.isInteger(columnas) && columnas >= 2 ? columnas : undefined;
  const mapaGenerado = generateMap(numFilas, numColumnas, paisesIds, terrenosIds);

  const partidaCreada = await crearPartidaConMapa(nombre, paisesIds, mapaGenerado, tiposTropa || []);

  if (!partidaCreada) {
    return res.status(500).json({ error: "Error al crear la partida en base de datos." });
  }

  const estadoCompleto = await obtenerEstadoCompletoPartida(partidaCreada.id);
  res.status(201).json(estadoCompleto);
});

// POST /api/partidas/:id/desplegar - Reforzar tropas en territorio propio
endpointsPartidas.post("/:id/desplegar", async (req, res) => {
  const partidaId = parseInt(req.params.id);
  //const { territorio_id, cantidad } = req.body;
  const { territorio_id } = req.body;

  const estado = await obtenerEstadoCompletoPartida(partidaId);
  const movimientosActuales = estado.partida.movimientos_realizados || 0;
  if (movimientosActuales >= 2) {
    return res.status(400).json({ error: "Has alcanzado el límite máximo de 2 acciones por turno. Debes pasar el turno." });
  }

  const activePlayerId = estado.partida.turno_actual;

  const territoriesCount = estado.territorios.filter(t => t.pais_duenio_id === activePlayerId).length;
  const paisActivo = estado.paises.find(p => p.id === activePlayerId);
  const economia = paisActivo ? paisActivo.economia : 0;
  const cantidad = calculateReinforcements(territoriesCount, economia);

  const territorioTarget = estado.territorios.find(t => t.id === territorio_id);
  if (!territorioTarget) return res.status(400).json({ error: "Territorio no encontrado." });

  const validation = validateDeploymentAction(
    activePlayerId,
    estado.territorios,
    [{ territorio_id, cantidad }],
    999
  );
  if (!validation.isValid) {
    return res.status(400).json({ errors: validation.errors });
  }
  const tiposTropa = await obtenerTiposTropas();
  const nuevasTropas = (territorioTarget.tropas_actuales || 1) + cantidad;
  await actualizarTerritorio(territorio_id, territorioTarget.pais_duenio_id, nuevasTropas, tiposTropa || []);

  await incrementarMovimientosPartida(partidaId);

  const estadoActualizado = await obtenerEstadoCompletoPartida(partidaId);
  res.json(estadoActualizado);
});

// POST /api/partidas/:id/mover - Mover tropas entre territorios propios
endpointsPartidas.post("/:id/mover", async (req, res) => {
  const partidaId = parseInt(req.params.id);
  const { origen_id, destino_id, tropas } = req.body;

  const estado = await obtenerEstadoCompletoPartida(partidaId);
  if (!estado) return res.status(404).json({ error: "Partida no encontrada" });

  const movimientosActuales = estado.partida.movimientos_realizados || 0;
  if (movimientosActuales >= 2) {
    return res.status(400).json({ error: "Has alcanzado el límite máximo de 2 acciones/movimientos por turno. Debes pasar el turno." });
  }

  const origen = estado.territorios.find(t => t.id === origen_id);
  const destino = estado.territorios.find(t => t.id === destino_id);
  const activePlayerId = estado.partida.turno_actual;

  const validation = validateMoveAction(activePlayerId, origen, destino, tropas, estado.fronteras);
  if (!validation.isValid || validation.isAttack) {
    return res.status(400).json({ 
      error: "Movimiento inválido o es un ataque (usa /atacar para batallas).",
      errors: validation.errors 
    });
  }

  const tiposTropa = await obtenerTiposTropas();
  await actualizarTerritorio(origen.id, origen.pais_duenio_id, origen.tropas_actuales - tropas, tiposTropa || []);
  await actualizarTerritorio(destino.id, destino.pais_duenio_id, destino.tropas_actuales + tropas, tiposTropa || []);

  await incrementarMovimientosPartida(partidaId);

  const estadoActualizado = await obtenerEstadoCompletoPartida(partidaId);
  res.json(estadoActualizado);
});

// POST /api/partidas/:id/atacar - Resolver ataque
endpointsPartidas.post("/:id/atacar", async (req, res) => {
  const partidaId = parseInt(req.params.id);
  const { origen_id, destino_id, tropas_atacantes } = req.body;

  const estado = await obtenerEstadoCompletoPartida(partidaId);
  if (!estado) return res.status(404).json({ error: "Partida no encontrada" });

  const movimientosActuales = estado.partida.movimientos_realizados || 0;
  if (movimientosActuales >= 2) {
    return res.status(400).json({ error: "Has alcanzado el límite máximo de 2 acciones/movimientos por turno. Debes pasar el turno." });
  }

  const origen = estado.territorios.find(t => t.id === origen_id);
  const destino = estado.territorios.find(t => t.id === destino_id);
  const activePlayerId = estado.partida.turno_actual;

  const validation = validateMoveAction(activePlayerId, origen, destino, tropas_atacantes, estado.fronteras);
  if (!validation.isValid) {
    return res.status(400).json({ errors: validation.errors });
  }

  const catalogTropas = await obtenerTiposTropas();
  const attackingTroopsList = buildTroopList(tropas_atacantes, catalogTropas || []);
  const defendingTroopsList = buildTroopList(destino.tropas_actuales || 1, catalogTropas || []);

  const attackerObj = { id: activePlayerId, resistencia_terreno_id: null };
  const defenderObj = destino.pais_duenio_id ? { id: destino.pais_duenio_id } : null;
  const terrainObj = { 
    id: destino.tipo_terreno_id, 
    modificador_ataque: destino.modificador_ataque || 1.0, 
    modificador_defensa: destino.modificador_defensa || 1.0 
  };

  const result = resolveCombat(attackerObj, defenderObj, terrainObj, attackingTroopsList, defendingTroopsList);

  if (result.attackerWins) {
    await actualizarTerritorio(destino.id, activePlayerId, tropas_atacantes, catalogTropas || []);
    await actualizarTerritorio(origen.id, activePlayerId, origen.tropas_actuales - tropas_atacantes, catalogTropas || []);
  } else {
    await actualizarTerritorio(origen.id, activePlayerId, origen.tropas_actuales - tropas_atacantes, catalogTropas || []);
  }

  await incrementarMovimientosPartida(partidaId);

  const estadoPostCombate = await obtenerEstadoCompletoPartida(partidaId);

  const victory = checkVictoryCondition(estadoPostCombate.territorios, estadoPostCombate.paises);
  if (victory.isGameOver) {
    await actualizarEstadoPartida(partidaId, null, 'finalizada', victory.winnerCountryId);
  }

  const estadoFinal = await obtenerEstadoCompletoPartida(partidaId);
  res.json({
    combatResult: result,
    victory,
    estado: estadoFinal
  });
});

// POST /api/partidas/:id/pasar-turno - Avanzar turno secuencialmente por todas las IAs hasta volver al jugador humano
endpointsPartidas.post("/:id/pasar-turno", async (req, res) => {
  const partidaId = parseInt(req.params.id);

  let estado = await obtenerEstadoCompletoPartida(partidaId);
  if (!estado) return res.status(404).json({ error: "Partida no encontrada" });

  const humanoPaisId = estado.paises[0]?.pais_id || estado.paises[0]?.id;
  const catalogTropas = await obtenerTiposTropas();
  const botLogs = [];
  let guardCounter = 0;

  // 1. Avanzar turno inicial desde el jugador humano al primer bot
  let siguientePaisId = getNextActivePlayer(estado.paises, estado.partida.turno_actual);
  if (!siguientePaisId) {
    return res.status(400).json({ error: "No se pudo determinar el siguiente jugador." });
  }

  await actualizarEstadoPartida(partidaId, siguientePaisId, 'en_curso');
  estado = await obtenerEstadoCompletoPartida(partidaId);

  // 2. Bucle secuencial: Mientras el turno actual sea un BOT (distinto del jugador humano), la IA actúa
  while (estado.partida.turno_actual !== humanoPaisId && guardCounter < 10) {
    guardCounter++;

    const botActualObj = estado.paises.find(p => (p.pais_id || p.id) === estado.partida.turno_actual);
    if (!botActualObj) break;

    const botLog = executeBotTurn(botActualObj, estado.territorios, estado.fronteras, estado.paises, catalogTropas || []);

    if (botLog.updatedTerritories) {
      for (const t of botLog.updatedTerritories) {
        await actualizarTerritorio(t.id, t.pais_duenio_id, t.tropas_actuales, catalogTropas || []);
      }
    }

    botLogs.push({
      botId: botActualObj.pais_id || botActualObj.id,
      botNombre: botActualObj.nombre || `Bot #${botActualObj.pais_id || botActualObj.id}`,
      deployments: botLog.deployments || [],
      combats: botLog.combatLogs || []
    });

    if (botLog.isGameOver) {
      await actualizarEstadoPartida(partidaId, null, 'finalizada', botLog.winnerCountryId);
      estado = await obtenerEstadoCompletoPartida(partidaId);
      break;
    }

    const proximoTurno = getNextActivePlayer(estado.paises, estado.partida.turno_actual);
    await actualizarEstadoPartida(partidaId, proximoTurno, 'en_curso');
    estado = await obtenerEstadoCompletoPartida(partidaId);
  }

  await resetearMovimientosPartida(partidaId);
  estado = await obtenerEstadoCompletoPartida(partidaId);

  res.json({
    siguientePaisId: estado.partida.turno_actual,
    botLogs,
    estado
  });
});

// DELETE /api/partidas/:id - Eliminar partida
endpointsPartidas.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const eliminada = await borrarPartida(id);
  if (!eliminada) return res.status(404).json({ error: "Partida no encontrada o no se pudo eliminar" });
  res.json({ message: "Partida eliminada correctamente", id });
});
