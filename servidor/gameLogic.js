/**
 * Módulo de Lógica del Simulador de Guerra y Conquista (Grafo de Territorios)
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
function areAdjacent(t1, t2, fronteras) {
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
function calculateReinforcements(territoriesCount, economia) {
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
function rollDie(min, max) {
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
function resolveCombat(attackerCountry, defenderCountry, terrain, attackingTroops, defendingTroops) {
    if (!attackingTroops || attackingTroops.length === 0) {
        throw new Error("El atacante debe enviar al menos una tropa para el combate.");
    }
    if (!defendingTroops || defendingTroops.length === 0) {
        throw new Error("El defensor debe tener al menos una tropa estacionada.");
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

/**
 * Determina dónde debe desplegar el Bot sus tropas de refuerzo.
 * 
 * @param {Object} botCountry - Facción del bot { id, economia, agresividad }
 * @param {Array<Object>} botTerritories - Territorios propiedad del bot
 * @param {Array<Object>} allTerritories - Todos los territorios en la partida
 * @param {Array<Object>} fronteras - Listado de aristas del grafo
 * @returns {Array<Object>} Despliegues decididos [ { territorio_id, cantidad } ]
 */
function getBotDeployment(botCountry, botTerritories, allTerritories, fronteras) {
    const reinforcements = calculateReinforcements(botTerritories.length, botCountry.economia);
    const deployments = [];

    if (botTerritories.length === 0) return deployments;

    // 1. Identificar territorios en la frontera con enemigos/neutrales
    const borderTerritories = [];
    for (const t of botTerritories) {
        const hasEnemyNeighbor = allTerritories.some(other => 
            other.pais_duenio_id !== botCountry.id && 
            areAdjacent(t, other, fronteras)
        );
        if (hasEnemyNeighbor) {
            borderTerritories.push(t);
        }
    }

    // Si no hay fronteras (caso raro o juego ganado), desplegar todo en el primer territorio
    if (borderTerritories.length === 0) {
        deployments.push({ territorio_id: botTerritories[0].id, cantidad: reinforcements });
        return deployments;
    }

    const aggressiveness = botCountry.agresividad || 5;

    if (aggressiveness >= 7) {
        // --- BOT AGRESIVO ---
        // Concentra el 80% en el territorio que colinda con el vecino enemigo más débil (para preparar ataque)
        let primaryTarget = borderTerritories[0];
        let minEnemyTroops = Infinity;

        for (const t of borderTerritories) {
            const neighbors = allTerritories.filter(other => 
                other.pais_duenio_id !== botCountry.id && 
                areAdjacent(t, other, fronteras)
            );
            for (const n of neighbors) {
                const troops = n.tropas_actuales || 0;
                if (troops < minEnemyTroops) {
                    minEnemyTroops = troops;
                    primaryTarget = t;
                }
            }
        }

        const primaryQty = Math.floor(reinforcements * 0.8);
        const secondaryQty = reinforcements - primaryQty;

        if (primaryQty > 0) {
            deployments.push({ territorio_id: primaryTarget.id, cantidad: primaryQty });
        }

        if (secondaryQty > 0) {
            // Distribuir el resto entre los otros territorios de frontera
            const otherBorders = borderTerritories.filter(t => t.id !== primaryTarget.id);
            if (otherBorders.length > 0) {
                const qtyPerBorder = Math.floor(secondaryQty / otherBorders.length);
                let remainder = secondaryQty % otherBorders.length;
                
                for (const t of otherBorders) {
                    const qty = qtyPerBorder + (remainder > 0 ? 1 : 0);
                    if (qty > 0) {
                        deployments.push({ territorio_id: t.id, cantidad: qty });
                    }
                    if (remainder > 0) remainder--;
                }
            } else {
                // Si solo hay una frontera, poner todo ahí
                if (deployments.length > 0) {
                    deployments[0].cantidad += secondaryQty;
                } else {
                    deployments.push({ territorio_id: primaryTarget.id, cantidad: secondaryQty });
                }
            }
        }
    } else {
        // --- BOT DEFENSIVO / EQUILIBRADO ---
        // Distribuye proporcionalmente al tamaño de los ejércitos enemigos adyacentes (amenaza)
        const threats = borderTerritories.map(t => {
            const neighbors = allTerritories.filter(other => 
                other.pais_duenio_id !== botCountry.id && 
                areAdjacent(t, other, fronteras)
            );
            const enemyTroopsTotal = neighbors.reduce((sum, n) => sum + (n.tropas_actuales || 0), 0);
            return { territorio_id: t.id, threat: enemyTroopsTotal };
        });

        const totalThreat = threats.reduce((sum, item) => sum + item.threat, 0) || 1;
        let deployedSum = 0;

        threats.forEach((th, index) => {
            let qty = Math.floor((th.threat / totalThreat) * reinforcements);
            
            // Ajustar residuo en el último elemento
            if (index === threats.length - 1) {
                qty = reinforcements - deployedSum;
            }
            
            if (qty > 0) {
                deployments.push({ territorio_id: th.territorio_id, cantidad: qty });
                deployedSum += qty;
            }
        });
    }

    return deployments;
}

