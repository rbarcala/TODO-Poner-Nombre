const state = {
  terrenos: [],
  paises: [],
  tropas: []
};

const API_BASE_URLS = ['http://localhost:8000', 'http://localhost:3000'];

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
              <p class="text-slate-400">Eco ${item.economia} · Tec ${item.tecnologia} · Agg ${item.agresividad}</p>
              <p class="text-slate-400">Terreno: ${terreno ? terreno.nombre : 'Sin asignar'}</p>
            </div>
            <div class="flex gap-2">
              <button data-action="edit" data-entity="paises" data-id="${item.id}" class="text-amber-400">Editar</button>
              <button data-action="delete" data-entity="paises" data-id="${item.id}" class="text-red-400">Borrar</button>
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
              <p class="text-slate-400">${item.descripcion || 'Sin descripción'}</p>
              <p class="text-slate-400">Dados ${item.dado_min}-${item.dado_max} · Costo ${item.costo}</p>
            </div>
            <div class="flex gap-2">
              <button data-action="edit" data-entity="tropas" data-id="${item.id}" class="text-amber-400">Editar</button>
              <button data-action="delete" data-entity="tropas" data-id="${item.id}" class="text-red-400">Borrar</button>
            </div>
          </div>
        </div>`;
    }

    return `
      <div class="rounded-lg border border-slate-800 p-3 text-sm">
        <div class="flex justify-between items-start gap-2">
          <div>
            <p class="font-semibold">${item.nombre}</p>
            <p class="text-slate-400">${item.descripcion || 'Sin descripción'}</p>
            <p class="text-slate-400">Ataque ${item.modificador_ataque} · Defensa ${item.modificador_defensa}</p>
          </div>
          <div class="flex gap-2">
            <button data-action="edit" data-entity="terrenos" data-id="${item.id}" class="text-amber-400">Editar</button>
            <button data-action="delete" data-entity="terrenos" data-id="${item.id}" class="text-red-400">Borrar</button>
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
  if (!response.ok) throw new Error('No se pudieron cargar los países');
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
  const endpoint = entity === 'paises' ? '/api/paises' : entity === 'tropas' ? '/api/tipos-tropas' : '/api/terrenos';
  const method = payload.id ? 'PUT' : 'POST';
  const response = await apiFetch(`${endpoint}${payload.id ? `/${payload.id}` : ''}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.text();
    alert(`No se pudo guardar: ${error}`);
    return;
  }

  await loadAll();
  resetForm(entity);
}

async function deleteEntity(entity, id) {
  const endpoint = entity === 'paises' ? '/api/paises' : entity === 'tropas' ? '/api/tipos-tropas' : '/api/terrenos';
  const response = await apiFetch(`${endpoint}/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    alert('No se pudo borrar');
    return;
  }
  await loadAll();
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.add-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const entity = button.dataset.entity;
      showForm(entity);
    });
  });

  document.querySelectorAll('.cancel-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const formId = button.closest('form')?.id || '';
      const entity = formId.replace('form-', '');
      resetForm(entity);
    });
  });

  document.querySelectorAll('form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const entity = form.id.replace('form-', '');
      const payload = Object.fromEntries(new FormData(form));
      const normalized = {};

      if (entity === 'paises') {
        const terrainId = Number(payload.terreno_id);
        const terrainName = state.terrenos.find((t) => t.id === terrainId)?.nombre || state.terrenos[0]?.nombre;
        normalized.id = payload.id ? Number(payload.id) : undefined;
        normalized.nombre = payload.nombre;
        normalized.color_hex = payload.color_hex;
        normalized.economia = Number(payload.economia);
        normalized.tecnologia = Number(payload.tecnologia);
        normalized.agresividad = Number(payload.agresividad);
        normalized.terreno = terrainName;
      } else if (entity === 'tropas') {
        normalized.id = payload.id ? Number(payload.id) : undefined;
        normalized.tipo = payload.tipo;
        normalized.descripcion = payload.descripcion;
        normalized.dado_min = Number(payload.dado_min);
        normalized.dado_max = Number(payload.dado_max);
        normalized.costo = Number(payload.costo);
      } else {
        normalized.id = payload.id ? Number(payload.id) : undefined;
        normalized.nombre = payload.nombre;
        normalized.descripcion = payload.descripcion;
        normalized.color_hex = payload.color_hex;
        normalized.modificador_ataque = Number(payload.modificador_ataque);
        normalized.modificador_defensa = Number(payload.modificador_defensa);
      }

      await saveEntity(entity, normalized);
    });
  });

  document.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.dataset.action === 'edit') {
      const entity = target.dataset.entity;
      const id = Number(target.dataset.id);
      const list = entity === 'paises' ? state.paises : entity === 'tropas' ? state.tropas : state.terrenos;
      const item = list.find((entry) => entry.id === id);
      if (!item) return;

      const form = document.getElementById(`form-${entity}`);
      if (!form) return;

      if (entity === 'paises') {
        form.querySelector('[name="id"]').value = item.id;
        form.querySelector('[name="nombre"]').value = item.nombre;
        form.querySelector('[name="color_hex"]').value = item.color_hex;
        form.querySelector('[name="economia"]').value = item.economia;
        form.querySelector('[name="tecnologia"]').value = item.tecnologia;
        form.querySelector('[name="agresividad"]').value = item.agresividad;
        form.querySelector('[name="terreno_id"]').value = item.resistencia_terreno_id || '';
      } else if (entity === 'tropas') {
        form.querySelector('[name="id"]').value = item.id;
        form.querySelector('[name="tipo"]').value = item.tipo;
        form.querySelector('[name="descripcion"]').value = item.descripcion || '';
        form.querySelector('[name="dado_min"]').value = item.dado_min;
        form.querySelector('[name="dado_max"]').value = item.dado_max;
        form.querySelector('[name="costo"]').value = item.costo;
      } else {
        form.querySelector('[name="id"]').value = item.id;
        form.querySelector('[name="nombre"]').value = item.nombre;
        form.querySelector('[name="descripcion"]').value = item.descripcion || '';
        form.querySelector('[name="color_hex"]').value = item.color_hex;
        form.querySelector('[name="modificador_ataque"]').value = item.modificador_ataque;
        form.querySelector('[name="modificador_defensa"]').value = item.modificador_defensa;
      }
      showForm(entity);
      return;
    }

    if (target.dataset.action === 'delete') {
      const entity = target.dataset.entity;
      const id = Number(target.dataset.id);
      if (confirm('¿Seguro que querés borrar este elemento?')) {
        await deleteEntity(entity, id);
      }
    }
  });

  loadAll();
});
