import { 
    areAdjacent, 
    calculateReinforcements,
    calculateEconomyPoints,
    calculateDeploymentCost,
    resolveCombat 
} from './logic/gameLogic.js';

import {
    getBotDeployment,
    getBotAttacks
} from './logic/botLogic.js';

import {
    isMapConnected,
    validateCustomMap
} from './logic/mapLogic.js';

import {
    validateCivilization,
    validateTroopType
} from './logic/entityValidators.js';

import {
    getNextActivePlayer,
    checkVictoryCondition,
    executeBotTurn
} from './logic/turnManager.js';

import {
    validateDeploymentAction,
    validateMoveAction
} from './logic/actionValidators.js';

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

// 3. Probando Economía y Presupuesto
console.log("\n2. Probando Escala de Economía y Costos:");
const escalaEsperada = [[1,1],[2,2],[3,2],[4,3],[5,3],[6,4],[7,4],[8,5],[9,5],[10,6]];
escalaEsperada.forEach(([nivel, esperado]) => {
    const resultado = calculateEconomyPoints(nivel);
    console.log(`- Economía ${nivel} → ${resultado} pts (esperado ${esperado}): ${resultado === esperado ? 'OK' : 'FALLO'}`);
});

const catalogMock = [{ id: 1, costo: 1 }, { id: 2, costo: 2 }, { id: 3, costo: 3 }];
const costoComposicion = calculateDeploymentCost([{ id_tipo_tropa: 1, cantidad: 2 }, { id_tipo_tropa: 2, cantidad: 1 }], catalogMock);
console.log(`- Costo [2x tipo1(1) + 1x tipo2(2)] = 4 (esperado 4): ${costoComposicion === 4 ? 'OK' : `FALLO (${costoComposicion})`}`);

// 3b. Probando Refuerzos del bot
console.log("\n2b. Probando Cálculo de Refuerzos (bot):");
console.log(`- 2 territorios, econ 2 (esperado: base 3 + pts_econ 2 = 5): ${calculateReinforcements(2, 2)}`);
console.log(`- 9 territorios, econ 4 (esperado: base 3 + pts_econ 3 = 6): ${calculateReinforcements(9, 4)}`);

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

// 8. Probando Validación de Civilizaciones
console.log("\n8. Probando Validación de Civilizaciones:");
const civInvalida = {
    nombre: "X",
    color_hex: "rojo",
    economia: 0,
    tecnologia: 11,
    agresividad: 5,
    tropas: -5,
    resistencia_terreno_id: 99
};
const terrenosDisponibles = [{ id: 1 }, { id: 2 }];

const valCivInvalida = validateCivilization(civInvalida, terrenosDisponibles);
console.log(`- Validación Civ Inválida (esperado isValid: false): ${valCivInvalida.isValid}`);
console.log("- Errores detectados en Civilización:");
valCivInvalida.errors.forEach(err => console.log(`  * ${err}`));

const civValida = {
    nombre: "Imperio Romano",
    color_hex: "#E50914",
    economia: 6,
    tecnologia: 8,
    agresividad: 9,
    tropas: 15,
    resistencia_terreno_id: 2
};
const valCivValida = validateCivilization(civValida, terrenosDisponibles);
console.log(`- Validación Civ Válida (esperado isValid: true): ${valCivValida.isValid}`);

// 9. Probando Validación de Tipos de Tropas
console.log("\n9. Probando Validación de Tipos de Tropas:");
const tropaInvalida = {
    tipo: "XP",
    dado_min: 5,
    dado_max: 3
};
const valTropaInvalida = validateTroopType(tropaInvalida);
console.log(`- Validación Tropa Inválida (esperado isValid: false): ${valTropaInvalida.isValid}`);
console.log("- Errores detectados en Tropa:");
valTropaInvalida.errors.forEach(err => console.log(`  * ${err}`));

const tropaValida = {
    tipo: "Caballería de Elite",
    descripcion: "Fuerzas montadas pesadas de asalto rápido.",
    dado_min: 2,
    dado_max: 8
};
const valTropaValida = validateTroopType(tropaValida);
console.log(`- Validación Tropa Válida (esperado isValid: true): ${valTropaValida.isValid}`);

// 10. Probando Turnos y Victoria
console.log("\n10. Probando Turnos y Victoria:");
const playersList = [
    { pais_id: 10, eliminado: false },
    { pais_id: 11, eliminado: true },
    { pais_id: 12, eliminado: false }
];

console.log(`- Siguiente jugador tras ID 10 (esperado: 12 ya que 11 está eliminado): ${getNextActivePlayer(playersList, 10)}`);
console.log(`- Siguiente jugador tras ID 12 (esperado: 10 loops back): ${getNextActivePlayer(playersList, 12)}`);

const territoriesGameOver = [
    { id: 1, pais_duenio_id: 10 },
    { id: 2, pais_duenio_id: 10 }
];
const victoryResult = checkVictoryCondition(territoriesGameOver, playersList.filter(p => !p.eliminado));
console.log(`- Victoria de la partida (esperado isGameOver: true, winner: 10): ${victoryResult.isGameOver}, Winner: ${victoryResult.winnerCountryId}`);

