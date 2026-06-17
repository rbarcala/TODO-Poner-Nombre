const { 
    areAdjacent, 
    calculateReinforcements, 
    resolveCombat 
} = require('./logic/gameLogic');

const {
    getBotDeployment,
    getBotAttacks
} = require('./logic/botLogic');

const {
    isMapConnected,
    validateCustomMap
} = require('./logic/mapLogic');

console.log("=== INICIANDO PRUEBAS DE LÓGICA EN CARPETA LOGIC ===");

// 1. Mock de las aristas del Grafo (Fronteras de la Base de Datos)
const fronterasMock = [
    { id_territorio_origen: 1, id_territorio_destino: 2 },
    { id_territorio_origen: 1, id_territorio_destino: 3 },
    { id_territorio_origen: 200, id_territorio_destino: 201 },
    { id_territorio_origen: 200, id_territorio_destino: 300 },
    { id_territorio_origen: 201, id_territorio_destino: 300 }
];

// 2. Probando Adyacencia en Grafo
console.log("\n1. Probando Adyacencias en Grafo:");
const tA = { id: 1, nombre: "Nodo A" };
const tB = { id: 2, nombre: "Nodo B" };
const tC = { id: 3, nombre: "Nodo C" };
const tD = { id: 4, nombre: "Nodo D" };

console.log(`- tA y tB conectados (esperado: true): ${areAdjacent(tA, tB, fronterasMock)}`);
console.log(`- tA y tC conectados (esperado: true): ${areAdjacent(tA, tC, fronterasMock)}`);
console.log(`- tA y tD conectados (esperado: false): ${areAdjacent(tA, tD, fronterasMock)}`);

// 3. Probando Refuerzos
console.log("\n2. Probando Cálculo de Refuerzos:");
console.log(`- 2 territorios, econ 2 (esperado: 3 + 2 = 5): ${calculateReinforcements(2, 2)}`);
console.log(`- 9 territorios, econ 4 (esperado: 3 + 4 = 7): ${calculateReinforcements(9, 4)}`);

// 4. Probando Combate
console.log("\n3. Probando Resolución de Combate:");
const attackerCivilization = { id: 10, resistencia_terreno_id: 2 };
const defenderCivilization = { id: 11, resistencia_terreno_id: 1 };
const terrainFrio = { id: 2, modificador_ataque: 0.8, modificador_defensa: 0.8 };

const attackingTroops = [
    { tipo: "Caballería", dado_min: 3, dado_max: 8 },
    { tipo: "Infantería", dado_min: 1, dado_max: 6 }
];
const defendingTroops = [
    { tipo: "Infantería", dado_min: 1, dado_max: 6 }
];

const result = resolveCombat(attackerCivilization, defenderCivilization, terrainFrio, attackingTroops, defendingTroops);
console.log("- Resultado del Combate contra Oponente:");
console.log(`  * Tiradas ataque base: [${result.attackRolls.join(", ")}] (Total base: ${result.totalAttackBase})`);
console.log(`  * Tiradas defensa base: [${result.defenseRolls.join(", ")}] (Total base: ${result.totalDefenseBase})`);
console.log(`  * Puntos de Ataque Finales: ${result.totalAttack}`);
console.log(`  * Puntos de Defensa Finales: ${result.totalDefense}`);
console.log(`  * ¿Ganó el atacante?: ${result.attackerWins}`);

const resultUnoccupied = resolveCombat(attackerCivilization, null, terrainFrio, attackingTroops, []);
console.log("- Resultado del Combate contra Territorio Desocupado:");
console.log(`  * ¿Ganó el atacante automáticamente?: ${resultUnoccupied.attackerWins} (Auto-conquista: ${resultUnoccupied.autoConquest})`);

try {
    resolveCombat(attackerCivilization, attackerCivilization, terrainFrio, attackingTroops, defendingTroops);
    console.log("- Alerta: El ataque aliado no arrojó error (¡BUG!)");
} catch (e) {
    console.log(`- Resultado de Ataque Aliado (esperado error): Éxito, arrojó: "${e.message}"`);
}

// 5. Probando Bot Despliegue
console.log("\n4. Probando Despliegue de IA (Bot) con Grafo:");
const botCountry = { id: 100, economia: 3, agresividad: 8 };
const botTerritories = [
    { id: 200, tropas_actuales: 2 },
    { id: 201, tropas_actuales: 2 }
];
const allTerritories = [
    ...botTerritories,
    { id: 300, pais_duenio_id: 999, tropas_actuales: 1 }
];

