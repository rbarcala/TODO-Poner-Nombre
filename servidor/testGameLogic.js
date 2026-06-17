const { 
    areAdjacent, 
    calculateReinforcements, 
    resolveCombat, 
    getBotDeployment, 
    getBotAttacks 
} = require('./gameLogic');

console.log("=== INICIANDO PRUEBAS DE LÓGICA DE GRAFOS DE JUEGO ===");

// 1. Mock de las aristas del Grafo (Fronteras de la Base de Datos)
const fronterasMock = [
    { id_territorio_origen: 1, id_territorio_destino: 2 }, // Conexión tA-tB
    { id_territorio_origen: 1, id_territorio_destino: 3 }, // Conexión tA-tC
    
    // Conexiones del bot y enemigo
    { id_territorio_origen: 200, id_territorio_destino: 201 }, // Conexión bot-bot
    { id_territorio_origen: 200, id_territorio_destino: 300 }, // Conexión bot-enemigo
    { id_territorio_origen: 201, id_territorio_destino: 300 }  // Conexión bot-enemigo
];

// 2. Probando Adyacencia en Grafo
console.log("\n1. Probando Adyacencias en Grafo:");
const tA = { id: 1, nombre: "Nodo A" };
const tB = { id: 2, nombre: "Nodo B" };
const tC = { id: 3, nombre: "Nodo C" };
const tD = { id: 4, nombre: "Nodo D" }; // Nodo aislado

console.log(`- tA y tB conectados (esperado: true): ${areAdjacent(tA, tB, fronterasMock)}`);
console.log(`- tA y tC conectados (esperado: true): ${areAdjacent(tA, tC, fronterasMock)}`);
console.log(`- tA y tD conectados (esperado: false): ${areAdjacent(tA, tD, fronterasMock)}`);
console.log(`- tA y tA conectados (esperado: false): ${areAdjacent(tA, tA, fronterasMock)}`);

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
console.log("- Resultado del Combate:");
console.log(`  * Tiradas ataque base: [${result.attackRolls.join(", ")}] (Total base: ${result.totalAttackBase})`);
console.log(`  * Tiradas defensa base: [${result.defenseRolls.join(", ")}] (Total base: ${result.totalDefenseBase})`);
console.log(`  * Modificador de ataque aplicado: ${result.modAttackUsed} (Resistencia activa: ${result.attackerHasResistance})`);
console.log(`  * Modificador de defensa aplicado: ${result.modDefenseUsed} (Resistencia activa: ${result.defenderHasResistance})`);
console.log(`  * Puntos de Ataque Finales: ${result.totalAttack}`);
console.log(`  * Puntos de Defensa Finales: ${result.totalDefense}`);
console.log(`  * ¿Ganó el atacante?: ${result.attackerWins}`);

// 5. Probando Bot Despliegue
console.log("\n4. Probando Despliegue de IA (Bot) con Grafo:");
const botCountry = { id: 100, economia: 3, agresividad: 8 }; // Bot agresivo, recibe 6 tropas
const botTerritories = [
    { id: 200, tropas_actuales: 2 },
    { id: 201, tropas_actuales: 2 }
];
const allTerritories = [
    ...botTerritories,
    { id: 300, pais_duenio_id: 999, tropas_actuales: 1 } // Enemigo en ID 300
];

const deployments = getBotDeployment(botCountry, botTerritories, allTerritories, fronterasMock);
console.log("- Despliegues decididos por el Bot Agresivo:");
deployments.forEach(d => {
    console.log(`  * Territorio ID ${d.territorio_id}: +${d.cantidad} tropas`);
});

// 6. Probando Bot Ataques
console.log("\n5. Probando Decisiones de Ataque de IA (Bot) con Grafo:");
botTerritories[0].tropas_actuales = 2;
botTerritories[1].tropas_actuales = 7; // Incrementamos tropas después del despliegue

const attacks = getBotAttacks(botCountry, botTerritories, allTerritories, fronterasMock);
console.log("- Ataques planificados por el Bot:");
attacks.forEach(a => {
    console.log(`  * Desde ID ${a.origen_id} hacia ID ${a.destino_id} con ${a.tropas_atacantes} tropas`);
});

console.log("\n=== PRUEBAS DE GRAFOS COMPLETADAS CON ÉXITO ===");
