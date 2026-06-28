/**
 * Módulo de Gestión de Turnos y Ciclo de Vida del Juego
 */

const { resolveCombat } = require('./gameLogic');
const { getBotDeployment, getBotAttacks } = require('./botLogic');

/**
 * Determina cuál es la siguiente civilización activa en la partida, omitiendo las eliminadas.
 * 
 * @param {Array<Object>} participatingCountries - Lista de países asociados a la partida [{ pais_id, eliminado }]
 * @param {number} activeCountryId - ID de la civilización activa actual
 * @returns {number|null} ID de la siguiente civilización activa, o null si no se puede avanzar.
 */
function getNextActivePlayer(participatingCountries, activeCountryId) {
    if (!participatingCountries || participatingCountries.length === 0) return null;
    
    const activeIndex = participatingCountries.findIndex(p => p.pais_id === activeCountryId);
    if (activeIndex === -1) return participatingCountries[0].pais_id; // Si no se encuentra, inicia el primero

    let nextIndex = (activeIndex + 1) % participatingCountries.length;
    let attempts = 0;

    // Buscar el siguiente bando que no esté eliminado
    while (participatingCountries[nextIndex].eliminado && attempts < participatingCountries.length) {
        nextIndex = (nextIndex + 1) % participatingCountries.length;
        attempts++;
    }

    // Si dimos la vuelta completa y todos están eliminados (caso extremo), retornar null
    if (attempts === participatingCountries.length) {
        return null;
    }

    return participatingCountries[nextIndex].pais_id;
}

/**
 * Verifica si se ha alcanzado una condición de victoria en la partida.
 * La partida termina si todas las civilizaciones participantes menos una han sido eliminadas,
 * o si un único bando posee todos los territorios del mapa.
 * 
 * @param {Array<Object>} territories - Lista de territorios en la partida [{ pais_duenio_id }]
 * @param {Array<Object>} participatingCountries - Lista de países asociados [{ pais_id, eliminado }]
 * @returns {Object} { isGameOver: boolean, winnerCountryId: number|null }
 */
function checkVictoryCondition(territories, participatingCountries) {
    const nonEliminated = participatingCountries.filter(p => !p.eliminado);

    // Condición 1: Solo queda un jugador sin eliminar
    if (nonEliminated.length === 1) {
        return { isGameOver: true, winnerCountryId: nonEliminated[0].pais_id };
    }

    // Condición 2: Un solo bando posee todos los territorios del mapa
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
 * Genera sus refuerzos, decide dónde desplegar, ejecuta ataques automáticos
 * contra sus vecinos, y retorna el log de acciones para que el frontend lo anime.
 * 
 * @param {Object} botCountry - Datos del Bot { id, economia, agresividad, tecnologia, resistencia_terreno_id }
 * @param {Array<Object>} allTerritories - Todos los territorios de la partida en su estado actual
 * @param {Array<Object>} fronteras - Listado de aristas del grafo
 * @param {Array<Object>} participatingCountries - Lista de países de la partida
 * @param {Array<Object>} troopTypesCatalog - Catálogo de tipos de tropas con dados
 * @returns {Object} Resultado del turno { deployments, combatLogs, isGameOver, winnerCountryId, updatedTerritories }
 */
function executeBotTurn(botCountry, allTerritories, fronteras, participatingCountries, troopTypesCatalog) {
    // Clonar los territorios para realizar la simulación en memoria sin mutar los parámetros
    const tempTerritories = JSON.parse(JSON.stringify(allTerritories));
    const botId = botCountry.id;

    // Catálogo indexado para acceso rápido de dados de las tropas
    const troopCatalogMap = new Map(troopTypesCatalog.map(t => [t.id, t]));

    const turnLog = {
        botId: botId,
        deployments: [], // [{ territorio_id, cantidad }]
        combatLogs: [],  // [{ origen_id, destino_id, atacante_dados, defensor_dados, attackerWins, ... }]
        isGameOver: false,
        winnerCountryId: null,
        updatedTerritories: []
    };

    // 1. Fase de Despliegue
    const botTerritories = tempTerritories.filter(t => t.pais_duenio_id === botId);
    if (botTerritories.length === 0) {
        // El bot no tiene territorios (ya fue eliminado de facto)
        return turnLog;
    }

    const deployments = getBotDeployment(botCountry, botTerritories, tempTerritories, fronteras);
    turnLog.deployments = deployments;

    // Aplicar despliegues en el mapa simulado
    for (const dep of deployments) {
        const t = tempTerritories.find(x => x.id === dep.territorio_id);
        if (t) {
            t.tropas_actuales = (t.tropas_actuales || 0) + dep.cantidad;
        }
    }

    // 2. Fase de Ataque
    let attacksRemaining = true;
    let safeguardCounter = 0; // Evitar bucles infinitos en simulación

    while (attacksRemaining && safeguardCounter < 15) {
        safeguardCounter++;
        const currentBotTerritories = tempTerritories.filter(t => t.pais_duenio_id === botId);
        
        // Obtener ataques planificados por la heurística en este ciclo
        const plannedAttacks = getBotAttacks(botCountry, currentBotTerritories, tempTerritories, fronteras);

        if (plannedAttacks.length === 0) {
            attacksRemaining = false;
            break;
        }

        // Ejecutar el ataque prioritario
        const attack = plannedAttacks[0];
        const origin = tempTerritories.find(x => x.id === attack.origen_id);
        const target = tempTerritories.find(x => x.id === attack.destino_id);

        if (!origin || !target) continue;

        // Cargar tropas participantes (simplificado: asumimos tropas genéricas usando el catálogo de dados)
        // En un juego completo, las tropas tendrían sus IDs en tropas_estacionadas.
        // Aquí tomamos tropas ficticias con dados estándar del catálogo para resolver el combate.
        const defaultTroop = troopTypesCatalog[0] || { dado_min: 1, dado_max: 6 };
        
        const attackingTroopsList = Array(attack.tropas_atacantes).fill(defaultTroop);
        const defendingTroopsList = Array(target.tropas_actuales || 1).fill(defaultTroop);

        // Resolvemos el combate
        // Para simplificar, pasamos objetos mínimos de facciones
        const attackerObj = { id: botId, resistencia_terreno_id: botCountry.resistencia_terreno_id };
        const defenderObj = target.pais_duenio_id ? { id: target.pais_duenio_id } : null;
        
        // Terreno ficticio
        const terrainObj = { id: target.tipo_terreno_id, modificador_ataque: 1.0, modificador_defensa: 1.0 };

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
            // Conquista:
            target.pais_duenio_id = botId;
            target.tropas_actuales = attack.tropas_atacantes; // Mueve las tropas al nuevo territorio
            origin.tropas_actuales = 1; // Deja la tropa de resguardo obligatoria en el origen
        } else {
            // Derrota:
            origin.tropas_actuales = 1; // Pierde las tropas enviadas al asalto
        }

        // 3. Evaluar Condición de Victoria tras cada batalla
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

module.exports = {
    getNextActivePlayer,
    checkVictoryCondition,
    executeBotTurn
};
