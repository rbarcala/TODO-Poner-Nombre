import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMap } from '../logic/mapLogic.js';

test('generateMap crea una grilla aleatoria y reparte un territorio inicial a cada país', () => {
  const participantes = [1, 2, 3];
  const terrenos = [1, 2, 3, 4, 5];

  const mapa = generateMap(undefined, undefined, participantes, terrenos);

  assert.ok(mapa.territorios.length > 0, 'debería crear territorios');
  assert.ok(mapa.territorios.length >= participantes.length, 'debería haber al menos un territorio por país');

  const owned = mapa.territorios.filter(t => t.pais_duenio_id !== null);
  assert.equal(owned.length, participantes.length, 'debería asignar un territorio a cada país participante');
  assert.ok(owned.every(t => t.tropas_actuales === 3), 'los territorios iniciales deberían empezar con 3 tropas');

  const vacios = mapa.territorios.filter(t => t.pais_duenio_id === null);
  assert.ok(vacios.every(t => t.tropas_actuales === 0), 'los territorios vacíos deberían quedar sin tropas');

  const rows = new Set(mapa.territorios.map(t => t.y)).size;
  const cols = new Set(mapa.territorios.map(t => t.x)).size;
  const minSize = participantes.length + 1;
  assert.ok(rows >= minSize, 'la cantidad de filas debería ser al menos la cantidad de países + 1');
  assert.ok(cols >= minSize, 'la cantidad de columnas debería ser al menos la cantidad de países + 1');
  assert.equal(rows * cols, mapa.territorios.length, 'la grilla debería cubrir todos los territorios');
  assert.ok(mapa.territorios.every(t => terrenos.includes(t.tipo_terreno_id)), 'todos los territorios deberían tener un terreno válido');
});
