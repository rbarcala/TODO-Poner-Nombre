/**
 * Módulo de Inicialización de Mapa y Validación de Grafos
 */

/**
 * Valida si el grafo de territorios del mapa está completamente conectado.
 * Utiliza el algoritmo de Búsqueda en Anchura (BFS) para asegurar que no haya
 * territorios aislados (componentes inconexas) que arruinen la jugabilidad.
 * 
 * @param {Array<Object>} territories - Listado de todos los territorios [{ id }]
 * @param {Array<Object>} fronteras - Listado de aristas [{ id_territorio_origen, id_territorio_destino }]
 * @returns {boolean} True si el grafo está 100% conectado (es conexo)
 */
export function isMapConnected(territories, fronteras) {
    if (territories.length <= 1) return true;

    // 1. Construir lista de adyacencias del grafo
    const adjacencyList = new Map();
    for (const t of territories) {
        adjacencyList.set(t.id, []);
    }

    for (const f of fronteras) {
        const origin = f.id_territorio_origen;
        const dest = f.id_territorio_destino;
        
        // Registrar arista bidireccional (grafo no dirigido)
        if (adjacencyList.has(origin) && adjacencyList.has(dest)) {
            adjacencyList.get(origin).push(dest);
            adjacencyList.get(dest).push(origin);
        }
    }

    // 2. Ejecutar Búsqueda en Anchura (BFS) desde el primer nodo del grafo
    const visited = new Set();
    const startNodeId = territories[0].id;
    const queue = [startNodeId];
    visited.add(startNodeId);

    while (queue.length > 0) {
        const currentNodeId = queue.shift();
        const neighbors = adjacencyList.get(currentNodeId) || [];
        
        for (const neighborId of neighbors) {
            if (!visited.has(neighborId)) {
                visited.add(neighborId);
                queue.push(neighborId);
            }
        }
    }

    // 3. Si la cantidad de nodos visitados es igual al total de territorios, el grafo es conexo
    return visited.size === territories.length;
}

/**
 * Valida de manera exhaustiva un mapa personalizado construido en el frontend.
 * 
 * @param {Array<Object>} territories - Territorios del mapa [{ id, nombre, coord_x, coord_y, tipo_terreno_id, pais_duenio_id }]
 * @param {Array<Object>} fronteras - Conexiones/Aristas [{ id_territorio_origen, id_territorio_destino }]
 * @param {Array<Object>} [terrainTypes] - Catálogo opcional de terrenos válidos [{ id }]
 * @param {Array<number>} [participatingCountryIds] - IDs de los países/civilizaciones que juegan la partida
 * @returns {Object} { isValid: boolean, errors: Array<string> }
 */