// 11. Probando Simulación de Turno del Bot
console.log("\n11. Probando Simulación de Turno del Bot (executeBotTurn):");
const botCountryData = { id: 100, economia: 3, agresividad: 9, tecnologia: 5, resistencia_terreno_id: 1 };
const territoriesInGame = [
    { id: 200, pais_duenio_id: 100, tropas_actuales: 2, tipo_terreno_id: 1 },
    { id: 201, pais_duenio_id: 100, tropas_actuales: 2, tipo_terreno_id: 1 },
    { id: 300, pais_duenio_id: 999, tropas_actuales: 1, tipo_terreno_id: 1 }
];
const participatingCountriesList = [
    { pais_id: 100, eliminado: false },
    { pais_id: 999, eliminado: false }
];
const catalogDeTropas = [
    { id: 1, tipo: "Unidad Común", dado_min: 1, dado_max: 6, costo: 1 }
];

const botTurnResult = executeBotTurn(botCountryData, territoriesInGame, fronterasMock, participatingCountriesList, catalogDeTropas);
console.log("- Resultados del Turno del Bot:");
console.log(`  * Despliegues: ${JSON.stringify(botTurnResult.deployments)}`);
console.log(`  * Combates realizados: ${botTurnResult.combatLogs.length}`);
botTurnResult.combatLogs.forEach(c => {
    console.log(`    > Origen: ${c.origen_id} -> Destino: ${c.destino_id} | Dados: ${c.totalAttack} vs ${c.totalDefense} | ¿Ganador Bot?: ${c.attackerWins}`);
});
console.log(`  * ¿El Bot ganó la partida?: ${botTurnResult.isGameOver} (Ganador ID: ${botTurnResult.winnerCountryId})`);

// 12. Probando Validación de Acciones de Juego
console.log("\n12. Probando Validación de Acciones de Juego (Despliegues y Movimientos):");

// Caso A: Despliegue inválido (desplegar en territorio enemigo o exceder el pool)
const activePlayer = 100;
const playerTerrs = [
    { id: 200, pais_duenio_id: 100 },
    { id: 201, pais_duenio_id: 100 }
];
const badDeployments = [
    { territorio_id: 200, cantidad: 5 },
    { territorio_id: 300, cantidad: 2 }
];
const valDep1 = validateDeploymentAction(activePlayer, playerTerrs, badDeployments, 6);
console.log(`- Validación Despliegue con Territorio Enemigo (esperado isValid: false): ${valDep1.isValid}`);
valDep1.errors.forEach(err => console.log(`  * ${err}`));

const valDep2 = validateDeploymentAction(activePlayer, playerTerrs, [{ territorio_id: 200, cantidad: 8 }], 6);
console.log(`- Validación Despliegue Excediendo Tropas (esperado isValid: false): ${valDep2.isValid}`);
valDep2.errors.forEach(err => console.log(`  * ${err}`));

const valDepCorrect = validateDeploymentAction(activePlayer, playerTerrs, [{ territorio_id: 200, cantidad: 4 }, { territorio_id: 201, cantidad: 2 }], 6);
console.log(`- Validación Despliegue Correcto (esperado isValid: true): ${valDepCorrect.isValid}`);

// Caso B: Movimiento/Ataque inválido y válido
const originTerrGood = { id: 200, pais_duenio_id: 100, tropas_actuales: 3 };
const originTerrWeak = { id: 201, pais_duenio_id: 100, tropas_actuales: 1 };
const destTerrEnemy = { id: 300, pais_duenio_id: 999, tropas_actuales: 2 };
const destTerrFar = { id: 400, pais_duenio_id: 999, tropas_actuales: 1 };

const valMove1 = validateMoveAction(activePlayer, originTerrWeak, destTerrEnemy, 1, fronterasMock);
console.log(`- Movimiento desde territorio con pocas tropas (esperado isValid: false): ${valMove1.isValid}`);
valMove1.errors.forEach(err => console.log(`  * ${err}`));

const valMove2 = validateMoveAction(activePlayer, originTerrGood, destTerrFar, 2, fronterasMock);
console.log(`- Movimiento a territorio no adyacente (esperado isValid: false): ${valMove2.isValid}`);
valMove2.errors.forEach(err => console.log(`  * ${err}`));

const valMoveCorrectAttack = validateMoveAction(activePlayer, originTerrGood, destTerrEnemy, 2, fronterasMock);
console.log(`- Movimiento Correcto/Ataque (esperado isValid: true, isAttack: true): ${valMoveCorrectAttack.isValid}, esAtaque: ${valMoveCorrectAttack.isAttack}`);

const destTerrAlly = { id: 201, pais_duenio_id: 100, tropas_actuales: 1 };
const valMoveCorrectTransfer = validateMoveAction(activePlayer, originTerrGood, destTerrAlly, 2, fronterasMock);
console.log(`- Movimiento Correcto/Traslado (esperado isValid: true, isAttack: false): ${valMoveCorrectTransfer.isValid}, esAtaque: ${valMoveCorrectTransfer.isAttack}`);

console.log("\n=== PRUEBAS DE CARPETA LOGIC COMPLETADAS CON ÉXITO ===");
