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
  resetearMovimientosPartida,
  marcarFortificacionRealizada,
  otorgarPresupuestoFortificacion,
  gastarPresupuestoFortificacion
} from "../bdd/partidas.js";
import { obtenerPaises } from "../bdd/paises.js";
import { obtenerTerrenos } from "../bdd/terrenos.js";
import { obtenerTiposTropas } from "../bdd/tropas.js";

import { generateMap } from "../logic/mapLogic.js";
import { validateDeploymentAction, validateMoveAction } from "../logic/actionValidators.js";
import { calculateEconomyPoints, calculateDeploymentCost, resolveCombat, buildTroopList, buildTroopListFromComposition } from "../logic/gameLogic.js";
import { getNextActivePlayer, checkVictoryCondition, executeBotTurn } from "../logic/turnManager.js";

export const endpointsPartidas = Router();

const totalFromComposition = (composicion) => {
  if (!Array.isArray(composicion)) return 0;
  return composicion.reduce((sum, item) => sum + (Number.isInteger(item?.cantidad) && item.cantidad > 0 ? item.cantidad : 0), 0);
};

const toCompositionMap = (composicion) => {
  const map = new Map();
  for (const item of (composicion || [])) {
    const idTipo = Number(item?.id_tipo_tropa);
    const cantidad = Number.isInteger(item?.cantidad) ? item.cantidad : 0;
    if (!Number.isInteger(idTipo) || cantidad <= 0) continue;
    map.set(idTipo, (map.get(idTipo) || 0) + cantidad);
  }
  return map;
};

const fromCompositionMap = (map) =>
  Array.from(map.entries())
    .filter(([, cantidad]) => cantidad > 0)
    .map(([id_tipo_tropa, cantidad]) => ({ id_tipo_tropa, cantidad }));

const subtractCompositions = (base, remove) => {
  const result = toCompositionMap(base);
  for (const [idTipo, cantidad] of toCompositionMap(remove).entries()) {
    const restante = (result.get(idTipo) || 0) - cantidad;
    if (restante > 0) result.set(idTipo, restante);
    else result.delete(idTipo);
  }
  return fromCompositionMap(result);
};

const addCompositions = (base, add) => {
  const result = toCompositionMap(base);
  for (const [idTipo, cantidad] of toCompositionMap(add).entries()) {
    result.set(idTipo, (result.get(idTipo) || 0) + cantidad);
  }
  return fromCompositionMap(result);
};

const getActionValidationError = (estado) => {
  const partida = estado?.partida;
  if (!partida) return "Estado de partida inválido.";

  if (partida.estado_partida === "finalizada") {
    return "La partida ya está finalizada y no admite nuevas acciones.";
  }

  const turnoActual = partida.turno_actual;
  if (!Number.isInteger(turnoActual)) {
    return "No hay un turno activo válido para realizar acciones.";
  }

  const paisActivoExiste = (estado?.paises || []).some((p) => (p.pais_id || p.id) === turnoActual && !p.eliminado);
  if (!paisActivoExiste) {
    return "El turno activo no corresponde a un país válido.";
  }

  return null;
};

const getEconomyBudgetForCountry = (estado, paisId) => {
  const pais = (estado?.paises || []).find((p) => (p.pais_id || p.id) === paisId);
  if (!pais) return 0;
  return calculateEconomyPoints(pais.economia || 1);
};

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

  const estadoInicial = await obtenerEstadoCompletoPartida(partidaCreada.id);
  if (!estadoInicial) {
    return res.status(500).json({ error: "No se pudo obtener el estado inicial de la partida." });
  }

  const turnoInicial = estadoInicial.partida?.turno_actual;
  if (Number.isInteger(turnoInicial)) {
    const presupuestoInicial = getEconomyBudgetForCountry(estadoInicial, turnoInicial);
    if (presupuestoInicial > 0) {
      await otorgarPresupuestoFortificacion(partidaCreada.id, turnoInicial, presupuestoInicial);
    }
  }

  const estadoCompleto = await obtenerEstadoCompletoPartida(partidaCreada.id);
  res.status(201).json(estadoCompleto);
});

