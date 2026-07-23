/**
 * Módulo de Gestión de Turnos y Ciclo de Vida del Juego
 */

import { resolveCombat } from './gameLogic.js';
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

    const deployments = getBotDeployment(botCountry, botTerritories, tempTerritories, fronteras);
    if (deployments && deployments.length > 0) {
        turnLog.deployments = deployments;
        for (const dep of deployments) {
            const t = tempTerritories.find(x => x.id === dep.territorio_id);
            if (t) {
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

        const defaultTroop = (troopTypesCatalog && troopTypesCatalog.length > 0) 
            ? troopTypesCatalog[0] 
            : { dado_min: 1, dado_max: 6 };
        
        const attackingTroopsList = Array(attack.tropas_atacantes).fill(defaultTroop);
        const defendingTroopsList = Array(target.tropas_actuales || 1).fill(defaultTroop);

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
            target.tropas_actuales = attack.tropas_atacantes;
            origin.tropas_actuales = 1;
        } else {
            origin.tropas_actuales = 1;
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
