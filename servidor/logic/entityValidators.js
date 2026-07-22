/**
 * Módulo de Validación de Entidades (CRUDs)
 */

/**
 * Valida de manera exhaustiva los datos de una civilización (país/facción)
 * antes de guardarla o actualizarla en la base de datos.
 * 
 * @param {Object} civilization - Datos de la civilización a validar
 * @param {Array<Object>} [terrainTypes] - Catálogo opcional de terrenos válidos para validar FK
 * @returns {Object} { isValid: boolean, errors: Array<string> }
 */
export function validateCivilization(civilization, terrainTypes) {
    const errors = [];
    
    if (!civilization) {
        return { isValid: false, errors: ["Los datos de la civilización son requeridos."] };
    }
    
    const { nombre, color_hex, economia, tecnologia, agresividad, tropas, resistencia_terreno_id } = civilization;
    
    // 1. Validar Nombre
    if (typeof nombre !== 'string' || nombre.trim().length < 3 || nombre.trim().length > 100) {
        errors.push("El nombre de la civilización debe ser un texto de entre 3 y 100 caracteres.");
    }
    
    // 2. Validar Color Hexadecimal
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    if (typeof color_hex !== 'string' || !hexRegex.test(color_hex)) {
        errors.push("El color debe ser un formato hexadecimal válido de 6 dígitos (ej: #FF5733).");
    }
    
    // 3. Validar Parámetros de Simulación (Economía, Tecnología, Agresividad)
    if (!Number.isInteger(economia) || economia < 1 || economia > 10) {
        errors.push("El nivel de economía debe ser un número entero entre 1 y 10.");
    }
    
    if (!Number.isInteger(tecnologia) || tecnologia < 1 || tecnologia > 10) {
        errors.push("El nivel de tecnología debe ser un número entero entre 1 y 10.");
    }
    
    if (!Number.isInteger(agresividad) || agresividad < 1 || agresividad > 10) {
        errors.push("El nivel de agresividad del bot debe ser un número entero entre 1 y 10.");
    }
    
    // 4. Validar Tropas Iniciales
    if (tropas !== undefined && tropas !== null && (!Number.isInteger(tropas) || tropas < 0)) {
        errors.push("La cantidad inicial de tropas debe ser un número entero no negativo (mínimo 0).");
    }
    
    // 5. Validar FK de Resistencia de Terreno
    if (resistencia_terreno_id !== undefined && resistencia_terreno_id !== null) {
        if (!Number.isInteger(resistencia_terreno_id) || resistencia_terreno_id <= 0) {
            errors.push("El ID de resistencia a terreno debe ser un número entero positivo.");
        } else if (terrainTypes && terrainTypes.length > 0) {
            const validTerrainIds = new Set(terrainTypes.map(t => t.id));
            if (!validTerrainIds.has(resistencia_terreno_id)) {
                errors.push(`El tipo de terreno asignado como resistencia (ID: ${resistencia_terreno_id}) no existe en el catálogo.`);
            }
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Valida de manera exhaustiva los datos de un tipo de tropa/unidad
 * antes de guardarla o actualizarla en la base de datos.
 * 
 * @param {Object} troopType - Datos del tipo de tropa a validar
 * @returns {Object} { isValid: boolean, errors: Array<string> }
 */
export function validateTroopType(troopType) {
    const errors = [];
    
    if (!troopType) {
        return { isValid: false, errors: ["Los datos del tipo de tropa son requeridos."] };
    }
    
    const { tipo, descripcion, dado_min, dado_max } = troopType;
    
    // 1. Validar Tipo
    if (typeof tipo !== 'string' || tipo.trim().length < 3 || tipo.trim().length > 50) {
        errors.push("El tipo de unidad debe ser un texto de entre 3 y 50 caracteres.");
    }
    
    // 2. Validar Descripción (Opcional)
    if (descripcion !== undefined && descripcion !== null) {
        if (typeof descripcion !== 'string' || descripcion.trim().length > 500) {
            errors.push("La descripción del tipo de tropa debe ser un texto de máximo 500 caracteres.");
        }
    }
    
    // 3. Validar Dado Min
    if (!Number.isInteger(dado_min) || dado_min < 1) {
        errors.push("El valor mínimo del dado debe ser un número entero de al menos 1.");
    }
    
    // 4. Validar Dado Max
    if (!Number.isInteger(dado_max) || dado_max < 1) {
        errors.push("El valor máximo del dado debe ser un número entero de al menos 1.");
    }
    
    // 5. Validar Consistencia de Dados (dado_min <= dado_max)
    if (Number.isInteger(dado_min) && Number.isInteger(dado_max) && dado_min > dado_max) {
        errors.push("El valor mínimo del dado no puede superar al valor máximo.");
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}
