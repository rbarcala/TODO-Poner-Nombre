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
 * Calcula la cantidad de tropas de refuerzo para una civilización en su turno.
 * 
 * @param {number} territoriesCount - Cantidad de territorios que posee
 * @param {number} economia - Nivel de economía de la civilización (1 a 10)
 * @returns {number} Cantidad de tropas generadas
 */
export function calculateReinforcements(territoriesCount, economia) {
    const base = Math.max(3, Math.floor(territoriesCount / 3));
    const bonoEconomia = economia || 0;
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
            autoConquest: true
        };
    }

    // 1. Tiradas bases
    const attackRolls = attackingTroops.map(t => rollDie(t.dado_min, t.dado_max));
    const defenseRolls = defendingTroops.map(t => rollDie(t.dado_min, t.dado_max));

    const totalAttackBase = attackRolls.reduce((sum, val) => sum + val, 0);
    const totalDefenseBase = defenseRolls.reduce((sum, val) => sum + val, 0);

    // 2. Modificadores de terreno
    let modAttack = terrain && typeof terrain.modificador_ataque === 'number' 
        ? terrain.modificador_ataque 
        : (terrain && terrain.modificador_ataque ? parseFloat(terrain.modificador_ataque) : 1.0);
        
    let modDefense = terrain && typeof terrain.modificador_defensa === 'number' 
        ? terrain.modificador_defensa 
        : (terrain && terrain.modificador_defensa ? parseFloat(terrain.modificador_defensa) : 1.0);

    // 3. Chequear resistencias de civilización (si resiste el terreno, ignora penalizaciones < 1.0)
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

    // 4. Calcular puntajes finales
    const totalAttack = Math.round(totalAttackBase * modAttack);
    const totalDefense = Math.round(totalDefenseBase * modDefense);

    // El atacante gana si supera la defensa
    const attackerWins = totalAttack > totalDefense;

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
        defenderHasResistance
    };
}