const deployments = getBotDeployment(botCountry, botTerritories, allTerritories, fronterasMock);
console.log("- Despliegues decididos por el Bot:");
deployments.forEach(d => {
    console.log(`  * Territorio ID ${d.territorio_id}: +${d.cantidad} tropas`);
});

// 5. Probando Bot Ataques
console.log("\n5. Probando Decisiones de Ataque de IA (Bot) con Grafo:");
botTerritories[0].tropas_actuales = 2;
botTerritories[1].tropas_actuales = 7;

const attacks = getBotAttacks(botCountry, botTerritories, allTerritories, fronterasMock);
console.log("- Ataques planificados por el Bot:");
attacks.forEach(a => {
    console.log(`  * Desde ID ${a.origen_id} hacia ID ${a.destino_id} con ${a.tropas_atacantes} tropas`);
});

// 6. Probando Conectividad del Grafo y Distribución
console.log("\n6. Probando Conectividad del Grafo y Distribución de Territorios:");
const territoriesMock = [
    { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }
];
// fronterasMock tiene aristas: 1-2, 1-3. Nodo 4 está aislado.
console.log(`- Conectividad con Nodo 4 aislado (esperado: false): ${isMapConnected(territoriesMock, fronterasMock)}`);

// Conectamos el nodo 4 al nodo 2
const fronterasConectadas = [
    ...fronterasMock,
    { id_territorio_origen: 2, id_territorio_destino: 4 }
];
console.log(`- Conectividad tras conectar Nodo 4 (esperado: true): ${isMapConnected(territoriesMock, fronterasConectadas)}`);

// 7. Probando Validación de Mapas Personalizados
console.log("\n7. Probando Validación de Mapas Personalizados:");
const catalogTerrenos = [
    { id: 1, nombre: "Frío" },
    { id: 2, nombre: "Templado" }
];

// Caso A: Mapa inválido (errores múltiples, incluyendo falta de territorios para el bando 11)
const mapaInvalidoTerritorios = [
    { id: 1, nombre: "Alfa", coord_x: 0, coord_y: 0, tipo_terreno_id: 1, pais_duenio_id: 10 },
    { id: 2, nombre: "Alfa", coord_x: 0, coord_y: 0, tipo_terreno_id: 99, pais_duenio_id: 10 }, // Nombre duplicado, coordenadas superpuestas, terreno inexistente
    { id: 3, nombre: "Gamma", coord_x: 0, coord_y: 2, tipo_terreno_id: 2, pais_duenio_id: 10 }
];
const mapaInvalidoFronteras = [
    { id_territorio_origen: 1, id_territorio_destino: 1 }, // Auto-bucle
    { id_territorio_origen: 1, id_territorio_destino: 9 }  // Destino inexistente
];
const participatingCountries = [10, 11]; // Bandos participantes

const validationInvalido = validateCustomMap(mapaInvalidoTerritorios, mapaInvalidoFronteras, catalogTerrenos, participatingCountries);
console.log(`- Validación Mapa Erróneo (esperado isValid: false): ${validationInvalido.isValid}`);
console.log("- Errores detectados:");
validationInvalido.errors.forEach(err => console.log(`  * ${err}`));

// Caso B: Mapa válido (incluye al menos un territorio para cada bando)
const mapaValidoTerritorios = [
    { id: 1, nombre: "Alfa", coord_x: 0, coord_y: 0, tipo_terreno_id: 1, pais_duenio_id: 10 },
    { id: 2, nombre: "Beta", coord_x: 0, coord_y: 1, tipo_terreno_id: 1, pais_duenio_id: 11 }, // Bando 11 asignado
    { id: 3, nombre: "Gamma", coord_x: 1, coord_y: 1, tipo_terreno_id: 2, pais_duenio_id: 10 }
];
const mapaValidoFronteras = [
    { id_territorio_origen: 1, id_territorio_destino: 2 },
    { id_territorio_origen: 2, id_territorio_destino: 3 }
];

const validationValido = validateCustomMap(mapaValidoTerritorios, mapaValidoFronteras, catalogTerrenos, participatingCountries);
console.log(`- Validación Mapa Válido (esperado isValid: true): ${validationValido.isValid}`);
if (!validationValido.isValid) {
    console.log("- Errores en mapa válido (¡BUG!):");
    validationValido.errors.forEach(err => console.log(`  * ${err}`));
}

console.log("\n=== PRUEBAS DE CARPETA LOGIC COMPLETADAS CON ÉXITO ===");
