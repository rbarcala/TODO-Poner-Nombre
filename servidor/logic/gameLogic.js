/**
 * Módulo de Reglas del Simulador de Guerra y Conquista (Lógica del Sistema de Juego)
 */

/**
 * Determina si dos territorios son adyacentes en base al conjunto de fronteras (aristas del grafo).
 * Las fronteras representan conexiones no dirigidas.
 * 
 * @param {Object} t1 - Territorio origen { id }
 * @param {Object} t2 - Territorio destino { id }
 * @param {Array<Object>} fronteras - Listado de aristas [{ id_territorio_origen, id_territorio_destino }]
 * @returns {boolean} True si hay una frontera/adyacencia entre ambos
 */
export function areAdjacent(t1, t2, fronteras) {
    if (!t1 || !t2 || !fronteras) return false;
    if (t1.id === t2.id) return false;
    
    // Al ser un grafo no dirigido, chequeamos en ambas direcciones
    return fronteras.some(f => 
        (f.id_territorio_origen === t1.id && f.id_territorio_destino === t2.id) ||
        (f.id_territorio_origen === t2.id && f.id_territorio_destino === t1.id)
    );
}

/**
 * Convierte el nivel de economía (1-10) en puntos de presupuesto para la fase de fortificación.
 * Escala definida: 1→1, 2-3→2, 4-5→3, 6-7→4, 8-9→5, 10→6
 *
 * @param {number} economia - Nivel de economía del país (1 a 10)
 * @returns {number} Puntos de presupuesto disponibles para comprar tropas
 */
export function calculateEconomyPoints(economia) {
    const nivel = Math.max(1, Math.min(10, Math.floor(economia) || 1));
    if (nivel === 1)  return 1;
    if (nivel <= 3)   return 2;
    if (nivel <= 5)   return 3;
    if (nivel <= 7)   return 4;
    if (nivel <= 9)   return 5;
    return 6; // nivel 10
}

/**
 * Calcula el costo total de una composición de tropas a desplegar.
 *
 * @param {Array<{id_tipo_tropa: number, cantidad: number}>} composicion - Tropas a desplegar
 * @param {Array<{id: number, costo: number}>} catalogTropas - Catálogo de tipos de tropa con costos
 * @returns {number} Costo total en puntos de economía
 */
export function calculateDeploymentCost(composicion, catalogTropas = []) {
    if (!Array.isArray(composicion) || composicion.length === 0) return 0;
    return composicion.reduce((total, item) => {
        const tipo = (catalogTropas || []).find(t => t.id === item.id_tipo_tropa);
        const costo = (tipo && Number.isInteger(tipo.costo) && tipo.costo > 0) ? tipo.costo : 1;
        const cantidad = (Number.isInteger(item.cantidad) && item.cantidad > 0) ? item.cantidad : 0;
        return total + costo * cantidad;
    }, 0);
}

/**
 * Calcula la cantidad de tropas de refuerzo para una civilización en su turno.
 * Conservado para compatibilidad con el bot. Para el jugador humano se usa calculateEconomyPoints.
 *
 * @param {number} territoriesCount - Cantidad de territorios que posee
 * @param {number} economia - Nivel de economía de la civilización (1 a 10)
 * @returns {number} Cantidad de tropas generadas
 */
export function calculateReinforcements(territoriesCount, economia) {
    const base = Math.max(3, Math.floor(territoriesCount / 3));
    const bonoEconomia = calculateEconomyPoints(economia);
    return base + bonoEconomia;
}

/**
 * Simula el lanzamiento de un dado de N caras.
 * 
 * @param {number} min - Mínimo valor del dado (dado_min)
 * @param {number} max - Máximo valor del dado (dado_max)
 * @returns {number} Resultado del dado
 */
export function rollDie(min, max) {
    const dadoMin = typeof min === 'number' ? min : 1;
    const dadoMax = typeof max === 'number' ? max : 6;
    return Math.floor(Math.random() * (dadoMax - dadoMin + 1)) + dadoMin;
}

export function buildTroopList(count, troopTypesCatalog = []) {
    const normalizedCount = Number.isInteger(count) && count > 0 ? count : 0;
    const normalizedCatalog = (troopTypesCatalog || []).filter(Boolean);

    if (normalizedCount <= 0) return [];
    if (normalizedCatalog.length === 0) {
        return Array(normalizedCount).fill({ dado_min: 1, dado_max: 6 });
    }

    return Array.from({ length: normalizedCount }, (_, index) => normalizedCatalog[index % normalizedCatalog.length]);
}