export function validateCustomMap(territories, fronteras, terrainTypes, participatingCountryIds) {
    const errors = [];

    // Regla 1: Mínimo de territorios
    if (!territories || territories.length < 2) {
        errors.push("El mapa debe tener al menos 2 territorios para ser válido.");
        return { isValid: false, errors };
    }

    const coordinates = new Set();
    const names = new Set();
    const terrainIds = new Set(terrainTypes ? terrainTypes.map(t => t.id) : []);

    // Regla 2: Validaciones por nodo (Nombre duplicado, coordenadas superpuestas, terreno válido)
    territories.forEach((t, index) => {
        const label = t.nombre ? t.nombre.trim() : `Territorio #${index + 1}`;

        if (!t.nombre || t.nombre.trim() === "") {
            errors.push(`El territorio en el índice ${index} no tiene un nombre válido.`);
        } else if (names.has(t.nombre.trim())) {
            errors.push(`El nombre de territorio "${t.nombre.trim()}" está duplicado.`);
        } else {
            names.add(t.nombre.trim());
        }

        if (typeof t.coord_x !== 'number' || typeof t.coord_y !== 'number') {
            errors.push(`El territorio "${label}" tiene coordenadas inválidas.`);
        } else {
            const coordKey = `${t.coord_x},${t.coord_y}`;
            if (coordinates.has(coordKey)) {
                errors.push(`Las coordenadas (${t.coord_x}, ${t.coord_y}) del territorio "${label}" están superpuestas con otro territorio.`);
            } else {
                coordinates.add(coordKey);
            }
        }

        if (t.tipo_terreno_id !== undefined && t.tipo_terreno_id !== null) {
            if (terrainTypes && terrainTypes.length > 0 && !terrainIds.has(t.tipo_terreno_id)) {
                errors.push(`El territorio "${label}" tiene un tipo de terreno inexistente (ID: ${t.tipo_terreno_id}).`);
            }
        } else {
            errors.push(`El territorio "${label}" debe tener un tipo de terreno asignado.`);
        }
    });

    // Regla 3: Validaciones de aristas/fronteras
    const territoryIds = new Set(territories.map(t => t.id));
    const connectionPairs = new Set();

    if (fronteras) {
        fronteras.forEach((f, idx) => {
            const orig = f.id_territorio_origen;
            const dest = f.id_territorio_destino;

            if (!territoryIds.has(orig)) {
                errors.push(`La conexión #${idx + 1} referencia a un territorio origen inexistente (ID: ${orig}).`);
            }
            if (!territoryIds.has(dest)) {
                errors.push(`La conexión #${idx + 1} referencia a un territorio destino inexistente (ID: ${dest}).`);
            }

            if (orig === dest) {
                errors.push(`La conexión #${idx + 1} es un bucle (el territorio ID ${orig} se conecta consigo mismo).`);
            }

            // Normalizar la arista para validar duplicaciones
            const pairKey = orig < dest ? `${orig}-${dest}` : `${dest}-${orig}`;
            if (connectionPairs.has(pairKey)) {
                errors.push(`La conexión entre los territorios ${orig} y ${dest} está duplicada.`);
            } else {
                connectionPairs.add(pairKey);
            }
        });
    }

    // Regla 4: Al menos un territorio para cada bando/civilización participante
    if (participatingCountryIds && participatingCountryIds.length > 0) {
        const assignedCountryIds = new Set(
            territories
                .map(t => t.pais_duenio_id)
                .filter(id => id !== null && id !== undefined)
        );

        participatingCountryIds.forEach(countryId => {
            if (!assignedCountryIds.has(countryId)) {
                errors.push(`Debe existir al menos un territorio asignado al bando/facción con ID: ${countryId}.`);
            }
        });
    } else {
        const assignedCountryIds = new Set(
            territories
                .map(t => t.pais_duenio_id)
                .filter(id => id !== null && id !== undefined)
        );
        if (assignedCountryIds.size < 2) {
            errors.push("El mapa debe tener territorios asignados a al menos dos bandos/civilizaciones diferentes para poder jugar.");
        }
    }

    // Regla 5: Conectividad total (Grafo conexo por BFS)
    if (errors.length === 0) {
        const connected = isMapConnected(territories, fronteras || []);
        if (!connected) {
            errors.push("El mapa no es conexo. Existen territorios o grupos de territorios aislados sin conexión con el resto.");
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Genera un mapa en grilla (filas x cols) con distribución de países y terrenos.
 * 
 * @param {number} rows 
 * @param {number} cols 
 * @param {Array<number>} participatingCountryIds 
 * @param {Array<number>} terrainTypeIds 
 * @returns {Object} { territorios: Array, fronteras: Array }
 */
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

export function generateMap(rows, cols, participatingCountryIds = [], terrainTypeIds = [1]) {
    const minSize = Math.max(2, participatingCountryIds.length + 1);
    const effectiveRows = Number.isInteger(rows) && rows >= minSize ? rows : getRandomInt(minSize, 5);
    const effectiveCols = Number.isInteger(cols) && cols >= minSize ? cols : getRandomInt(minSize, 5);

    const territorios = [];
    const fronteras = [];
    const grid = [];

    let currentId = 1;

    // 1. Crear grilla de territorios
    for (let r = 0; r < effectiveRows; r++) {
        grid[r] = [];
        for (let c = 0; c < effectiveCols; c++) {
            const terrainAssigned = terrainTypeIds.length > 0
                ? terrainTypeIds[getRandomInt(0, terrainTypeIds.length - 1)]
                : 1;

            const t = {
                id: currentId++,
                nombre: `Territorio (${c + 1}, ${r + 1})`,
                x: c + 1,
                y: r + 1,
                coord_x: c + 1,
                coord_y: r + 1,
                tipo_terreno_id: terrainAssigned,
                pais_duenio_id: null,
                tropas_actuales: 0
            };

            territorios.push(t);
            grid[r][c] = t;
        }
    }

    const shuffledTerritories = shuffle(territorios);
    const shuffledCountries = shuffle(participatingCountryIds);

    shuffledCountries.slice(0, Math.min(shuffledCountries.length, shuffledTerritories.length)).forEach((countryId, index) => {
        const territory = shuffledTerritories[index];
        territory.pais_duenio_id = countryId;
        territory.tropas_actuales = 3;
    });

    // 2. Conectar fronteras horizontales y verticales
    for (let r = 0; r < effectiveRows; r++) {
        for (let c = 0; c < effectiveCols; c++) {
            const current = grid[r][c];

            // Derecha
            if (c + 1 < effectiveCols) {
                const right = grid[r][c + 1];
                fronteras.push({
                    id_territorio_origen: current.id,
                    id_territorio_destino: right.id
                });
            }

            // Abajo
            if (r + 1 < effectiveRows) {
                const down = grid[r + 1][c];
                fronteras.push({
                    id_territorio_origen: current.id,
                    id_territorio_destino: down.id
                });
            }
        }
    }

    return { territorios, fronteras };
}
