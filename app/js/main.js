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
    const modalDescription = document.getElementById('game-modal-description');
    const countrySelector = document.getElementById('country-selector');
    const startGameBtn = document.getElementById('start-game-btn');
    const cancelGameBtn = document.getElementById('cancel-game-btn');

    let availableCountries = [];
    let selectedPlayerCountryId = null;
    let modalStep = 'player';

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
            startGameBtn.textContent = 'Comenzar';
        }
        if (btnNuevaPartida) {
            btnNuevaPartida.textContent = 'Jugar';
        }
        selectedPlayerCountryId = null;
        modalStep = 'player';
    };

    const renderPlayerSelector = () => {
        if (!countrySelector || !startGameBtn) return;
        if (modalDescription) {
            modalDescription.textContent = 'Elegí el país que vas a jugar.';
        }
        startGameBtn.textContent = 'Siguiente';
        countrySelector.innerHTML = availableCountries.map((country) => `
            <label class="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-200">
                <input type="radio" name="player-country" class="player-country-radio h-4 w-4 border-slate-700 bg-slate-800" value="${country.id}">
                <span>${country.nombre}</span>
            </label>
        `).join('');
    };

    const renderBotSelector = () => {
        if (!countrySelector || !startGameBtn) return;
        if (modalDescription) {
            modalDescription.textContent = 'Ahora elegí los bots contra los que querés jugar (1 a 3).';
        }
        startGameBtn.textContent = 'Comenzar';
        const botOptions = availableCountries.filter((country) => country.id !== selectedPlayerCountryId);
        countrySelector.innerHTML = botOptions.map((country) => `
            <label class="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-200">
                <input type="checkbox" class="bot-country-checkbox h-4 w-4 rounded border-slate-700 bg-slate-800" value="${country.id}">
                <span>${country.nombre}</span>
            </label>
        `).join('');
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
            selectedPlayerCountryId = null;
            modalStep = 'player';
            renderPlayerSelector();
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
            if (modalStep === 'player') {
                const selectedPlayer = document.querySelector('.player-country-radio:checked');
                const playerCountryId = Number(selectedPlayer?.value);
                if (!Number.isInteger(playerCountryId) || playerCountryId <= 0) {
                    alert('Debés elegir tu país para continuar.');
                    return;
                }
                selectedPlayerCountryId = playerCountryId;
                modalStep = 'bots';
                renderBotSelector();
                return;
            }

            const selectedBots = Array.from(document.querySelectorAll('.bot-country-checkbox:checked'))
                .map((checkbox) => Number(checkbox.value))
                .filter((id) => Number.isInteger(id) && id > 0);
            if (selectedBots.length < 1) {
                alert('Debés elegir al menos 1 bot rival.');
                return;
            }
            if (selectedBots.length > 3) {
                alert('Podés elegir hasta 3 bots rivales.');
                return;
            }
            const selectedCountries = [selectedPlayerCountryId, ...selectedBots];

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
        if (!(event.target instanceof HTMLInputElement) || !event.target.classList.contains('bot-country-checkbox')) {
            return;
        }

        const selected = document.querySelectorAll('.bot-country-checkbox:checked');
        if (selected.length > 3) {
            event.target.checked = false;
            alert('Podés seleccionar hasta 3 bots.');
        }
    });
});