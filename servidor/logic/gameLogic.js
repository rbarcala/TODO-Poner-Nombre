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

    return Array.from({ length: normalizedCount }, (_, index) => ({ ...normalizedCatalog[index % normalizedCatalog.length] }));
}

export function buildTroopListFromComposition(composicion, troopTypesCatalog = []) {
    if (!Array.isArray(composicion) || composicion.length === 0) return [];

    const catalogMap = new Map((troopTypesCatalog || []).map((t) => [t.id, t]));
    const list = [];

    for (const item of composicion) {
        const cantidad = Number.isInteger(item?.cantidad) && item.cantidad > 0 ? item.cantidad : 0;
        if (cantidad <= 0) continue;

        const catalogEntry = catalogMap.get(item.id_tipo_tropa) || {};
        const unit = {
            id_tipo_tropa: item.id_tipo_tropa,
            tipo: item.tipo || catalogEntry.tipo,
            dado_min: Number.isInteger(item.dado_min) ? item.dado_min : (Number.isInteger(catalogEntry.dado_min) ? catalogEntry.dado_min : 1),
            dado_max: Number.isInteger(item.dado_max) ? item.dado_max : (Number.isInteger(catalogEntry.dado_max) ? catalogEntry.dado_max : 6),
            costo: Number.isInteger(item.costo) ? item.costo : (Number.isInteger(catalogEntry.costo) ? catalogEntry.costo : 1)
        };

        for (let i = 0; i < cantidad; i++) {
            list.push({ ...unit });
        }
    }

    return list;
}

export function summarizeTroopsByType(troopList = []) {
    const summary = new Map();
    for (const unit of troopList) {
        const typeId = unit?.id_tipo_tropa;
        if (!Number.isInteger(typeId)) continue;
        const current = summary.get(typeId);
        if (current) {
            current.cantidad += 1;
        } else {
            summary.set(typeId, {
                id_tipo_tropa: typeId,
                tipo: unit.tipo,
                dado_min: unit.dado_min,
                dado_max: unit.dado_max,
                costo: unit.costo,
                cantidad: 1
            });
        }
    }
    return Array.from(summary.values());
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
    
    // Si el territorio no está ocupado (no hay defensor o tropas defensoras)
    if (!defendingTroops || defendingTroops.length === 0) {
        const attackerSurvivors = attackingTroops.map((t) => ({ ...t }));
        return {
            totalAttack: attackingTroops.length,
            totalDefense: 0,
            attackerWins: true,
            attackRolls: [],
            defenseRolls: [],
            totalAttackBase: 0,
            totalDefenseBase: 0,
            modAttackUsed: 1.0,
            modDefenseUsed: 1.0,
            attackerHasResistance: false,
            defenderHasResistance: false,
            autoConquest: true,
            attackerCasualties: 0,
            defenderCasualties: 0,
            attackerSurvivors,
            defenderSurvivors: [],
            attackerSurvivorComposition: summarizeTroopsByType(attackerSurvivors),
            defenderSurvivorComposition: []
        };
    }

    // 1. Modificadores de terreno
    let modAttack = terrain && typeof terrain.modificador_ataque === 'number' 
        ? terrain.modificador_ataque 
        : (terrain && terrain.modificador_ataque ? parseFloat(terrain.modificador_ataque) : 1.0);
        
    let modDefense = terrain && typeof terrain.modificador_defensa === 'number' 
        ? terrain.modificador_defensa 
        : (terrain && terrain.modificador_defensa ? parseFloat(terrain.modificador_defensa) : 1.0);

    // 2. Chequear resistencias de civilización (si resiste el terreno, ignora penalizaciones < 1.0)
    let attackerHasResistance = false;
    let defenderHasResistance = false;

    if (attackerCountry && terrain && attackerCountry.resistencia_terreno_id === terrain.id) {
        attackerHasResistance = true;
        if (modAttack < 1.0) {
            modAttack = 1.0;
        }
    }

    if (defenderCountry && terrain && defenderCountry.resistencia_terreno_id === terrain.id) {
        defenderHasResistance = true;
        if (modDefense < 1.0) {
            modDefense = 1.0;
        }
    }

    const attackPool = attackingTroops.map((t) => ({ ...t }));
    const defensePool = defendingTroops.map((t) => ({ ...t }));
    const attackRolls = [];
    const defenseRolls = [];
    let totalAttackBase = 0;
    let totalDefenseBase = 0;
    let totalAttack = 0;
    let totalDefense = 0;

    const unitPower = (unit) => {
        const min = Number.isFinite(unit?.dado_min) ? Number(unit.dado_min) : 1;
        const max = Number.isFinite(unit?.dado_max) ? Number(unit.dado_max) : 6;
        return (min + max) / 2;
    };

    while (attackPool.length > 0 && defensePool.length > 0) {
        const roundAttackers = [...attackPool]
            .sort((a, b) => unitPower(b) - unitPower(a))
            .slice(0, Math.min(3, attackPool.length));
        const roundDefenders = [...defensePool]
            .sort((a, b) => unitPower(b) - unitPower(a))
            .slice(0, Math.min(2, defensePool.length));

        const rolledAttackers = roundAttackers
            .map((unit) => {
                const rawRoll = rollDie(unit.dado_min, unit.dado_max);
                const adjustedRoll = Math.round(rawRoll * modAttack);
                attackRolls.push(rawRoll);
                totalAttackBase += rawRoll;
                totalAttack += adjustedRoll;
                return { unit, adjustedRoll };
            })
            .sort((a, b) => b.adjustedRoll - a.adjustedRoll);

        const rolledDefenders = roundDefenders
            .map((unit) => {
                const rawRoll = rollDie(unit.dado_min, unit.dado_max);
                const adjustedRoll = Math.round(rawRoll * modDefense);
                defenseRolls.push(rawRoll);
                totalDefenseBase += rawRoll;
                totalDefense += adjustedRoll;
                return { unit, adjustedRoll };
            })
            .sort((a, b) => b.adjustedRoll - a.adjustedRoll);

        const confrontations = Math.min(rolledAttackers.length, rolledDefenders.length);
        for (let i = 0; i < confrontations; i++) {
            const a = rolledAttackers[i];
            const d = rolledDefenders[i];
            if (a.adjustedRoll > d.adjustedRoll) {
                const deadIndex = defensePool.indexOf(d.unit);
                if (deadIndex >= 0) defensePool.splice(deadIndex, 1);
            } else {
                const deadIndex = attackPool.indexOf(a.unit);
                if (deadIndex >= 0) attackPool.splice(deadIndex, 1);
            }
        }
    }

    const attackerWins = defensePool.length === 0;
    const attackerCasualties = attackingTroops.length - attackPool.length;
    const defenderCasualties = defendingTroops.length - defensePool.length;

    return {
        totalAttack,
        totalDefense,
        attackerWins,
        attackRolls,
        defenseRolls,
        totalAttackBase,
        totalDefenseBase,
        modAttackUsed: modAttack,
        modDefenseUsed: modDefense,
        attackerHasResistance,
        defenderHasResistance,
        attackerCasualties,
        defenderCasualties,
        attackerSurvivors: attackPool,
        defenderSurvivors: defensePool,
        attackerSurvivorComposition: summarizeTroopsByType(attackPool),
        defenderSurvivorComposition: summarizeTroopsByType(defensePool)
    };
}
