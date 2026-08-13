/**
 * Módulo de Inteligencia Artificial y Toma de Decisiones del Bot/NPC
 */

import { areAdjacent } from './gameLogic.js';

/**
 * Determina dónde debe desplegar el Bot sus tropas de refuerzo.
 * Compra tropas por costo usando el presupuesto de economía.
 * Elige tipos al azar entre las opciones comprables en cada paso.
 *
 * @param {Object} botCountry - Facción del bot { id, pais_id, economia, agresividad }
 * @param {Array<Object>} botTerritories - Territorios propiedad del bot
 * @param {Array<Object>} allTerritories - Todos los territorios en la partida
 * @param {Array<Object>} fronteras - Listado de aristas del grafo (fronteras)
 * @param {Array<Object>} troopTypesCatalog - Catálogo de tipos de tropa [{ id, costo, ... }]
 * @returns {Array<Object>} Despliegues decididos [ { territorio_id, cantidad, id_tipo_tropa } ]
 */
export function getBotDeployment(botCountry, botTerritories, allTerritories, fronteras, troopTypesCatalog = []) {
    const botId = botCountry.pais_id !== undefined ? botCountry.pais_id : botCountry.id;

    // Usar presupuesto acumulado persistente del país en partida
    const presupuesto = Number.isInteger(botCountry?.presupuesto_fortificacion)
        ? botCountry.presupuesto_fortificacion
        : 0;
    const catalogoOrdenado = (troopTypesCatalog || [])
        .filter(t => Number.isInteger(t?.id) && t.id > 0 && Number.isInteger(t?.costo) && t.costo > 0)
        .sort((a, b) => a.costo - b.costo);

    const deployments = [];
    if (botTerritories.length === 0 || presupuesto <= 0 || catalogoOrdenado.length === 0) return deployments;

    // Comprar composición aleatoria respetando presupuesto y costos del catálogo
    const comprasPorTipo = new Map();
    let presupuestoRestante = presupuesto;
    const costoMinimo = catalogoOrdenado[0].costo;

    while (presupuestoRestante >= costoMinimo) {
        const tiposComprables = catalogoOrdenado.filter((tipo) => tipo.costo <= presupuestoRestante);
        if (tiposComprables.length === 0) break;

        const tipoElegido = tiposComprables[Math.floor(Math.random() * tiposComprables.length)];
        presupuestoRestante -= tipoElegido.costo;
        comprasPorTipo.set(tipoElegido.id, (comprasPorTipo.get(tipoElegido.id) || 0) + 1);
    }

    const reinforcements = Array.from(comprasPorTipo.values()).reduce((sum, cantidad) => sum + cantidad, 0);
    if (reinforcements <= 0) return deployments;

    const construirPlanTerritorial = (territorio_id, cantidad) => ({
        territorio_id,
        cantidad
    });
    const planTerritorial = [];

    // Si no hay fronteras (caso raro o juego ganado), desplegar todo en el primer territorio
    const addSingleTerritoryPlan = () => {
        planTerritorial.push(construirPlanTerritorial(botTerritories[0].id, reinforcements));
    };

    // 1. Identificar territorios en la frontera con enemigos/neutrales
    const borderTerritories = [];
    for (const t of botTerritories) {
        const hasEnemyNeighbor = allTerritories.some(other => 
            other.pais_duenio_id !== botId && 
            areAdjacent(t, other, fronteras)
        );
        if (hasEnemyNeighbor) {
            borderTerritories.push(t);
        }
    }

    if (borderTerritories.length === 0) {
        addSingleTerritoryPlan();
    } else {
        const aggressiveness = botCountry.agresividad || 5;

        if (aggressiveness >= 7) {
            // --- BOT AGRESIVO ---
            let primaryTarget = borderTerritories[0];
            let minEnemyTroops = Infinity;

            for (const t of borderTerritories) {
                const neighbors = allTerritories.filter(other => 
                    other.pais_duenio_id !== botId && 
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
                planTerritorial.push(construirPlanTerritorial(primaryTarget.id, primaryQty));
            }

            if (secondaryQty > 0) {
                const otherBorders = borderTerritories.filter(t => t.id !== primaryTarget.id);
                if (otherBorders.length > 0) {
                    const qtyPerBorder = Math.floor(secondaryQty / otherBorders.length);
                    let remainder = secondaryQty % otherBorders.length;
                    
                    for (const t of otherBorders) {
                        const qty = qtyPerBorder + (remainder > 0 ? 1 : 0);
                        if (qty > 0) {
                            planTerritorial.push(construirPlanTerritorial(t.id, qty));
                        }
                        if (remainder > 0) remainder--;
                    }
                } else if (planTerritorial.length > 0) {
                    planTerritorial[0].cantidad += secondaryQty;
                } else {
                    planTerritorial.push(construirPlanTerritorial(primaryTarget.id, secondaryQty));
                }
            }
        } else {
            // --- BOT DEFENSIVO / EQUILIBRADO ---
            const threats = borderTerritories.map(t => {
                const neighbors = allTerritories.filter(other => 
                    other.pais_duenio_id !== botId && 
                    areAdjacent(t, other, fronteras)
                );
                const enemyTroopsTotal = neighbors.reduce((sum, n) => sum + (n.tropas_actuales || 0), 0);
                return { territorio_id: t.id, threat: enemyTroopsTotal };
            });

            const totalThreat = threats.reduce((sum, item) => sum + item.threat, 0) || 1;
            let deployedSum = 0;

            threats.forEach((th, index) => {
                let qty = Math.floor((th.threat / totalThreat) * reinforcements);
                
                if (index === threats.length - 1) {
                    qty = reinforcements - deployedSum;
                }
                
                if (qty > 0) {
                    planTerritorial.push(construirPlanTerritorial(th.territorio_id, qty));
                    deployedSum += qty;
                }
            });
        }
    }

    if (planTerritorial.length === 0) {
        addSingleTerritoryPlan();
    }

    const bolsaTipos = new Map(comprasPorTipo);
    const tomarTipoAleatorio = () => {
        const disponibles = Array.from(bolsaTipos.entries()).filter(([, cantidad]) => cantidad > 0);
        if (disponibles.length === 0) return null;

        const total = disponibles.reduce((sum, [, cantidad]) => sum + cantidad, 0);
        let pick = Math.floor(Math.random() * total) + 1;

        for (const [idTipo, cantidad] of disponibles) {
            pick -= cantidad;
            if (pick <= 0) {
                bolsaTipos.set(idTipo, cantidad - 1);
                return idTipo;
            }
        }
        return null;
    };

    for (const plan of planTerritorial) {
        const porTipo = new Map();
        for (let i = 0; i < plan.cantidad; i++) {
            const idTipo = tomarTipoAleatorio();
            if (!Number.isInteger(idTipo)) break;
            porTipo.set(idTipo, (porTipo.get(idTipo) || 0) + 1);
        }

        for (const [id_tipo_tropa, cantidad] of porTipo.entries()) {
            deployments.push({
                territorio_id: plan.territorio_id,
                cantidad,
                id_tipo_tropa
            });
        }
    }

    return deployments;
}

/**
 * Determina qué ataques realizará el Bot durante su turno.
 * El Bot evalúa los territorios enemigos limítrofes y ataca si la relación de fuerzas supera su umbral.
 * 
 * @param {Object} botCountry - Facción del bot { id, pais_id, agresividad, tecnologia }
 * @param {Array<Object>} botTerritories - Territorios del bot (con tropas ya actualizadas por despliegue)
 * @param {Array<Object>} allTerritories - Todos los territorios de la partida
 * @param {Array<Object>} fronteras - Listado de aristas del grafo (fronteras)
 * @returns {Array<Object>} Lista de ataques a ejecutar [ { origen_id, destino_id, tropas_atacantes } ]
 */
export function getBotAttacks(botCountry, botTerritories, allTerritories, fronteras) {
    const botId = botCountry.pais_id !== undefined ? botCountry.pais_id : botCountry.id;
    const attacks = [];
    const aggressiveness = botCountry.agresividad || 5;

    // Determinar umbral de ratio (Mis tropas / Tropas enemigo)
    let ratioThreshold = 1.0; // Ataca cuando iguala o supera en fuerzas
    if (aggressiveness >= 8) {
        ratioThreshold = 0.9; // Muy agresivo (se arriesga aun con ligera desventaja)
    } else if (aggressiveness <= 3) {
        ratioThreshold = 1.3; // Conservador (exige ventaja clara)
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
            other.pais_duenio_id !== botId && 
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