// POST /api/partidas/:id/desplegar - Reforzar tropas en territorio propio
// Body esperado: { territorio_id: number, composicion: [{ id_tipo_tropa: number, cantidad: number }] }
endpointsPartidas.post("/:id/desplegar", async (req, res) => {
  const partidaId = parseInt(req.params.id);
  const { territorio_id, composicion } = req.body;

  const estado = await obtenerEstadoCompletoPartida(partidaId);
  if (!estado) return res.status(404).json({ error: "Partida no encontrada." });
  const actionError = getActionValidationError(estado);
  if (actionError) return res.status(400).json({ error: actionError });

  const movimientosActuales = estado.partida.movimientos_realizados || 0;
  if (movimientosActuales >= 2) {
    return res.status(400).json({ error: "Has alcanzado el límite máximo de 2 acciones por turno. Debes pasar el turno." });
  }

  if (estado.partida.ha_fortificado) {
    return res.status(400).json({ error: "Ya realizaste la acción de fortificar en este turno. Solo se permite una vez por turno." });
  }

  const activePlayerId = estado.partida.turno_actual;
  const paisActivo = estado.paises.find(p => (p.pais_id || p.id) === activePlayerId);
  if (!paisActivo) return res.status(400).json({ error: "No se encontró el país activo." });

  const presupuesto = Number.isInteger(paisActivo.presupuesto_fortificacion)
    ? paisActivo.presupuesto_fortificacion
    : 0;

  const catalogTropas = await obtenerTiposTropas();

  // Validar y normalizar composicion recibida
  if (!Array.isArray(composicion) || composicion.length === 0) {
    return res.status(400).json({ error: "Debes especificar al menos un tipo de tropa para desplegar.", presupuesto_disponible: presupuesto });
  }
  const composicionNormalizada = composicion
    .filter(item => Number.isInteger(item?.id_tipo_tropa) && item.id_tipo_tropa > 0
                 && Number.isInteger(item?.cantidad) && item.cantidad > 0);
  if (composicionNormalizada.length === 0) {
    return res.status(400).json({ error: "La composición de tropas contiene valores inválidos.", presupuesto_disponible: presupuesto });
  }

  // Verificar que todos los tipos existen en el catálogo
  const tiposInvalidos = composicionNormalizada.filter(item =>
    !(catalogTropas || []).some(t => t.id === item.id_tipo_tropa)
  );
  if (tiposInvalidos.length > 0) {
    return res.status(400).json({ error: `Tipos de tropa no existentes: ${tiposInvalidos.map(t => t.id_tipo_tropa).join(', ')}.` });
  }

  // Calcular costo total y validar contra presupuesto
  const costoTotal = calculateDeploymentCost(composicionNormalizada, catalogTropas || []);
  if (costoTotal > presupuesto) {
    return res.status(400).json({
      error: `El costo total de las tropas (${costoTotal}) supera tu presupuesto disponible (${presupuesto}) para este turno.`,
      presupuesto_disponible: presupuesto,
      costo_solicitado: costoTotal
    });
  }

  const territorioTarget = estado.territorios.find(t => t.id === territorio_id);
  if (!territorioTarget) return res.status(400).json({ error: "Territorio no encontrado." });
  if (territorioTarget.pais_duenio_id !== activePlayerId) {
    return res.status(400).json({ error: "No puedes desplegar tropas en un territorio que no te pertenece." });
  }

  // Combinar composición existente del territorio con las nuevas tropas
  const composicionExistente = Array.isArray(territorioTarget.composicion_tropas) ? territorioTarget.composicion_tropas : [];
  const composicionFinal = [...composicionExistente];
  for (const nuevas of composicionNormalizada) {
    const existente = composicionFinal.find(e => e.id_tipo_tropa === nuevas.id_tipo_tropa);
    if (existente) {
      existente.cantidad += nuevas.cantidad;
    } else {
      composicionFinal.push({ id_tipo_tropa: nuevas.id_tipo_tropa, cantidad: nuevas.cantidad });
    }
  }

  await actualizarTerritorio(territorio_id, activePlayerId, composicionFinal, catalogTropas || []);
  const presupuestoActualizado = await gastarPresupuestoFortificacion(partidaId, activePlayerId, costoTotal);
  if (!presupuestoActualizado) {
    return res.status(400).json({ error: "No se pudo debitar el presupuesto de fortificación para esta compra." });
  }
  await marcarFortificacionRealizada(partidaId);
  await incrementarMovimientosPartida(partidaId);

  const estadoActualizado = await obtenerEstadoCompletoPartida(partidaId);
  res.json({
    ...estadoActualizado,
    presupuesto_gastado: costoTotal,
    presupuesto_disponible: Number.isInteger(presupuestoActualizado.presupuesto_fortificacion)
      ? presupuestoActualizado.presupuesto_fortificacion
      : 0
  });
});

