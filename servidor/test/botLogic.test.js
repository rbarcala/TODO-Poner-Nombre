import test from 'node:test';
import assert from 'node:assert/strict';
import { getBotDeployment } from '../logic/botLogic.js';

const fronteras = [
  { id_territorio_origen: 1, id_territorio_destino: 2 },
  { id_territorio_origen: 1, id_territorio_destino: 3 }
];

const allTerritories = [
  { id: 1, pais_duenio_id: 100, tropas_actuales: 3 },
  { id: 2, pais_duenio_id: 200, tropas_actuales: 2 },
  { id: 3, pais_duenio_id: 300, tropas_actuales: 1 }
];

const botTerritories = [
  { id: 1, pais_duenio_id: 100, tropas_actuales: 3 }
];

const catalogo = [
  { id: 1, costo: 1 },
  { id: 2, costo: 2 },
  { id: 3, costo: 3 }
];

test('getBotDeployment compra tropas válidas dentro del presupuesto', () => {
  const bot = { id: 100, agresividad: 8, presupuesto_fortificacion: 7 };
  const deployments = getBotDeployment(bot, botTerritories, allTerritories, fronteras, catalogo);

  assert.ok(Array.isArray(deployments));
  assert.ok(deployments.length > 0);

  const costos = new Map(catalogo.map((t) => [t.id, t.costo]));
  const costoTotal = deployments.reduce((sum, dep) => sum + (costos.get(dep.id_tipo_tropa) || 0) * dep.cantidad, 0);
  const totalUnidades = deployments.reduce((sum, dep) => sum + dep.cantidad, 0);

  assert.ok(totalUnidades > 0);
  assert.ok(costoTotal <= bot.presupuesto_fortificacion);
  assert.ok(deployments.every((dep) => Number.isInteger(dep.id_tipo_tropa) && costos.has(dep.id_tipo_tropa)));
});

test('getBotDeployment no despliega si no hay presupuesto suficiente', () => {
  const bot = { id: 100, agresividad: 5, presupuesto_fortificacion: 0 };
  const deployments = getBotDeployment(bot, botTerritories, allTerritories, fronteras, catalogo);

  assert.deepEqual(deployments, []);
});

test('getBotDeployment usa solo tipos comprables', () => {
  const bot = { id: 100, agresividad: 5, presupuesto_fortificacion: 1 };
  const deployments = getBotDeployment(bot, botTerritories, allTerritories, fronteras, catalogo);

  assert.ok(deployments.length >= 1);
  assert.ok(deployments.every((dep) => dep.id_tipo_tropa === 1));
});
