const state = {
  terrenos: [],
  paises: [],
  tropas: []
};

const API_BASE_URLS = ['http://localhost:8000', 'http://localhost:3000'];

const endpoints = {
  paises: '/api/paises',
  tropas: '/api/tipos-tropas',
  terrenos: '/api/terrenos'
};

async function apiFetch(path, options = {}) {
  for (const baseUrl of API_BASE_URLS) {
    try {
      const response = await fetch(`${baseUrl}${path}`, options);
      if (response.ok || response.status !== 404) {
        return response;
      }
    } catch (error) {
      console.warn(`No se pudo contactar ${baseUrl}`, error);
    }
  }

  throw new Error('No se pudo conectar con el servidor');
}

async function getErrorMessage(response) {
  const fallback = `HTTP ${response.status}`;
  try {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await response.json();
      return body.error || body.message || fallback;
    }
    return await response.text() || fallback;
  } catch (error) {
    return fallback;
  }
}

function showForm(entity) {
  document.querySelectorAll('form').forEach((form) => form.classList.add('hidden'));
  const form = document.getElementById(`form-${entity}`);
  if (form) {
    form.classList.remove('hidden');
  }
}

function hideForms() {
  document.querySelectorAll('form').forEach((form) => form.classList.add('hidden'));
}

function renderList(entity, items) {
  const container = document.getElementById(`list-${entity}`);
  if (!container) return;

  if (!items.length) {
    container.innerHTML = '<p class="text-slate-500 text-sm">No hay elementos.</p>';
    return;
  }

  container.innerHTML = items.map((item) => {
    if (entity === 'paises') {
      const terreno = state.terrenos.find((t) => t.id === item.resistencia_terreno_id);
      return `
        <div class="rounded-lg border border-slate-800 p-3 text-sm">
          <div class="flex justify-between items-start gap-2">
            <div>
              <p class="font-semibold">${item.nombre}</p>
              <p class="text-slate-400">Eco ${item.economia} - Tec ${item.tecnologia} - Agg ${item.agresividad}</p>
              <p class="text-slate-400">Terreno: ${terreno ? terreno.nombre : 'Sin asignar'}</p>
            </div>
            <div class="flex gap-2">
              <button type="button" data-action="edit" data-entity="paises" data-id="${item.id}" class="text-amber-400">Editar</button>
              <button type="button" data-action="delete" data-entity="paises" data-id="${item.id}" class="text-red-400">Borrar</button>
            </div>
          </div>
        </div>`;
    }

    if (entity === 'tropas') {
      return `
        <div class="rounded-lg border border-slate-800 p-3 text-sm">
          <div class="flex justify-between items-start gap-2">
            <div>
              <p class="font-semibold">${item.tipo}</p>
              <p class="text-slate-400">${item.descripcion || 'Sin descripcion'}</p>
              <p class="text-slate-400">Dados ${item.dado_min}-${item.dado_max}</p>
            </div>
            <div class="flex gap-2">
              <button type="button" data-action="edit" data-entity="tropas" data-id="${item.id}" class="text-amber-400">Editar</button>
              <button type="button" data-action="delete" data-entity="tropas" data-id="${item.id}" class="text-red-400">Borrar</button>
            </div>
          </div>
        </div>`;
    }

    return `
      <div class="rounded-lg border border-slate-800 p-3 text-sm">
        <div class="flex justify-between items-start gap-2">
          <div>
            <p class="font-semibold">${item.nombre}</p>
            <p class="text-slate-400">${item.descripcion || 'Sin descripcion'}</p>
            <p class="text-slate-400">Ataque ${item.modificador_ataque} - Defensa ${item.modificador_defensa}</p>
          </div>
          <div class="flex gap-2">
            <button type="button" data-action="edit" data-entity="terrenos" data-id="${item.id}" class="text-amber-400">Editar</button>
            <button type="button" data-action="delete" data-entity="terrenos" data-id="${item.id}" class="text-red-400">Borrar</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

async function loadTerrenos() {
  const response = await apiFetch('/api/terrenos');
  if (!response.ok) throw new Error('No se pudieron cargar los terrenos');
  state.terrenos = await response.json();

  const select = document.querySelector('#form-paises select[name="terreno_id"]');
  if (select) {
    select.innerHTML = state.terrenos.map((t) => `<option value="${t.id}">${t.nombre}</option>`).join('');
  }

  renderList('terrenos', state.terrenos);
}

async function loadPaises() {
  const response = await apiFetch('/api/paises');
  if (!response.ok) throw new Error('No se pudieron cargar los paises');
  state.paises = await response.json();
  renderList('paises', state.paises);
}

async function loadTropas() {
  const response = await apiFetch('/api/tipos-tropas');
  if (!response.ok) throw new Error('No se pudieron cargar los tipos de tropas');
  state.tropas = await response.json();
  renderList('tropas', state.tropas);
}

async function loadAll() {
  await Promise.all([loadTerrenos(), loadPaises(), loadTropas()]);
}

function resetForm(entity) {
  const form = document.getElementById(`form-${entity}`);
  if (!form) return;
  form.reset();

  const idInput = form.querySelector('input[name="id"]');
  if (idInput) {
    idInput.value = '';
  }

  hideForms();
}

async function saveEntity(entity, payload) {
  const endpoint = endpoints[entity];
  if (!endpoint) return;

  const method = payload.id ? 'PUT' : 'POST';
  const response = await apiFetch(`${endpoint}${payload.id ? `/${payload.id}` : ''}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await getErrorMessage(response);
    alert(`No se pudo guardar: ${error}`);
    return;
  }

  await loadAll();
  resetForm(entity);
}

async function deleteEntity(entity, id) {
  const endpoint = endpoints[entity];
  if (!endpoint) return;

  const response = await apiFetch(`${endpoint}/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    const error = await getErrorMessage(response);
    alert(`No se pudo borrar: ${error}`);
    return;
  }

  await loadAll();
}

async function clearGameData(button) {
  if (!confirm('Seguro que queres borrar todas las partidas y datos de juego?')) {
    return;
  }

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Limpiando...';

  try {
    const response = await apiFetch('/api/partidas', { method: 'DELETE' });
    if (!response.ok) {
      const error = await getErrorMessage(response);
      alert(`No se pudieron limpiar las partidas: ${error}`);
      return;
    }

    const result = await response.json();
    const eliminados = result.eliminados || {};
    alert(
      `Base limpiada. Partidas: ${eliminados.partidas || 0}, territorios: ${eliminados.territorios || 0}, turnos: ${eliminados.turnos || 0}.`
    );
    await loadAll();
  } catch (error) {
    alert(`No se pudieron limpiar las partidas: ${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function getEntityItems(entity) {
  if (entity === 'paises') return state.paises;
  if (entity === 'tropas') return state.tropas;
  if (entity === 'terrenos') return state.terrenos;
  return [];
}

function setFieldValue(form, name, value) {
  const field = form.querySelector(`[name="${name}"]`);
  if (field) {
    field.value = value ?? '';
  }
}

async function handleSubmit(form) {
  const entity = form.id.replace('form-', '');
  const payload = Object.fromEntries(new FormData(form));
  const normalized = {};

  if (entity === 'paises') {
    const terrainId = Number(payload.terreno_id);
    normalized.id = payload.id ? Number(payload.id) : undefined;
    normalized.nombre = payload.nombre;
    normalized.color_hex = payload.color_hex;
    normalized.economia = Number(payload.economia);
    normalized.tecnologia = Number(payload.tecnologia);
    normalized.agresividad = Number(payload.agresividad);
    normalized.resistencia_terreno_id = Number.isInteger(terrainId) ? terrainId : null;
  } else if (entity === 'tropas') {
    normalized.id = payload.id ? Number(payload.id) : undefined;
    normalized.tipo = payload.tipo;
    normalized.descripcion = payload.descripcion;
    normalized.dado_min = Number(payload.dado_min);
    normalized.dado_max = Number(payload.dado_max);
  } else {
    normalized.id = payload.id ? Number(payload.id) : undefined;
    normalized.nombre = payload.nombre;
    normalized.descripcion = payload.descripcion;
    normalized.color_hex = payload.color_hex;
    normalized.modificador_ataque = Number(payload.modificador_ataque);
    normalized.modificador_defensa = Number(payload.modificador_defensa);
  }

  try {
    await saveEntity(entity, normalized);
  } catch (error) {
    alert(`No se pudo guardar: ${error.message}`);
  }
}

function initEditor() {
  document.addEventListener('click', async (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest('button[data-action]') : null;

    const addButton = event.target instanceof HTMLElement ? event.target.closest('.add-btn') : null;
    if (addButton instanceof HTMLElement) {
      const entity = addButton.dataset.entity;
      resetForm(entity);
      showForm(entity);
      return;
    }

    const cancelButton = event.target instanceof HTMLElement ? event.target.closest('.cancel-btn') : null;
    if (cancelButton instanceof HTMLElement) {
      const formId = cancelButton.closest('form')?.id || '';
      const entity = formId.replace('form-', '');
      resetForm(entity);
      return;
    }

    const clearButton = event.target instanceof HTMLElement ? event.target.closest('#clear-games-btn') : null;
    if (clearButton instanceof HTMLButtonElement) {
      await clearGameData(clearButton);
      return;
    }

    if (!(target instanceof HTMLElement)) return;

    if (target.dataset.action === 'edit') {
      const entity = target.dataset.entity;
      const id = Number(target.dataset.id);
      const item = getEntityItems(entity).find((entry) => entry.id === id);
      if (!item) return;

      const form = document.getElementById(`form-${entity}`);
      if (!form) return;

      if (entity === 'paises') {
        setFieldValue(form, 'id', item.id);
        setFieldValue(form, 'nombre', item.nombre);
        setFieldValue(form, 'color_hex', item.color_hex);
        setFieldValue(form, 'economia', item.economia);
        setFieldValue(form, 'tecnologia', item.tecnologia);
        setFieldValue(form, 'agresividad', item.agresividad);
        setFieldValue(form, 'terreno_id', item.resistencia_terreno_id);
      } else if (entity === 'tropas') {
        setFieldValue(form, 'id', item.id);
        setFieldValue(form, 'tipo', item.tipo);
        setFieldValue(form, 'descripcion', item.descripcion);
        setFieldValue(form, 'dado_min', item.dado_min);
        setFieldValue(form, 'dado_max', item.dado_max);
      } else {
        setFieldValue(form, 'id', item.id);
        setFieldValue(form, 'nombre', item.nombre);
        setFieldValue(form, 'descripcion', item.descripcion);
        setFieldValue(form, 'color_hex', item.color_hex);
        setFieldValue(form, 'modificador_ataque', item.modificador_ataque);
        setFieldValue(form, 'modificador_defensa', item.modificador_defensa);
      }

      showForm(entity);
      return;
    }

    if (target.dataset.action === 'delete') {
      const entity = target.dataset.entity;
      const id = Number(target.dataset.id);
      if (confirm('Seguro que queres borrar este elemento?')) {
        try {
          await deleteEntity(entity, id);
        } catch (error) {
          alert(`No se pudo borrar: ${error.message}`);
        }
      }
    }
  });

  document.addEventListener('submit', async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.id.startsWith('form-')) return;

    event.preventDefault();
    await handleSubmit(form);
  });

  loadAll().catch((error) => {
    alert(`No se pudo cargar el editor: ${error.message}`);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEditor);
} else {
  initEditor();
}