export function buildTroopListFromComposition(composicion, troopTypesCatalog = []) {
    if (!Array.isArray(composicion) || composicion.length === 0) return [];

    const catalogMap = new Map((troopTypesCatalog || []).map((t) => [t.id, t]));
    const list = [];

    for (const item of composicion) {
        const idTipo = Number(item?.id_tipo_tropa);
        const cantidad = Number.isInteger(item?.cantidad) && item.cantidad > 0 ? item.cantidad : 0;
        if (!Number.isInteger(idTipo) || cantidad <= 0) continue;

        const entry = catalogMap.get(idTipo) || {};
        const unit = {
            id_tipo_tropa: idTipo,
            tipo: item?.tipo || entry.tipo || "Unidad",
            dado_min: Number.isInteger(item?.dado_min) ? item.dado_min : (Number.isInteger(entry.dado_min) ? entry.dado_min : 1),
            dado_max: Number.isInteger(item?.dado_max) ? item.dado_max : (Number.isInteger(entry.dado_max) ? entry.dado_max : 6),
            costo: Number.isInteger(item?.costo) ? item.costo : (Number.isInteger(entry.costo) ? entry.costo : 1)
        };

        for (let i = 0; i < cantidad; i++) {
            list.push({ ...unit });
        }
    }

    return list;
}

export function summarizeTroopsByType(troopList = []) {
    const map = new Map();
    for (const unit of troopList) {
        const idTipo = Number(unit?.id_tipo_tropa);
        if (!Number.isInteger(idTipo)) continue;

        const current = map.get(idTipo);
        if (current) {
            current.cantidad += 1;
        } else {
            map.set(idTipo, {
                id_tipo_tropa: idTipo,
                tipo: unit?.tipo,
                dado_min: unit?.dado_min,
                dado_max: unit?.dado_max,
                costo: Number.isInteger(unit?.costo) ? unit.costo : 1,
                cantidad: 1
            });
        }
    }
    return Array.from(map.values());
}

/**
 * Resuelve un combate entre tropas atacantes y defensoras.
 * 
 * @param {Object} attackerCountry - Civilización atacante { resistencia_terreno_id }
 * @param {Object} defenderCountry - Civilización defensora { resistencia_terreno_id }
 * @param {Object} terrain - Tipo de terreno { id, modificador_ataque, modificador_defensa }
 * @param {Array<Object>} attackingTroops - Lista de tropas atacantes [ { dado_min, dado_max } ]
 * @param {Array<Object>} defendingTroops - Lista de tropas defensoras [ { dado_min, dado_max } ]
 * @returns {Object} Resultado del combate
 */
