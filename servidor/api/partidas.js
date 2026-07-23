import { Router } from "express";
import {
  obtenerPartidas,
  obtenerPartida,
  crearPartidaConMapa,
  obtenerEstadoCompletoPartida,
  actualizarTerritorio,
  actualizarEstadoPartida,
  borrarPartida,
  limpiarDatosDePartidas
} from "../bdd/partidas.js";
import { obtenerPaises } from "../bdd/paises.js";
import { obtenerTerrenos } from "../bdd/terrenos.js";
import { obtenerTiposTropas } from "../bdd/tropas.js";

import { generateMap } from "../logic/mapLogic.js";
import { validateDeploymentAction, validateMoveAction } from "../logic/actionValidators.js";
import { resolveCombat, buildTroopList } from "../logic/gameLogic.js";
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

  if (paisesIds.length === 0) {
    const todosPaises = await obtenerPaises();
    if (!todosPaises || todosPaises.length === 0) {
      return res.status(400).json({ error: "No hay países registrados en la base de datos." });
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
  const { territorio_id, cantidad } = req.body;

  const estado = await obtenerEstadoCompletoPartida(partidaId);
  if (!estado) return res.status(404).json({ error: "Partida no encontrada" });

  const territorioTarget = estado.territorios.find(t => t.id === territorio_id);
  if (!territorioTarget) return res.status(400).json({ error: "Territorio no encontrado." });

  const activePlayerId = estado.partida.turno_actual;
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

  const estadoActualizado = await obtenerEstadoCompletoPartida(partidaId);
  res.json(estadoActualizado);
});

// POST /api/partidas/:id/mover - Mover tropas entre territorios propios
endpointsPartidas.post("/:id/mover", async (req, res) => {
  const partidaId = parseInt(req.params.id);
  const { origen_id, destino_id, tropas } = req.body;

  const estado = await obtenerEstadoCompletoPartida(partidaId);
  if (!estado) return res.status(404).json({ error: "Partida no encontrada" });

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

  const estadoActualizado = await obtenerEstadoCompletoPartida(partidaId);
  res.json(estadoActualizado);
});

// POST /api/partidas/:id/atacar - Resolver ataque
endpointsPartidas.post("/:id/atacar", async (req, res) => {
  const partidaId = parseInt(req.params.id);
  const { origen_id, destino_id, tropas_atacantes } = req.body;

  const estado = await obtenerEstadoCompletoPartida(partidaId);
  if (!estado) return res.status(404).json({ error: "Partida no encontrada" });

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

// POST /api/partidas/:id/pasar-turno - Avanzar turno (y ejecutar bot si corresponde)
endpointsPartidas.post("/:id/pasar-turno", async (req, res) => {
  const partidaId = parseInt(req.params.id);

  let estado = await obtenerEstadoCompletoPartida(partidaId);
  if (!estado) return res.status(404).json({ error: "Partida no encontrada" });

  const siguientePaisId = getNextActivePlayer(estado.paises, estado.partida.turno_actual);
  if (!siguientePaisId) {
    return res.status(400).json({ error: "No se pudo determinar el siguiente jugador." });
  }

  await actualizarEstadoPartida(partidaId, siguientePaisId, 'en_curso');
  estado = await obtenerEstadoCompletoPartida(partidaId);

  const paisActivoObj = estado.paises.find(p => p.pais_id === siguientePaisId);
  let botLog = null;

  if (paisActivoObj && paisActivoObj.agresividad > 0) {
    const catalogTropas = await obtenerTiposTropas();
    botLog = executeBotTurn(paisActivoObj, estado.territorios, estado.fronteras, estado.paises, catalogTropas || []);

    if (botLog.updatedTerritories) {
      const catalogTropas = await obtenerTiposTropas();
      for (const t of botLog.updatedTerritories) {
        await actualizarTerritorio(t.id, t.pais_duenio_id, t.tropas_actuales, catalogTropas || []);
      }
    }

    if (botLog.isGameOver) {
      await actualizarEstadoPartida(partidaId, null, 'finalizada', botLog.winnerCountryId);
    } else {
      const proximoPostBot = getNextActivePlayer(estado.paises, siguientePaisId);
      await actualizarEstadoPartida(partidaId, proximoPostBot, 'en_curso');
    }

    estado = await obtenerEstadoCompletoPartida(partidaId);
  }

  res.json({
    siguientePaisId: estado.partida.turno_actual,
    botLog,
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
