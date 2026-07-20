/**
 * Módulo de Inteligencia Artificial y Toma de Decisiones del Bot/NPC
 */

import { areAdjacent, calculateReinforcements } from './gameLogic.js';

/**
 * Determina dónde debe desplegar el Bot sus tropas de refuerzo.
 * 
 * @param {Object} botCountry - Facción del bot { id, economia, agresividad }
 * @param {Array<Object>} botTerritories - Territorios propiedad del bot
 * @param {Array<Object>} allTerritories - Todos los territorios en la partida
 * @param {Array<Object>} fronteras - Listado de aristas del grafo (fronteras)
 * @returns {Array<Object>} Despliegues decididos [ { territorio_id, cantidad } ]
 */
export function getBotDeployment(botCountry, botTerritories, allTerritories, fronteras) {
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
 * @param {Array<Object>} fronteras - Listado de aristas del grafo (fronteras)
 * @returns {Array<Object>} Lista de ataques a ejecutar [ { origen_id, destino_id, tropas_atacantes } ]
 */
export function getBotAttacks(botCountry, botTerritories, allTerritories, fronteras) {
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