export function resolveCombat(attackerCountry, defenderCountry, terrain, attackingTroops, defendingTroops) {
    if (attackerCountry && defenderCountry && attackerCountry.id === defenderCountry.id) {
        throw new Error("No puedes atacar un territorio que pertenece a tu misma civilización.");
    }

    if (!attackingTroops || attackingTroops.length === 0) {
        throw new Error("El atacante debe enviar al menos una tropa para el combate.");
    }
    
    const normalizeUnit = (unit, index) => ({
        _order: index,
        id_tipo_tropa: Number(unit?.id_tipo_tropa),
        tipo: unit?.tipo || "Unidad",
        dado_min: Number.isInteger(unit?.dado_min) ? unit.dado_min : 1,
        dado_max: Number.isInteger(unit?.dado_max) ? unit.dado_max : 6,
        costo: Number.isInteger(unit?.costo) ? unit.costo : 1
    });

    const withRoll = (unit) => ({
        ...unit,
        dado_resultado: rollDie(unit.dado_min, unit.dado_max)
    });

    const splitByCasualties = (rolledUnits, casualties) => {
        const sorted = [...rolledUnits].sort((a, b) => {
            if (a.dado_resultado !== b.dado_resultado) return a.dado_resultado - b.dado_resultado;
            if (a.costo !== b.costo) return a.costo - b.costo;
            return a._order - b._order;
        });
        const dead = sorted.slice(0, casualties);
        const deadSet = new Set(dead.map((u) => u._order));
        const survivors = rolledUnits.filter((u) => !deadSet.has(u._order));
        return { dead, survivors };
    };

    const stripMeta = (units) => units.map((u) => ({
        id_tipo_tropa: Number.isInteger(u.id_tipo_tropa) ? u.id_tipo_tropa : undefined,
        tipo: u.tipo,
        dado_min: u.dado_min,
        dado_max: u.dado_max,
        costo: u.costo,
        dado_resultado: u.dado_resultado
    }));

    const toPositiveNumber = (value, fallback = 1) => {
        const num = Number(value);
        if (!Number.isFinite(num) || num <= 0) return fallback;
        return num;
    };

    const hasTerrainResistance = (countryObj, terrainObj) =>
        Number.isInteger(countryObj?.resistencia_terreno_id) &&
        Number.isInteger(terrainObj?.id) &&
        countryObj.resistencia_terreno_id === terrainObj.id;

    const resolveModifier = (baseModifier, hasResistance) => {
        const normalizedBase = toPositiveNumber(baseModifier, 1);
        if (!hasResistance) return normalizedBase;
        return Math.max(1, normalizedBase);
    };

    const roundScore = (value) => Math.max(0, Math.round(value * 100) / 100);

    const preparedAttackers = attackingTroops.map(normalizeUnit).map(withRoll);
    const preparedDefenders = (defendingTroops || []).map(normalizeUnit).map(withRoll);

    const attackRolls = preparedAttackers.map((u) => u.dado_resultado);
    const defenseRolls = preparedDefenders.map((u) => u.dado_resultado);
    const totalAttackBase = attackRolls.reduce((sum, val) => sum + val, 0);
    const totalDefenseBase = defenseRolls.reduce((sum, val) => sum + val, 0);
    const attackerHasResistance = hasTerrainResistance(attackerCountry, terrain);
    const defenderHasResistance = hasTerrainResistance(defenderCountry, terrain);
    const modAttackUsed = resolveModifier(terrain?.modificador_ataque, attackerHasResistance);
    const modDefenseUsed = resolveModifier(terrain?.modificador_defensa, defenderHasResistance);
    const totalAttack = roundScore(totalAttackBase * modAttackUsed);
    const totalDefense = roundScore(totalDefenseBase * modDefenseUsed);

    const autoConquest = preparedDefenders.length === 0;
    const attackerWins = autoConquest || totalAttack > totalDefense;
    const isTie = !autoConquest && totalAttack === totalDefense;
    const defenderWins = !autoConquest && totalDefense > totalAttack;

    let attackerDead = [];
    let defenderDead = [];
    let attackerSurvivors = [...preparedAttackers];
    let defenderSurvivors = [...preparedDefenders];

    if (attackerWins) {
        defenderDead = [...preparedDefenders];
        defenderSurvivors = [];
    } else if (defenderWins) {
        const attackerLosses = Math.floor(preparedAttackers.length / 2);
        const split = splitByCasualties(preparedAttackers, attackerLosses);
        attackerDead = split.dead;
        attackerSurvivors = split.survivors;
    } else if (isTie) {
        const attackerLosses = Math.floor(preparedAttackers.length / 2);
        const defenderLosses = Math.floor(preparedDefenders.length / 2);
        const splitAtk = splitByCasualties(preparedAttackers, attackerLosses);
        const splitDef = splitByCasualties(preparedDefenders, defenderLosses);
        attackerDead = splitAtk.dead;
        defenderDead = splitDef.dead;
        attackerSurvivors = splitAtk.survivors;
        defenderSurvivors = splitDef.survivors;
    }

    const attackerSurvivorUnits = stripMeta(attackerSurvivors);
    const defenderSurvivorUnits = stripMeta(defenderSurvivors);
    const attackerEliminatedUnits = stripMeta(attackerDead);
    const defenderEliminatedUnits = stripMeta(defenderDead);

    return {
        totalAttack,
        totalDefense,
        attackerWins,
        defenderWins,
        isTie,
        autoConquest,
        territoryConquered: attackerWins,
        attackRolls,
        defenseRolls,
        attackerUnitsRolled: stripMeta(preparedAttackers),
        defenderUnitsRolled: stripMeta(preparedDefenders),
        attackerCasualties: attackerDead.length,
        defenderCasualties: defenderDead.length,
        attackerEliminatedUnits,
        defenderEliminatedUnits,
        attackerSurvivorUnits,
        defenderSurvivorUnits,
        attackerSurvivorComposition: summarizeTroopsByType(attackerSurvivorUnits),
        defenderSurvivorComposition: summarizeTroopsByType(defenderSurvivorUnits),
        attackerEliminatedComposition: summarizeTroopsByType(attackerEliminatedUnits),
        defenderEliminatedComposition: summarizeTroopsByType(defenderEliminatedUnits),
        modAttackUsed,
        modDefenseUsed,
        attackerHasResistance,
        defenderHasResistance,
        totalAttackBase,
        totalDefenseBase
    };
}
