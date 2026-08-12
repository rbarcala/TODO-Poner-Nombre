/**
 * Módulo de Gestión de Turnos y Ciclo de Vida del Juego
 */

import { resolveCombat, buildTroopList, buildTroopListFromComposition } from './gameLogic.js';
import { getBotDeployment, getBotAttacks } from './botLogic.js';

/**
 * Determina cuál es la siguiente civilización activa en la partida, omitiendo las eliminadas.
 * 
 * @param {Array<Object>} participatingCountries - Lista de países asociados a la partida [{ pais_id, eliminado }]
 * @param {number} activeCountryId - ID de la civilización activa actual
 * @returns {number|null} ID de la siguiente civilización activa, o null si no se puede avanzar.
 */
export function getNextActivePlayer(participatingCountries, activeCountryId) {
    if (!participatingCountries || participatingCountries.length === 0) return null;
    
    const activeIndex = participatingCountries.findIndex(p => (p.pais_id || p.id) === activeCountryId);
    if (activeIndex === -1) return participatingCountries[0].pais_id || participatingCountries[0].id;

    let nextIndex = (activeIndex + 1) % participatingCountries.length;
    let attempts = 0;

    // Buscar el siguiente bando que no esté eliminado
    while (participatingCountries[nextIndex].eliminado && attempts < participatingCountries.length) {
        nextIndex = (nextIndex + 1) % participatingCountries.length;
        attempts++;
    }

    if (attempts === participatingCountries.length) {
        return null;
    }

    return participatingCountries[nextIndex].pais_id || participatingCountries[nextIndex].id;
}

/**
 * Verifica si se ha alcanzado una condición de victoria en la partida.
 * 
 * @param {Array<Object>} territories - Lista de territorios en la partida [{ pais_duenio_id }]
 * @param {Array<Object>} participatingCountries - Lista de países asociados [{ pais_id, eliminado }]
 * @returns {Object} { isGameOver: boolean, winnerCountryId: number|null }
 */
export function checkVictoryCondition(territories, participatingCountries) {
    const nonEliminated = participatingCountries.filter(p => !p.eliminado);

    if (nonEliminated.length === 1) {
        return { isGameOver: true, winnerCountryId: nonEliminated[0].pais_id || nonEliminated[0].id };
    }

    const activeOwners = new Set(
        territories
            .map(t => t.pais_duenio_id)
            .filter(id => id !== null && id !== undefined)
    );

    if (activeOwners.size === 1) {
        const winnerId = Array.from(activeOwners)[0];
        return { isGameOver: true, winnerCountryId: winnerId };
    }

    return { isGameOver: false, winnerCountryId: null };
}

/**
 * Simula y ejecuta de manera completa el turno de un Bot.
 * 
 * @param {Object} botCountry - Datos del Bot { id, economia, agresividad, tecnologia, resistencia_terreno_id }
 * @param {Array<Object>} allTerritories - Todos los territorios de la partida en su estado actual
 * @param {Array<Object>} fronteras - Listado de aristas del grafo
 * @param {Array<Object>} participatingCountries - Lista de países de la partida
 * @param {Array<Object>} troopTypesCatalog - Catálogo de tipos de tropas con dados
 * @returns {Object} Resultado del turno { deployments, combatLogs, isGameOver, winnerCountryId, updatedTerritories }
 */
