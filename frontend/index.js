// ─────────────────────────────────────────────
// DATOS DE PRUEBA
// Reemplazá esto con tu llamada real al backend:
//   const partidas = await fetch('/api/partidas').then(r => r.json());
// ─────────────────────────────────────────────

const PARTIDAS_MOCK = [
    { id: 1, nombre: "Partida 1", fecha: "12/09/2025" },
    { id: 2, nombre: "Partida 2", fecha: "15/09/2025" },
];

// ─────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────

function crearTarjeta(partida) {
    const article = document.createElement('article');
    article.className = 'tarjeta-de-partida';
    article.setAttribute('aria-label', `Partida guardada: ${partida.nombre}`);

    article.innerHTML = `
        <h3 class="nombre-partida">${partida.nombre}</h3>
        <time class="fecha-creacion" datetime="${partida.fecha}">${partida.fecha}</time>
        <button class="boton-editar" type="button" aria-label="Editar ${partida.nombre}">
            <img src="./assets/pencil.svg" alt="" aria-hidden="true" />
        </button>
        <button class="boton-eliminar" type="button" aria-label="Eliminar ${partida.nombre}">
            <img src="./assets/trash.svg" alt="" aria-hidden="true" />
        </button>
    `;

    article.querySelector('.boton-editar').addEventListener('click', () => editarPartida(partida.id));
    article.querySelector('.boton-eliminar').addEventListener('click', () => eliminarPartida(partida.id));

    return article;
}

function renderPartidas(partidas) {
    const lista = document.getElementById('lista-partidas');
    lista.innerHTML = '';

    if (partidas.length === 0) {
        lista.innerHTML = '<p class="estado-vacio">No hay partidas guardadas.</p>';
        return;
    }

    partidas.forEach(p => lista.appendChild(crearTarjeta(p)));
}

// ─────────────────────────────────────────────
// ACCIONES
// ─────────────────────────────────────────────

function editarPartida(id) {
    // TODO: lógica de edición
    console.log('Editar partida', id);
}

function eliminarPartida(id) {
    // TODO: await fetch(`/api/partidas/${id}`, { method: 'DELETE' });
    const index = PARTIDAS_MOCK.findIndex(p => p.id === id);
    if (index !== -1) {
        PARTIDAS_MOCK.splice(index, 1);
        renderPartidas(PARTIDAS_MOCK);
    }
}

// ─────────────────────────────────────────────
// INICIO
// ─────────────────────────────────────────────

// En tu app real:
// fetch('/api/partidas')
//     .then(r => r.json())
//     .then(datos => renderPartidas(datos));

renderPartidas(PARTIDAS_MOCK);
