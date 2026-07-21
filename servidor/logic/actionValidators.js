/**
 * Módulo de Validación de Acciones de Juego (Despliegues, Movimientos y Ataques)
 */

import { areAdjacent } from './gameLogic.js';

/**
 * Valida una acción de despliegue de tropas de refuerzo enviada por el cliente.
 * 
 * @param {number} activePlayerId - ID de la civilización activa en el turno
 * @param {Array<Object>} playerTerritories - Territorios que pertenecen al jugador activo [{ id, pais_duenio_id }]
 * @param {Array<Object>} deployments - Lista de despliegues solicitados [{ territorio_id, cantidad }]
 * @param {number} availableReinforcements - Tropas de refuerzo disponibles calculadas para este turno
 * @returns {Object} { isValid: boolean, errors: Array<string> }
 */
export function validateDeploymentAction(activePlayerId, playerTerritories, deployments, availableReinforcements) {
    const errors = [];
    
    if (!deployments || !Array.isArray(deployments) || deployments.length === 0) {
        errors.push("Debe especificar al menos un despliegue de tropas.");
        return { isValid: false, errors };
    }

    const playerTerritoryIds = new Set(
        playerTerritories
            .filter(t => t.pais_duenio_id === activePlayerId)
            .map(t => t.id)
    );
    let totalDeployed = 0;

    deployments.forEach((dep, idx) => {
        const { territorio_id, cantidad } = dep;

        if (!Number.isInteger(cantidad) || cantidad <= 0) {
            errors.push(`El despliegue en el índice ${idx} debe especificar una cantidad de tropas entera mayor a 0.`);
            return;
        }

        if (!playerTerritoryIds.has(territorio_id)) {
            errors.push(`No puedes desplegar tropas en el territorio con ID ${territorio_id} porque no te pertenece.`);
            return;
        }

        totalDeployed += cantidad;
    });

    if (totalDeployed > availableReinforcements) {
        errors.push(`Intento de desplegar ${totalDeployed} tropas, pero solo tienes ${availableReinforcements} tropas de refuerzo disponibles.`);
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Valida un movimiento de tropas (ya sea transferencia amistosa o ataque) solicitado por el cliente.
 * 
 * @param {number} activePlayerId - ID de la civilización activa en el turno
 * @param {Object} originTerritory - Territorio origen de las tropas { id, pais_duenio_id, tropas_actuales }
 * @param {Object} destinationTerritory - Territorio destino de las tropas { id, pais_duenio_id, tropas_actuales }
 * @param {number} troopsToMove - Cantidad de tropas que se desean desplazar/enviar al ataque
 * @param {Array<Object>} fronteras - Listado de fronteras/aristas del grafo de la partida
 * @returns {Object} { isValid: boolean, isAttack: boolean, errors: Array<string> }
 */
export function validateMoveAction(activePlayerId, originTerritory, destinationTerritory, troopsToMove, fronteras) {
    const errors = [];

    if (!originTerritory) {
        errors.push("El territorio origen no existe.");
        return { isValid: false, isAttack: false, errors };
    }
    if (!destinationTerritory) {
        errors.push("El territorio destino no existe.");
        return { isValid: false, isAttack: false, errors };
    }

    // 1. Validar propiedad del origen
    if (originTerritory.pais_duenio_id !== activePlayerId) {
        errors.push("No puedes mover tropas desde un territorio que no pertenece a tu civilización.");
    }

    // 2. Validar que queden tropas de resguardo en el origen (al menos 1 debe quedarse)
    const tropasActuales = originTerritory.tropas_actuales || 1;
    if (!Number.isInteger(troopsToMove) || troopsToMove <= 0) {
        errors.push("La cantidad de tropas a mover debe ser un número entero mayor a 0.");
    } else if (tropasActuales - troopsToMove < 1) {
        errors.push(`No puedes mover ${troopsToMove} tropas. Debes dejar al menos 1 tropa custodiando el territorio origen (actuales: ${tropasActuales}).`);
    }

    // 3. Validar adyacencia (grafo conectado)
    const adjacent = areAdjacent(originTerritory, destinationTerritory, fronteras);
    if (!adjacent) {
        errors.push(`No existe una conexión directa (frontera) entre el territorio origen (ID: ${originTerritory.id}) y el destino (ID: ${destinationTerritory.id}).`);
    }

    // Determinar si es un ataque o un traslado amistoso
    const isAttack = destinationTerritory.pais_duenio_id !== activePlayerId;

    return {
        isValid: errors.length === 0,
        isAttack,
        errors
    };
}