/**
 * Determina qué ataques realizará el Bot durante su turno.
 * El Bot evalúa los territorios enemigos limítrofes y ataca si la relación de fuerzas supera su umbral.
 * 
 * @param {Object} botCountry - Facción del bot { id, agresividad, tecnologia }
 * @param {Array<Object>} botTerritories - Territorios del bot (con tropas ya actualizadas por despliegue)
 * @param {Array<Object>} allTerritories - Todos los territorios de la partida
 * @param {Array<Object>} fronteras - Listado de aristas del grafo
 * @returns {Array<Object>} Lista de ataques a ejecutar [ { origen_id, destino_id, tropas_atacantes } ]
 */
function getBotAttacks(botCountry, botTerritories, allTerritories, fronteras) {
    const attacks = [];
    const aggressiveness = botCountry.agresividad || 5;

    // Determinar umbral de ratio (Mis tropas / Tropas enemigo)
    let ratioThreshold = 1.5; // Moderado
    if (aggressiveness >= 8) {
        ratioThreshold = 1.2; // Muy agresivo (arriesgado)
    } else if (aggressiveness <= 3) {
        ratioThreshold = 2.0; // Muy conservador (solo victorias casi seguras)
    }

    // Copia temporal de tropas locales para evitar ataques simultáneos imposibles en el mismo ciclo
    const localTroopStats = {};
    for (const t of botTerritories) {
        localTroopStats[t.id] = t.tropas_actuales || 0;
    }

    // Buscar opciones de ataque
    for (const t of botTerritories) {
        // Para poder atacar, se necesita al menos 2 tropas en el origen (1 para atacar y 1 que debe quedarse)
        if (localTroopStats[t.id] < 2) continue;

        const enemyNeighbors = allTerritories.filter(other => 
            other.pais_duenio_id !== botCountry.id && 
            areAdjacent(t, other, fronteras)
        );

        if (enemyNeighbors.length === 0) continue;

        // Evaluar candidatos
        const candidates = [];
        for (const enemy of enemyNeighbors) {
            const myAttackingTroops = localTroopStats[t.id] - 1;
            const enemyDefendingTroops = enemy.tropas_actuales || 0;
            const ratio = myAttackingTroops / (enemyDefendingTroops || 1);

            if (ratio >= ratioThreshold) {
                candidates.push({
                    origen_id: t.id,
                    destino_id: enemy.id,
                    tropas_atacantes: myAttackingTroops,
                    ratio: ratio,
                    resistenciaTerreno: botCountry.resistencia_terreno_id === enemy.tipo_terreno_id
                });
            }
        }

        if (candidates.length === 0) continue;

        // Priorizar candidatos:
        // 1. Si posee resistencia al terreno del enemigo (mayor probabilidad de éxito real)
        // 2. Por el mejor ratio de fuerzas
        candidates.sort((a, b) => {
            if (a.resistenciaTerreno && !b.resistenciaTerreno) return -1;
            if (!a.resistenciaTerreno && b.resistenciaTerreno) return 1;
            return b.ratio - a.ratio;
        });

        const chosenAttack = candidates[0];
        attacks.push({
            origen_id: chosenAttack.origen_id,
            destino_id: chosenAttack.destino_id,
            tropas_atacantes: chosenAttack.tropas_atacantes
        });

        // Simular que las tropas atacantes se retiran del origen para no re-calcularlas en este bucle
        localTroopStats[t.id] = 1;
    }

    return attacks;
}

module.exports = {
    areAdjacent,
    calculateReinforcements,
    resolveCombat,
    getBotDeployment,
    getBotAttacks
};