export function executeBotTurn(botCountry, allTerritories, fronteras, participatingCountries, troopTypesCatalog) {
    const tempTerritories = JSON.parse(JSON.stringify(allTerritories));
    const botId = botCountry.pais_id !== undefined ? botCountry.pais_id : botCountry.id;

    const turnLog = {
        botId: botId,
        deployments: [],
        combatLogs: [],
        isGameOver: false,
        winnerCountryId: null,
        updatedTerritories: []
    };

    let totalActionsExecuted = 0;

    // 1. Fase de Despliegue (Refuerzos)
    const botTerritories = tempTerritories.filter(t => t.pais_duenio_id === botId);
    if (botTerritories.length === 0) {
        return turnLog;
    }

    const deployments = getBotDeployment(botCountry, botTerritories, tempTerritories, fronteras, troopTypesCatalog);
    if (deployments && deployments.length > 0) {
        turnLog.deployments = deployments;
        for (const dep of deployments) {
            const t = tempTerritories.find(x => x.id === dep.territorio_id);
            if (t) {
                // Actualizar composicion_tropas en memoria si existe, además del conteo total
                const composicionActual = Array.isArray(t.composicion_tropas) ? t.composicion_tropas : [];
                if (dep.id_tipo_tropa) {
                    const entrada = composicionActual.find(e => e.id_tipo_tropa === dep.id_tipo_tropa);
                    if (entrada) {
                        entrada.cantidad += dep.cantidad;
                    } else {
                        composicionActual.push({ id_tipo_tropa: dep.id_tipo_tropa, cantidad: dep.cantidad });
                    }
                    t.composicion_tropas = composicionActual;
                }
                t.tropas_actuales = (t.tropas_actuales || 0) + dep.cantidad;
            }
        }
        totalActionsExecuted += 1; // El refuerzo cuenta como 1 acción de turno
    }

    // 2. Fase de Ataque (Movimientos/Combates)
    // El bot realiza ataques con las acciones restantes (máximo 2 acciones totales por turno)
    const maxAttacksAllowed = Math.max(0, 2 - totalActionsExecuted);
    let attacksRemaining = true;
    let attackCounter = 0;

    const totalFromComposition = (comp) => (Array.isArray(comp)
        ? comp.reduce((sum, item) => sum + ((Number.isInteger(item?.cantidad) && item.cantidad > 0) ? item.cantidad : 0), 0)
        : 0);
    const toMap = (comp) => {
        const map = new Map();
        for (const item of (comp || [])) {
            if (!Number.isInteger(item?.id_tipo_tropa)) continue;
            const cantidad = Number.isInteger(item?.cantidad) ? item.cantidad : 0;
            if (cantidad <= 0) continue;
            map.set(item.id_tipo_tropa, (map.get(item.id_tipo_tropa) || 0) + cantidad);
        }
        return map;
    };
    const fromMap = (map) => Array.from(map.entries())
        .filter(([, cantidad]) => cantidad > 0)
        .map(([id_tipo_tropa, cantidad]) => ({ id_tipo_tropa, cantidad }));
    const subtractComp = (base, remove) => {
        const out = toMap(base);
        for (const [idTipo, cant] of toMap(remove).entries()) {
            const restante = (out.get(idTipo) || 0) - cant;
            if (restante > 0) out.set(idTipo, restante);
            else out.delete(idTipo);
        }
        return fromMap(out);
    };

    while (attacksRemaining && attackCounter < maxAttacksAllowed) {
        attackCounter++;
        const currentBotTerritories = tempTerritories.filter(t => t.pais_duenio_id === botId);
        
        const plannedAttacks = getBotAttacks(botCountry, currentBotTerritories, tempTerritories, fronteras);

        if (plannedAttacks.length === 0) {
            attacksRemaining = false;
            break;
        }

        const attack = plannedAttacks[0];
        const origin = tempTerritories.find(x => x.id === attack.origen_id);
        const target = tempTerritories.find(x => x.id === attack.destino_id);

        if (!origin || !target) continue;

        const composicionOrigen = Array.isArray(origin.composicion_tropas) ? origin.composicion_tropas : [];
        const composicionDestino = Array.isArray(target.composicion_tropas) ? target.composicion_tropas : [];
        const totalAtaque = Number.isInteger(attack.tropas_atacantes) ? attack.tropas_atacantes : 0;

        let composicionAtaque = [];
        let restante = totalAtaque;
        for (const entry of composicionOrigen) {
            if (restante <= 0) break;
            const disponibles = Number.isInteger(entry?.cantidad) ? entry.cantidad : 0;
            const tomar = Math.min(disponibles, restante);
            if (tomar > 0) composicionAtaque.push({ id_tipo_tropa: entry.id_tipo_tropa, cantidad: tomar });
            restante -= tomar;
        }
        if (restante > 0) {
            const attackingFallback = buildTroopList(totalAtaque, troopTypesCatalog || []);
            composicionAtaque = [];
            for (const u of attackingFallback) {
                if (!Number.isInteger(u?.id)) continue;
                const existing = composicionAtaque.find((e) => e.id_tipo_tropa === u.id);
                if (existing) existing.cantidad += 1;
                else composicionAtaque.push({ id_tipo_tropa: u.id, cantidad: 1 });
            }
        }

        const attackingTroopsList = buildTroopListFromComposition(composicionAtaque, troopTypesCatalog || []);
        const defendingTroopsList = composicionDestino.length > 0
            ? buildTroopListFromComposition(composicionDestino, troopTypesCatalog || [])
            : buildTroopList(target.tropas_actuales || 1, troopTypesCatalog || []);

        const attackerObj = { id: botId, resistencia_terreno_id: botCountry.resistencia_terreno_id };
        const defenderObj = target.pais_duenio_id ? { id: target.pais_duenio_id } : null;
        
        const terrainObj = { 
            id: target.tipo_terreno_id, 
            modificador_ataque: target.modificador_ataque || 1.0, 
            modificador_defensa: target.modificador_defensa || 1.0 
        };

        const combatResult = resolveCombat(attackerObj, defenderObj, terrainObj, attackingTroopsList, defendingTroopsList);

        const combatLog = {
            origen_id: origin.id,
            destino_id: target.id,
            tropas_atacantes: attack.tropas_atacantes,
            tropas_defensoras: target.tropas_actuales,
            totalAttack: combatResult.totalAttack,
            totalDefense: combatResult.totalDefense,
            attackerWins: combatResult.attackerWins,
            autoConquest: !!combatResult.autoConquest
        };

        turnLog.combatLogs.push(combatLog);

        if (combatResult.attackerWins) {
            target.pais_duenio_id = botId;
            target.composicion_tropas = combatResult.attackerSurvivorComposition || [];
            target.tropas_actuales = totalFromComposition(target.composicion_tropas);
            origin.composicion_tropas = subtractComp(composicionOrigen, composicionAtaque);
            origin.tropas_actuales = totalFromComposition(origin.composicion_tropas);
        } else {
            const perdidasAtacante = subtractComp(composicionAtaque, combatResult.attackerSurvivorComposition || []);
            origin.composicion_tropas = subtractComp(composicionOrigen, perdidasAtacante);
            origin.tropas_actuales = totalFromComposition(origin.composicion_tropas);
            target.composicion_tropas = combatResult.defenderSurvivorComposition || [];
            target.tropas_actuales = totalFromComposition(target.composicion_tropas);
        }

        const victory = checkVictoryCondition(tempTerritories, participatingCountries);
        if (victory.isGameOver) {
            turnLog.isGameOver = true;
            turnLog.winnerCountryId = victory.winnerCountryId;
            attacksRemaining = false;
            break;
        }
    }

    turnLog.updatedTerritories = tempTerritories;
    return turnLog;
}
