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

async function loadCountriesForSelection() {
    const response = await apiFetch('/api/paises');
    if (!response.ok) {
        throw new Error('No se pudieron cargar los países');
    }
    return response.json();
}

document.addEventListener('DOMContentLoaded', () => {
    const btnNuevaPartida = document.querySelector('button[data-action="play"]');
    const btnAdministrar = document.querySelector('button[data-action="admin"]');
    const modal = document.getElementById('game-modal');
    const countrySelector = document.getElementById('country-selector');
    const startGameBtn = document.getElementById('start-game-btn');
    const cancelGameBtn = document.getElementById('cancel-game-btn');

    let availableCountries = [];

    const resetModal = () => {
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
        if (countrySelector) {
            countrySelector.innerHTML = '';
        }
        if (startGameBtn) {
            startGameBtn.disabled = false;
        }
        if (btnNuevaPartida) {
            btnNuevaPartida.textContent = 'Jugar';
        }
    };

    const openModal = async () => {
        if (!modal || !countrySelector) return;
        modal.classList.remove('hidden');
        modal.classList.add('flex');

        try {
            availableCountries = await loadCountriesForSelection();
            if (!availableCountries.length) {
                countrySelector.innerHTML = '<p class="text-sm text-slate-400">Todavía no hay países creados.</p>';
                return;
            }

            countrySelector.innerHTML = availableCountries.map((country) => `
                <label class="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-200">
                    <input type="checkbox" class="country-checkbox h-4 w-4 rounded border-slate-700 bg-slate-800" value="${country.id}">
                    <span>${country.nombre}</span>
                </label>
            `).join('');
        } catch (error) {
            console.error(error);
            countrySelector.innerHTML = '<p class="text-sm text-red-400">No se pudieron cargar los países.</p>';
        }
    };

    if (btnNuevaPartida) {
        btnNuevaPartida.addEventListener('click', async () => {
            await openModal();
        });
    }

    if (btnAdministrar) {
        btnAdministrar.addEventListener('click', () => {
            window.location.href = 'editor.html';
        });
    }

    if (cancelGameBtn) {
        cancelGameBtn.addEventListener('click', () => resetModal());
    }

    if (startGameBtn) {
        startGameBtn.addEventListener('click', async () => {
            const selectedCountries = Array.from(document.querySelectorAll('.country-checkbox:checked'))
                .map((checkbox) => Number(checkbox.value));

            if (selectedCountries.length < 2) {
                alert('Debés seleccionar al menos 2 países para que peleen entre sí.');
                return;
            }

            if (selectedCountries.length > 4) {
                alert('Podés seleccionar entre 2 y 4 países.');
                return;
            }

            try {
                btnNuevaPartida.textContent = 'CREANDO PARTIDA...';
                startGameBtn.disabled = true;

                const respuesta = await apiFetch('/api/partidas', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nombre: 'Partida de Prueba', paises_ids: selectedCountries })
                });

                if (!respuesta.ok) {
                    throw new Error('Error al crear la partida');
                }

                const nuevaPartida = await respuesta.json();
                resetModal();
                window.location.href = `mapa.html?id=${nuevaPartida.partida.id}`;
            } catch (error) {
                console.error(error);
                alert('Hubo un error al conectar con el servidor.');
                btnNuevaPartida.textContent = 'Jugar';
                startGameBtn.disabled = false;
            }
        });
    }

    document.addEventListener('change', (event) => {
        if (!(event.target instanceof HTMLInputElement) || !event.target.classList.contains('country-checkbox')) {
            return;
        }

        const selected = document.querySelectorAll('.country-checkbox:checked');
        if (selected.length > 4) {
            event.target.checked = false;
            alert('Podés seleccionar hasta 4 países.');
        }
    });
});