// POST /api/partidas/:id/mover - Mover tropas entre territorios propios
// Body soportado:
// - Legacy: { origen_id, destino_id, tropas: number }
// - Composición: { origen_id, destino_id, composicion: [{ id_tipo_tropa, cantidad }] }
endpointsPartidas.post("/:id/mover", async (req, res) => {
  const partidaId = parseInt(req.params.id);
  const { origen_id, destino_id, tropas, composicion } = req.body;

  const estado = await obtenerEstadoCompletoPartida(partidaId);
  if (!estado) return res.status(404).json({ error: "Partida no encontrada" });
  const actionError = getActionValidationError(estado);
  if (actionError) return res.status(400).json({ error: actionError });

  const movimientosActuales = estado.partida.movimientos_realizados || 0;
  if (movimientosActuales >= 2) {
    return res.status(400).json({ error: "Has alcanzado el límite máximo de 2 acciones/movimientos por turno. Debes pasar el turno." });
  }

  const origen = estado.territorios.find(t => t.id === origen_id);
  const destino = estado.territorios.find(t => t.id === destino_id);
  const activePlayerId = estado.partida.turno_actual;
  const moverPorComposicion = Array.isArray(composicion);
  const cantidadAMover = moverPorComposicion ? totalFromComposition(composicion) : tropas;

  const validation = validateMoveAction(activePlayerId, origen, destino, cantidadAMover, estado.fronteras);
  if (!validation.isValid || validation.isAttack) {
    return res.status(400).json({ 
      error: "Movimiento inválido o es un ataque (usa /atacar para batallas).",
      errors: validation.errors 
    });
  }

  const tiposTropa = await obtenerTiposTropas();
  const composicionOrigen = Array.isArray(origen.composicion_tropas) ? origen.composicion_tropas : [];
  const composicionDestino = Array.isArray(destino.composicion_tropas) ? destino.composicion_tropas : [];

  let composicionAMover = [];

  if (moverPorComposicion) {
    composicionAMover = composicion
      .filter((item) => Number.isInteger(item?.id_tipo_tropa) && item.id_tipo_tropa > 0
        && Number.isInteger(item?.cantidad) && item.cantidad > 0)
      .map((item) => ({ id_tipo_tropa: item.id_tipo_tropa, cantidad: item.cantidad }));

    if (composicionAMover.length === 0 || totalFromComposition(composicionAMover) !== cantidadAMover) {
      return res.status(400).json({ error: "La composición solicitada para mover es inválida." });
    }

    for (const item of composicionAMover) {
      const entradaOrigen = composicionOrigen.find((c) => c.id_tipo_tropa === item.id_tipo_tropa);
      const disponibles = Number.isInteger(entradaOrigen?.cantidad) ? entradaOrigen.cantidad : 0;
      if (disponibles < item.cantidad) {
        return res.status(400).json({ error: `No hay suficientes tropas del tipo ${item.id_tipo_tropa} en el territorio origen.` });
      }
    }
  } else {
    let restante = Number.isInteger(cantidadAMover) ? cantidadAMover : 0;
    for (const entry of composicionOrigen) {
      if (restante <= 0) break;
      const disponibles = Number.isInteger(entry?.cantidad) ? entry.cantidad : 0;
      const tomar = Math.min(disponibles, restante);
      if (tomar > 0) composicionAMover.push({ id_tipo_tropa: entry.id_tipo_tropa, cantidad: tomar });
      restante -= tomar;
    }

    if (restante > 0) {
      return res.status(400).json({ error: "No se pudo construir la composición a mover con las tropas disponibles." });
    }
  }

  const composicionOrigenFinal = subtractCompositions(composicionOrigen, composicionAMover);
  const composicionDestinoFinal = addCompositions(composicionDestino, composicionAMover);

  await actualizarTerritorio(origen.id, origen.pais_duenio_id, composicionOrigenFinal, tiposTropa || []);
  await actualizarTerritorio(destino.id, destino.pais_duenio_id, composicionDestinoFinal, tiposTropa || []);

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
  const actionError = getActionValidationError(estado);
  if (actionError) return res.status(400).json({ error: actionError });

  const movimientosActuales = estado.partida.movimientos_realizados || 0;
  if (movimientosActuales >= 2) {
    return res.status(400).json({ error: "Has alcanzado el límite máximo de 2 acciones/movimientos por turno. Debes pasar el turno." });
  }

  const origen = estado.territorios.find(t => t.id === origen_id);
  const destino = estado.territorios.find(t => t.id === destino_id);
  const activePlayerId = estado.partida.turno_actual;
  const ataquePorComposicion = Array.isArray(tropas_atacantes);
  const cantidadAtacante = ataquePorComposicion
    ? totalFromComposition(tropas_atacantes)
    : tropas_atacantes;

  const validation = validateMoveAction(activePlayerId, origen, destino, cantidadAtacante, estado.fronteras);
  if (!validation.isValid) {
    return res.status(400).json({ errors: validation.errors });
  }

  const catalogTropas = await obtenerTiposTropas();
  const composicionOrigen = Array.isArray(origen.composicion_tropas) ? origen.composicion_tropas : [];
  const composicionDestino = Array.isArray(destino.composicion_tropas) ? destino.composicion_tropas : [];
  const totalOrigen = totalFromComposition(composicionOrigen);
  const cantidadAtacanteNormalizada = Number.isInteger(cantidadAtacante) ? cantidadAtacante : 0;

  if (totalOrigen < cantidadAtacanteNormalizada) {
    return res.status(400).json({ error: "No hay tropas suficientes en el territorio origen para ese ataque." });
  }

  let composicionAtaque = [];
  if (ataquePorComposicion) {
    composicionAtaque = tropas_atacantes
      .filter((item) => Number.isInteger(item?.id_tipo_tropa) && Number.isInteger(item?.cantidad) && item.cantidad > 0)
      .map((item) => ({ id_tipo_tropa: item.id_tipo_tropa, cantidad: item.cantidad }));

    if (totalFromComposition(composicionAtaque) !== cantidadAtacanteNormalizada || cantidadAtacanteNormalizada <= 0) {
      return res.status(400).json({ error: "La composición atacante es inválida." });
    }

    for (const item of composicionAtaque) {
      const origenTipo = composicionOrigen.find((c) => c.id_tipo_tropa === item.id_tipo_tropa);
      const disponibles = Number.isInteger(origenTipo?.cantidad) ? origenTipo.cantidad : 0;
      if (disponibles < item.cantidad) {
        return res.status(400).json({ error: `No hay suficientes tropas del tipo ${item.id_tipo_tropa} en el origen.` });
      }
    }
  } else {
    let restante = cantidadAtacanteNormalizada;
    for (const entry of composicionOrigen) {
      if (restante <= 0) break;
      const disponibles = Number.isInteger(entry?.cantidad) ? entry.cantidad : 0;
      const tomar = Math.min(disponibles, restante);
      if (tomar > 0) composicionAtaque.push({ id_tipo_tropa: entry.id_tipo_tropa, cantidad: tomar });
      restante -= tomar;
    }
    if (restante > 0) {
      return res.status(400).json({ error: "No se pudo construir la composición atacante con las tropas disponibles." });
    }
  }

  const attackingTroopsList = buildTroopListFromComposition(composicionAtaque, catalogTropas || []);
  const defendingTroopsList = composicionDestino.length > 0
    ? buildTroopListFromComposition(composicionDestino, catalogTropas || [])
    : buildTroopList(destino.tropas_actuales || 1, catalogTropas || []);

  const attackerState = estado.paises.find((p) => (p.pais_id || p.id) === activePlayerId);
  const defenderState = estado.paises.find((p) => (p.pais_id || p.id) === destino.pais_duenio_id);
  const attackerObj = {
    id: activePlayerId,
    resistencia_terreno_id: Number.isInteger(attackerState?.resistencia_terreno_id)
      ? attackerState.resistencia_terreno_id
      : null
  };
  const defenderObj = destino.pais_duenio_id ? {
    id: destino.pais_duenio_id,
    resistencia_terreno_id: Number.isInteger(defenderState?.resistencia_terreno_id)
      ? defenderState.resistencia_terreno_id
      : null
  } : null;
  const terrainObj = { 
    id: destino.tipo_terreno_id, 
    modificador_ataque: destino.modificador_ataque || 1.0, 
    modificador_defensa: destino.modificador_defensa || 1.0 
  };

  const result = resolveCombat(attackerObj, defenderObj, terrainObj, attackingTroopsList, defendingTroopsList);

  if (result.attackerWins) {
    const composicionOrigenPost = subtractCompositions(composicionOrigen, composicionAtaque);
    await actualizarTerritorio(destino.id, activePlayerId, result.attackerSurvivorComposition || [], catalogTropas || []);
    await actualizarTerritorio(origen.id, activePlayerId, composicionOrigenPost, catalogTropas || []);
  } else {
    const composicionOrigenPost = subtractCompositions(composicionOrigen, result.attackerEliminatedComposition || []);
    await actualizarTerritorio(origen.id, activePlayerId, composicionOrigenPost, catalogTropas || []);
    await actualizarTerritorio(destino.id, destino.pais_duenio_id || null, result.defenderSurvivorComposition || [], catalogTropas || []);
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

  if (estado.partida?.estado_partida === "finalizada") {
    return res.status(400).json({ error: "La partida ya está finalizada y no puede avanzar turnos." });
  }
  if (!Number.isInteger(estado.partida?.turno_actual)) {
    return res.status(400).json({ error: "No hay un turno activo válido para avanzar." });
  }

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
  const presupuestoPrimerTurnoBot = getEconomyBudgetForCountry(estado, siguientePaisId);
  if (presupuestoPrimerTurnoBot > 0) {
    await otorgarPresupuestoFortificacion(partidaId, siguientePaisId, presupuestoPrimerTurnoBot);
  }
  estado = await obtenerEstadoCompletoPartida(partidaId);

  // 2. Bucle secuencial: Mientras el turno actual sea un BOT (distinto del jugador humano), la IA actúa
  while (estado.partida.turno_actual !== humanoPaisId && guardCounter < 10) {
    guardCounter++;

    const botActualObj = estado.paises.find(p => (p.pais_id || p.id) === estado.partida.turno_actual);
    if (!botActualObj) break;

    const botLog = executeBotTurn(botActualObj, estado.territorios, estado.fronteras, estado.paises, catalogTropas || []);

    if (botLog.updatedTerritories) {
      for (const t of botLog.updatedTerritories) {
        // Usar composicion_tropas si está disponible (Feature 1+2), si no caer en tropas_actuales
        const tropasAGuardar = Array.isArray(t.composicion_tropas) && t.composicion_tropas.length > 0
          ? t.composicion_tropas
          : t.tropas_actuales;
        await actualizarTerritorio(t.id, t.pais_duenio_id, tropasAGuardar, catalogTropas || []);
      }
    }

    const costoDespliegueBot = calculateDeploymentCost(
      (botLog.deployments || [])
        .filter((item) => Number.isInteger(item?.id_tipo_tropa) && Number.isInteger(item?.cantidad) && item.cantidad > 0)
        .map((item) => ({ id_tipo_tropa: item.id_tipo_tropa, cantidad: item.cantidad })),
      catalogTropas || []
    );
    if (costoDespliegueBot > 0) {
      await gastarPresupuestoFortificacion(partidaId, botActualObj.pais_id || botActualObj.id, costoDespliegueBot);
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
    if (Number.isInteger(proximoTurno)) {
      const presupuestoNuevoTurno = getEconomyBudgetForCountry(estado, proximoTurno);
      if (presupuestoNuevoTurno > 0) {
        await otorgarPresupuestoFortificacion(partidaId, proximoTurno, presupuestoNuevoTurno);
      }
    }
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
