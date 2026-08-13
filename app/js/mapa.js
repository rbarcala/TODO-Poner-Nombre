//CONSTANTES Y ESTADO GLOBAL
const SVG_NS = "http://www.w3.org/2000/svg";

const ESCALA = 150;
const OFFSET_X = 100;
const OFFSET_Y = 100;
let ultimoMapa = null;

function aplicarTema(theme) {
    const body = document.body;
    const button = document.getElementById('theme-toggle');

    body.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
    body.style.backgroundColor = theme === 'light' ? '#c79b73' : '#0f172a';

    if (button) {
        const icon = document.getElementById('theme-icon');
        if (icon) {
            icon.textContent = theme === 'light' ? '🌙' : '☀️';
        }
        button.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
    }

    if (ultimoMapa) {
        dibujarGrafo(ultimoMapa.territorios, ultimoMapa.fronteras);
    }

    localStorage.setItem('mapa-theme', theme);
}

let estadoJuego = null;
let territorioSeleccionado = null;
let territorioOrigenMover = null;
let modoMoverActivo = false;
let modoAtacarActivo = false;
let partidaId = null;
let catalogoTropas = [];
let opcionesRefuerzoActuales = [];
let seleccionRefuerzo = new Map();
let modalRefuerzoAbierto = false;
let opcionesAtaqueActuales = [];
let seleccionAtaque = new Map();
let modalAtaqueAbierto = false;
let territorioDestinoAtaque = null;

const FORMATO_COMPOSICION_EJEMPLO = "1:2,2:1";

//INICIALIZACION
document.addEventListener('DOMContentLoaded', () => {
    const parametros = new URLSearchParams(window.location.search);
    partidaId = parametros.get('id');
    const themeToggle = document.getElementById('theme-toggle');

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.body.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
            const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
            aplicarTema(nextTheme);
        });
    }

    const savedTheme = localStorage.getItem('mapa-theme');
    aplicarTema(savedTheme === 'light' ? 'light' : 'dark');

    if (!partidaId) {
        alert("No se encontró el ID de la partida. Volvé al menú principal.");
        window.location.href = "index.html";
        return;
    }

    cargarYRenderizarMapa(partidaId);
    configurarEventosGlobales();
});

function configurarEventosGlobales() {
    // Teclado
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalRefuerzoAbierto) {
            cerrarModalRefuerzo();
            return;
        }
        if (e.key === 'Escape' && modalAtaqueAbierto) {
            cerrarModalAtaque();
            return;
        }
        if (e.key === 'Escape' && territorioSeleccionado) {
            deseleccionarTerritorio();
        }
    });

    //Seguimiento mouse para paneles flotantes
    document.addEventListener('mousemove', (e) => {
        if (modoMoverActivo) posicionarPanel('panel-mover-tropas', e);
        if (modoAtacarActivo) posicionarPanel('panel-atacar', e);
    });

    document.getElementById('btn-reforzar')?.addEventListener('click', manejarRefuerzo);
    document.getElementById('btn-mover')?.addEventListener('click', () => activarModoEspecial('mover'));
    document.getElementById('btn-atacar')?.addEventListener('click', () => activarModoEspecial('atacar'));
    document.getElementById('btn-pasar-turno')?.addEventListener('click', manejarPasarTurno);
    document.getElementById('btn-salir')?.addEventListener('click', manejarSalirAlMenu);
    document.getElementById('btn-cerrar-refuerzo')?.addEventListener('click', cerrarModalRefuerzo);
    document.getElementById('btn-confirmar-refuerzo')?.addEventListener('click', confirmarCompraRefuerzo);
    document.getElementById('refuerzo-lista')?.addEventListener('click', manejarClickSelectorRefuerzo);
    document.getElementById('btn-cerrar-ataque')?.addEventListener('click', cerrarModalAtaque);
    document.getElementById('btn-confirmar-ataque')?.addEventListener('click', confirmarAtaqueModal);
    document.getElementById('ataque-lista')?.addEventListener('click', manejarClickSelectorAtaque);
}

//INTERFAZ
function posicionarPanel(panelId, evento) {
    const panel = document.getElementById(panelId);
    if (panel) {
        panel.style.left = `${evento.pageX + 15}px`;
        panel.style.top = `${evento.pageY + 15}px`;
    }
}

function mostrarPanel(panelId) {
    const panel = document.getElementById(panelId);
    panel.classList.remove('hidden');
    panel.style.display = 'block';
}

function ocultarPanel(panelId) {
    const panel = document.getElementById(panelId);
    panel.classList.add('hidden');
    panel.style.display = 'none';
}

function activarModoEspecial(modo) {
    if (!territorioSeleccionado) return;
    
    territorioOrigenMover = territorioSeleccionado;
    document.getElementById('panel-acciones').style.display = 'none';

    if (modo === 'mover') {
        modoMoverActivo = true;
        mostrarPanel('panel-mover-tropas');
    } else if (modo === 'atacar') {
        modoAtacarActivo = true;
        mostrarPanel('panel-atacar');
    }
}

//LOGICA DE TERRITORIOS Y CLICKS
function seleccionarTerritorio(territorio) {
    territorioSeleccionado = territorio;
    const panel = document.getElementById('panel-acciones');
    const titulo = document.getElementById('panel-titulo');
    
    titulo.textContent = territorio.nombre || `Territorio #${territorio.id}`;
    actualizarSubtituloPanel(territorio);
    
    panel.style.display = 'flex';
    dibujarGrafo(estadoJuego.territorios, estadoJuego.fronteras);
}

function deseleccionarTerritorio() {
    territorioSeleccionado = null;
    modoMoverActivo = false;
    modoAtacarActivo = false;
    cerrarModalRefuerzo();
    cerrarModalAtaque();
    
    document.getElementById('panel-acciones').style.display = 'none';
    ocultarPanel('panel-mover-tropas');
    ocultarPanel('panel-atacar');
    
    dibujarGrafo(estadoJuego.territorios, estadoJuego.fronteras);
}

async function onTerritorioClickeado(territorioDestino) {
    if (modoAtacarActivo) {
        await procesarAtaque(territorioDestino);
    } else if (modoMoverActivo) {
        await procesarMovimiento(territorioDestino);
    } else {
        procesarSeleccionNormal(territorioDestino);
    }
}

function procesarSeleccionNormal(territorioDestino) {
    const turnoActualPaisId = estadoJuego.partida.turno_actual;
    
    if (territorioSeleccionado && territorioSeleccionado.id === territorioDestino.id) {
        deseleccionarTerritorio();
        return;
    }
    
    if (territorioDestino.pais_duenio_id === turnoActualPaisId) {
        seleccionarTerritorio(territorioDestino);
    } else {
        alert("Alto ahí: Este territorio pertenece a otro jugador o no es tu turno.");
    }
}

//ACCIONES DE JUEGO (REFORZAR, MOVER, ATACAR)
async function manejarRefuerzo() {
    if (!territorioSeleccionado) return;
    if (estadoJuego?.partida?.ha_fortificado) {
        alert("Ya realizaste la fortificación de este turno.");
        return;
    }
    try {
        const presupuesto = obtenerPresupuestoFortificacion();
        if (presupuesto <= 0) {
            alert("No tenés presupuesto de fortificación disponible.");
            return;
        }

        opcionesRefuerzoActuales = await obtenerOpcionesRefuerzo();
        if (!opcionesRefuerzoActuales.length) {
            alert("No hay tipos de tropa disponibles para reforzar.");
            return;
        }

        seleccionRefuerzo = new Map(opcionesRefuerzoActuales.map((item) => [item.id_tipo_tropa, 0]));
        abrirModalRefuerzo(territorioSeleccionado, presupuesto);
    } catch (error) {
        console.error("Error al reforzar:", error);
        alert(`No se pudo reforzar:\n- ${error.message}`);
    }
}

async function procesarMovimiento(territorioDestino) {
    ocultarPanel('panel-mover-tropas');
    modoMoverActivo = false;

    if (territorioOrigenMover.id === territorioDestino.id) {
        alert("El territorio destino debe ser distinto al de origen.");
        return;
    }
    if (territorioDestino.pais_duenio_id !== estadoJuego.partida.turno_actual) {
        alert("Solo podés mover tropas hacia tus propios territorios.");
        return;
    }

    const composicion = await solicitarComposicionPorPrompt({
        titulo: `Mover tropas: ${territorioOrigenMover.nombre || 'origen'} -> ${territorioDestino.nombre || 'destino'}`,
        opciones: obtenerOpcionesDesdeTerritorio(territorioOrigenMover),
        maximoTotal: territorioOrigenMover.tropas_actuales - 1,
        presupuestoMaximo: null
    });

    if (!composicion) {
        deseleccionarTerritorio();
        return;
    }

    try {
        estadoJuego = await apiMoverTropas(partidaId, territorioOrigenMover.id, territorioDestino.id, composicion);
        dibujarGrafo(estadoJuego.territorios, estadoJuego.fronteras);
        actualizarInfoTurno();
        deseleccionarTerritorio(); 
    } catch (error) {
        console.error("Error al mover tropas:", error);
        alert(`No se pudo mover tropas: \n- ${error.message}`);
    }
}

async function procesarAtaque(territorioDestino) {
    ocultarPanel('panel-atacar');
    modoAtacarActivo = false;

    if (territorioOrigenMover.id === territorioDestino.id) {
        alert("El territorio destino debe ser distinto al de origen.");
        deseleccionarTerritorio();
        return;
    }
    if (territorioDestino.pais_duenio_id === estadoJuego.partida.turno_actual) {
        alert("Solo podés atacar territorios enemigos.");
        deseleccionarTerritorio();
        return;
    }

    const maximoAtacantes = (territorioOrigenMover.tropas_actuales || 0) - 1;
    if (maximoAtacantes <= 0) {
        alert("Necesitás al menos 2 tropas en el territorio de origen para atacar.");
        deseleccionarTerritorio();
        return;
    }

    opcionesAtaqueActuales = obtenerOpcionesDesdeTerritorio(territorioOrigenMover);
    if (!opcionesAtaqueActuales.length) {
        alert("No hay tropas disponibles para atacar.");
        deseleccionarTerritorio();
        return;
    }

    territorioDestinoAtaque = territorioDestino;
    seleccionAtaque = new Map(opcionesAtaqueActuales.map((item) => [item.id_tipo_tropa, 0]));
    abrirModalAtaque(territorioOrigenMover, territorioDestinoAtaque, maximoAtacantes);
}

function verificarYMostrarVictoria() {
    if (!estadoJuego || !estadoJuego.territorios || !estadoJuego.paises) return;

    const dueniosUnicos = new Set(
        estadoJuego.territorios
            .map(t => t.pais_duenio_id)
            .filter(id => id !== null && id !== undefined)
    );

    const esPartidaFinalizada = estadoJuego.partida?.estado === 'finalizada' || dueniosUnicos.size === 1;

    if (esPartidaFinalizada && dueniosUnicos.size > 0) {
        const ganadorId = estadoJuego.partida?.ganador_pais_id || Array.from(dueniosUnicos)[0];
        const paisGanador = estadoJuego.paises.find(p => p.pais_id === ganadorId || p.id === ganadorId);
        const nombreGanador = paisGanador ? (paisGanador.nombre || paisGanador.pais_nombre) : `País #${ganadorId}`;

        mostrarModalVictoria(nombreGanador);
    }
}

function mostrarModalVictoria(nombreGanador) {
    const modal = document.getElementById('modal-victoria');
    const mensaje = document.getElementById('victoria-mensaje');
    if (mensaje) {
        mensaje.textContent = `¡${nombreGanador} ha conquistado la totalidad de los territorios y se consagra como la única civilización victoriosa!`;
    }
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        modal.style.display = 'flex';
    }
}

function actualizarInfoTurno() {
    const info = document.getElementById('turno-actual-info');
    const presupuestoInfo = document.getElementById('presupuesto-info');
    if (info && estadoJuego && estadoJuego.partida && estadoJuego.paises) {
        const paisActivo = estadoJuego.paises.find(p => p.pais_id === estadoJuego.partida.turno_actual || p.id === estadoJuego.partida.turno_actual);
        const nombrePais = paisActivo ? (paisActivo.nombre || paisActivo.pais_nombre) : `País #${estadoJuego.partida.turno_actual}`;
        const movsUsados = estadoJuego.partida?.movimientos_realizados || 0;
        info.innerHTML = `Turno de: <strong>${nombrePais}</strong><br><span style="font-size:11px; opacity:0.9;">Acciones del turno: ${movsUsados}/2</span>`;

        if (presupuestoInfo) {
            const presupuesto = Number.isInteger(paisActivo?.presupuesto_fortificacion)
                ? paisActivo.presupuesto_fortificacion
                : 0;
            presupuestoInfo.textContent = `Presupuesto de fortificación acumulado: ${presupuesto} pts`;
        }
    }
}

async function manejarPasarTurno() {
    try {
        const data = await apiPasarTurno(partidaId);
        estadoJuego = data.estado;
        
        if (data.botLogs && data.botLogs.length > 0) {
            let logText = `🤖 ACCIONES DE LAS IAs ESTE TURNO:\n`;

            data.botLogs.forEach((bot, index) => {
                logText += `\n----------------------------------------\n`;
                logText += `📌 ${index + 1}. TURNO DE: ${bot.botNombre.toUpperCase()}\n`;

                if (bot.deployments && bot.deployments.length > 0) {
                    const totalRefuerzos = bot.deployments.reduce((a, b) => a + b.cantidad, 0);
                    logText += `  • Refuerzos: Desplegó ${totalRefuerzos} tropas.\n`;
                }

                if (bot.combats && bot.combats.length > 0) {
                    logText += `  • Combates realizados:\n`;
                    bot.combats.forEach(c => {
                        logText += `    - Atacó sector #${c.destino_id} con ${c.tropas_atacantes} tropas: ${c.attackerWins ? '¡CONQUISTADO! 🚩' : 'REPELIDO 🛡️'}\n`;
                    });
                } else {
                    logText += `  • Combates: Decidió no atacar este turno.\n`;
                }
            });

            alert(logText);
        }

        dibujarGrafo(estadoJuego.territorios, estadoJuego.fronteras);
        actualizarInfoTurno();
        deseleccionarTerritorio();
        verificarYMostrarVictoria();
    } catch (error) {
        console.error("Error al pasar turno:", error);
        alert(`No se pudo pasar de turno:\n- ${error.message}`);
    }
}

//LLAMADAS A LA API (FETCH)
const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
    ? 'http://localhost:8000'
    : window.location.origin.replace('frontend', 'servidor');

async function cargarYRenderizarMapa(partidaId) {
    try {
        const respuesta = await fetch(`${API_BASE}/api/partidas/${partidaId}/estado`);
        if (!respuesta.ok) throw new Error(`Error de red: ${respuesta.status}`);
        
        estadoJuego = await respuesta.json();
        console.log("Estado de la partida:", estadoJuego);
        dibujarGrafo(estadoJuego.territorios, estadoJuego.fronteras);
        actualizarInfoTurno();
        verificarYMostrarVictoria();
    } catch (error) {
        console.error("Error al cargar el mapa:", error);
    }
}

async function apiReforzarTerritorio(idPartida, territorioId, composicion) {
    const respuesta = await fetch(`${API_BASE}/api/partidas/${idPartida}/desplegar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ territorio_id: territorioId, composicion })
    });
    return procesarRespuestaApi(respuesta);
}

async function apiMoverTropas(idPartida, origenId, destinoId, composicion) {
    const respuesta = await fetch(`${API_BASE}/api/partidas/${idPartida}/mover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origen_id: origenId, destino_id: destinoId, composicion })
    });
    return procesarRespuestaApi(respuesta);
}

async function apiAtacar(idPartida, origenId, destinoId, composicionAtacante) {
    const respuesta = await fetch(`${API_BASE}/api/partidas/${idPartida}/atacar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origen_id: origenId, destino_id: destinoId, tropas_atacantes: composicionAtacante })
    });
    return procesarRespuestaApi(respuesta);
}

async function apiPasarTurno(idPartida) {
    const respuesta = await fetch(`${API_BASE}/api/partidas/${idPartida}/pasar-turno`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });
    return procesarRespuestaApi(respuesta);
}

async function procesarRespuestaApi(respuesta) {
    const data = await respuesta.json();
    if (!respuesta.ok) {
        const mensajeError = data.errors ? data.errors.join("\n- ") : (data.error || "Error desconocido");
        throw new Error(mensajeError);
    }
    return data;
}


//DIBUJADO DEL MAPA SVG
function dibujarGrafo(territorios, fronteras) {
    const svg = document.getElementById('lienzo-mapa');
    svg.innerHTML = ''; 
    const tooltip = document.getElementById("tooltip");
    ultimoMapa = { territorios, fronteras };

    svg.onmousemove = (event) => {
        tooltip.style.left = `${event.clientX + 15}px`;
        tooltip.style.top = `${event.clientY + 15}px`;
    };

    //Calculo dinamico del ViewBox para centrar el contenido dentro de la pantalla
    const coordXValues = territorios.map(t => t.coord_x);
    const coordYValues = territorios.map(t => t.coord_y);

    const minCoordX = Math.min(...coordXValues);
    const minCoordY = Math.min(...coordYValues);
    const maxCoordX = Math.max(...coordXValues);
    const maxCoordY = Math.max(...coordYValues);

    const anchoTotal = Math.max(ESCALA, (maxCoordX - minCoordX) * ESCALA) + (OFFSET_X * 2);
    const altoTotal = Math.max(ESCALA, (maxCoordY - minCoordY) * ESCALA) + (OFFSET_Y * 2);

    svg.setAttribute('viewBox', `0 0 ${anchoTotal} ${altoTotal}`);

    //Dibujar fronteras
    fronteras.forEach(frontera => {
        const origen = territorios.find(t => t.id === frontera.id_territorio_origen);
        const destino = territorios.find(t => t.id === frontera.id_territorio_destino);

        if (origen && destino) {
            const linea = document.createElementNS(SVG_NS, 'line');
            linea.setAttribute('x1', ((origen.coord_x - minCoordX) * ESCALA) + OFFSET_X);
            linea.setAttribute('y1', ((origen.coord_y - minCoordY) * ESCALA) + OFFSET_Y);
            linea.setAttribute('x2', ((destino.coord_x - minCoordX) * ESCALA) + OFFSET_X);
            linea.setAttribute('y2', ((destino.coord_y - minCoordY) * ESCALA) + OFFSET_Y);
            
            linea.setAttribute('stroke', getComputedStyle(document.body).getPropertyValue('--line-stroke').trim() || '#475569'); 
            linea.setAttribute('stroke-width', '4');
            svg.appendChild(linea);
        }
    });

    //Dibujar territorios
    territorios.forEach(territorio => {
        const centroX = ((territorio.coord_x - minCoordX) * ESCALA) + OFFSET_X;
        const centroY = ((territorio.coord_y - minCoordY) * ESCALA) + OFFSET_Y;
        const esElSeleccionado = territorioSeleccionado && territorioSeleccionado.id === territorio.id;

        const grupo = document.createElementNS(SVG_NS, 'g');
        grupo.classList.add('cursor-pointer', 'transition-transform', 'hover:scale-110');
        grupo.style.transformOrigin = `${centroX}px ${centroY}px`;

        const areaHover = document.createElementNS(SVG_NS, 'circle');
        areaHover.setAttribute('cx', centroX);
        areaHover.setAttribute('cy', centroY);
        areaHover.setAttribute('r', '55');
        areaHover.setAttribute('fill', 'transparent');

        const bordeTerreno = document.createElementNS(SVG_NS, 'circle');
        bordeTerreno.setAttribute('cx', centroX);
        bordeTerreno.setAttribute('cy', centroY);
        bordeTerreno.setAttribute('r', '43');
        bordeTerreno.setAttribute('fill', territorio.terreno_color || '#0f172a');
        bordeTerreno.style.transition = 'r 150ms ease';

        const separadorBorde = document.createElementNS(SVG_NS, 'circle');
        separadorBorde.setAttribute('cx', centroX);
        separadorBorde.setAttribute('cy', centroY);
        separadorBorde.setAttribute('r', '37');
        const fondoActual = document.body.getAttribute('data-theme') === 'light' ? '#c79b73' : '#0f172a';
        separadorBorde.setAttribute('fill', fondoActual);
        separadorBorde.style.transition = 'r 150ms ease';
        
        const circulo = document.createElementNS(SVG_NS, 'circle');
        circulo.setAttribute('cx', centroX);
        circulo.setAttribute('cy', centroY);
        circulo.setAttribute('r', '33'); 
        circulo.setAttribute('fill', territorio.pais_duenio_color || '#94a3b8'); 
        circulo.style.transition = 'r 150ms ease, fill 150ms ease';
        
        if (esElSeleccionado) {
            circulo.setAttribute('stroke', '#f59e0b');
            circulo.setAttribute('stroke-width', '8');
        } else {
            circulo.setAttribute('stroke', '#0f172a');
            circulo.setAttribute('stroke-width', '4');
        }

        const textoTropas = document.createElementNS(SVG_NS, 'text');
        textoTropas.setAttribute('x', centroX);
        textoTropas.setAttribute('y', centroY);
        textoTropas.setAttribute('text-anchor', 'middle');
        textoTropas.setAttribute('dominant-baseline', 'central');
        textoTropas.setAttribute('fill', 'white');
        textoTropas.setAttribute('font-weight', 'bold');
        textoTropas.setAttribute('font-family', 'sans-serif');
        textoTropas.setAttribute('font-size', '18px');
        textoTropas.setAttribute("pointer-events", "none");
        textoTropas.textContent = territorio.tropas_actuales;

       grupo.addEventListener('click', (e) => {
            e.stopPropagation();
            onTerritorioClickeado(territorio);
        });

        grupo.addEventListener("mouseenter", () => {
            tooltip.style.backgroundColor = territorio.pais_duenio_color || '#dde0e4';
            tooltip.style.borderColor = '#000000';
            tooltip.style.color = '#ffffff';
            tooltip.style.webkitTextStroke = '0.05px #000000';
            tooltip.style.textShadow = '1px 0 #000000, -1px 0 #000000, 0 1px #000000, 0 -1px #000000';
            bordeTerreno.setAttribute("r", "53");
            separadorBorde.setAttribute("r", "47");
            circulo.setAttribute("r", "43");
            tooltip.innerHTML = `
                <strong>País: ${territorio.pais_duenio_nombre || 'Neutral'}</strong><br>
                Tipo: ${territorio.tipo_terreno_nombre}<br>
                Tropas: ${territorio.tropas_actuales}<br>
                Composición: ${formatearComposicion(territorio.composicion_tropas)}
            `;
            tooltip.classList.remove("hidden");
        });

        grupo.addEventListener("mouseleave", () => {
            bordeTerreno.setAttribute("r", "43");
            separadorBorde.setAttribute("r", "37");
            circulo.setAttribute("r", "33");
            tooltip.innerHTML = "";
            tooltip.classList.add("hidden");
        });

        grupo.appendChild(areaHover);
        grupo.appendChild(bordeTerreno);
        grupo.appendChild(separadorBorde);
        grupo.appendChild(circulo);
        grupo.appendChild(textoTropas);
        svg.appendChild(grupo);
    });
}

function formatearComposicion(composicion) {
    if (!Array.isArray(composicion) || composicion.length === 0) {
        return "Sin tropas";
    }

    return composicion
        .filter((item) => Number.isInteger(item?.cantidad) && item.cantidad > 0)
        .map((item) => `${item.tipo || `Tipo #${item.id_tipo_tropa}`}: ${item.cantidad}`)
        .join(", ");
}

function actualizarSubtituloPanel(territorio) {
    const subtitulo = document.getElementById('panel-subtitulo');
    if (!subtitulo || !territorio) return;

    subtitulo.innerHTML = `Perteneciente a ${territorio.pais_duenio_nombre} (${territorio.tropas_actuales} tropas)<br><span style="font-size:11px; opacity:0.9;">${formatearComposicion(territorio.composicion_tropas)}</span>`;
}

function abrirModalRefuerzo(territorio, presupuestoDisponible) {
    const modal = document.getElementById('modal-refuerzo');
    const titulo = document.getElementById('refuerzo-titulo');
    const subtitulo = document.getElementById('refuerzo-subtitulo');
    const presupuesto = document.getElementById('refuerzo-presupuesto');
    if (!modal || !titulo || !subtitulo || !presupuesto) return;

    titulo.textContent = `Reforzar ${territorio.nombre || `Territorio #${territorio.id}`}`;
    subtitulo.textContent = `Seleccioná las tropas a comprar para ${territorio.pais_duenio_nombre}.`;
    presupuesto.textContent = `Presupuesto disponible: ${presupuestoDisponible} pts`;

    document.getElementById('panel-acciones').style.display = 'none';
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    modalRefuerzoAbierto = true;

    renderOpcionesRefuerzo();
    actualizarResumenRefuerzo();
}

function cerrarModalRefuerzo() {
    const modal = document.getElementById('modal-refuerzo');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    modalRefuerzoAbierto = false;

    if (territorioSeleccionado) {
        document.getElementById('panel-acciones').style.display = 'flex';
    }
}

function renderOpcionesRefuerzo() {
    const contenedor = document.getElementById('refuerzo-lista');
    if (!contenedor) return;

    if (!opcionesRefuerzoActuales.length) {
        contenedor.innerHTML = '<p class="text-sm text-slate-400">No hay tropas disponibles.</p>';
        return;
    }

    contenedor.innerHTML = opcionesRefuerzoActuales.map((opcion) => {
        const cantidad = seleccionRefuerzo.get(opcion.id_tipo_tropa) || 0;
        const costo = Number.isInteger(opcion.costo) ? opcion.costo : 1;
        const dadoMin = Number.isInteger(opcion.dado_min) ? opcion.dado_min : 1;
        const dadoMax = Number.isInteger(opcion.dado_max) ? opcion.dado_max : 6;
        return `
            <div class="rounded-lg border border-slate-700 bg-slate-950/70 p-3 space-y-2">
                <div>
                    <p class="text-sm font-bold text-slate-100">${opcion.tipo || `Tipo #${opcion.id_tipo_tropa}`}</p>
                    <p class="text-xs text-slate-400">Costo: ${costo} pts | Dado: ${dadoMin}-${dadoMax}</p>
                </div>
                <div class="flex items-center gap-2">
                    <button data-refuerzo-id="${opcion.id_tipo_tropa}" data-refuerzo-action="decrease" class="rounded bg-slate-700 px-3 py-1 text-sm font-bold hover:bg-slate-600">-</button>
                    <span class="min-w-[28px] text-center font-semibold">${cantidad}</span>
                    <button data-refuerzo-id="${opcion.id_tipo_tropa}" data-refuerzo-action="increase" class="rounded bg-slate-700 px-3 py-1 text-sm font-bold hover:bg-slate-600">+</button>
                </div>
            </div>
        `;
    }).join('');
}

function actualizarResumenRefuerzo() {
    const resumen = document.getElementById('refuerzo-resumen');
    if (!resumen) return;

    const composicion = construirComposicionRefuerzo();
    const totalTropas = totalComposicion(composicion);
    const costoTotal = calcularCostoComposicion(composicion, opcionesRefuerzoActuales);
    const disponible = obtenerPresupuestoFortificacion();
    resumen.textContent = `Seleccionado: ${totalTropas} tropas | Costo: ${costoTotal} pts | Disponible: ${disponible} pts`;
}

function manejarClickSelectorRefuerzo(event) {
    const boton = event.target.closest('button[data-refuerzo-id][data-refuerzo-action]');
    if (!boton) return;

    const idTipo = Number(boton.getAttribute('data-refuerzo-id'));
    const action = boton.getAttribute('data-refuerzo-action');
    if (!Number.isInteger(idTipo)) return;

    const valorActual = seleccionRefuerzo.get(idTipo) || 0;
    if (action === 'decrease') {
        seleccionRefuerzo.set(idTipo, Math.max(0, valorActual - 1));
        renderOpcionesRefuerzo();
        actualizarResumenRefuerzo();
        return;
    }

    if (action === 'increase') {
        const opcion = opcionesRefuerzoActuales.find((item) => item.id_tipo_tropa === idTipo);
        const costoUnitario = Number.isInteger(opcion?.costo) ? opcion.costo : 1;
        const composicionActual = construirComposicionRefuerzo();
        const costoActual = calcularCostoComposicion(composicionActual, opcionesRefuerzoActuales);
        const presupuesto = obtenerPresupuestoFortificacion();

        if ((costoActual + costoUnitario) > presupuesto) {
            alert("No alcanza el presupuesto para agregar esa tropa.");
            return;
        }

        seleccionRefuerzo.set(idTipo, valorActual + 1);
        renderOpcionesRefuerzo();
        actualizarResumenRefuerzo();
    }
}

function construirComposicionRefuerzo() {
    return Array.from(seleccionRefuerzo.entries())
        .filter(([, cantidad]) => Number.isInteger(cantidad) && cantidad > 0)
        .map(([id_tipo_tropa, cantidad]) => ({ id_tipo_tropa, cantidad }));
}

async function confirmarCompraRefuerzo() {
    if (!territorioSeleccionado) {
        cerrarModalRefuerzo();
        return;
    }

    const composicion = construirComposicionRefuerzo();
    if (!composicion.length) {
        alert("Debés seleccionar al menos una tropa para confirmar la compra.");
        return;
    }

    try {
        const nuevoEstado = await apiReforzarTerritorio(partidaId, territorioSeleccionado.id, composicion);
        estadoJuego = nuevoEstado;
        territorioSeleccionado = estadoJuego.territorios.find(t => t.id === territorioSeleccionado.id);

        if (territorioSeleccionado) {
            actualizarSubtituloPanel(territorioSeleccionado);
        }

        cerrarModalRefuerzo();
        dibujarGrafo(estadoJuego.territorios, estadoJuego.fronteras);
        actualizarInfoTurno();
        deseleccionarTerritorio();
    } catch (error) {
        console.error("Error al confirmar refuerzo:", error);
        alert(`No se pudo reforzar:\n- ${error.message}`);
    }
}

function abrirModalAtaque(origen, destino, maximoAtacantes) {
    const modal = document.getElementById('modal-ataque');
    const titulo = document.getElementById('ataque-titulo');
    const subtitulo = document.getElementById('ataque-subtitulo');
    const limite = document.getElementById('ataque-limite');
    if (!modal || !titulo || !subtitulo || !limite) return;

    titulo.textContent = `Atacar ${destino.nombre || `Territorio #${destino.id}`}`;
    subtitulo.textContent = `Desde ${origen.nombre || `Territorio #${origen.id}`} hacia ${destino.pais_duenio_nombre || 'enemigo'}.`;
    limite.textContent = `Máximo a enviar: ${maximoAtacantes} tropas`;

    document.getElementById('panel-acciones').style.display = 'none';
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    modalAtaqueAbierto = true;

    renderOpcionesAtaque();
    actualizarResumenAtaque();
}

function cerrarModalAtaque() {
    const modal = document.getElementById('modal-ataque');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    modalAtaqueAbierto = false;
    territorioDestinoAtaque = null;

    if (territorioSeleccionado) {
        document.getElementById('panel-acciones').style.display = 'flex';
    }
}

function renderOpcionesAtaque() {
    const contenedor = document.getElementById('ataque-lista');
    if (!contenedor) return;

    if (!opcionesAtaqueActuales.length) {
        contenedor.innerHTML = '<p class="text-sm text-slate-400">No hay tropas disponibles para atacar.</p>';
        return;
    }

    contenedor.innerHTML = opcionesAtaqueActuales.map((opcion) => {
        const cantidad = seleccionAtaque.get(opcion.id_tipo_tropa) || 0;
        const disponibles = Number.isInteger(opcion.disponibles) ? opcion.disponibles : 0;
        const costo = Number.isInteger(opcion.costo) ? opcion.costo : 1;
        const dadoMin = Number.isInteger(opcion.dado_min) ? opcion.dado_min : 1;
        const dadoMax = Number.isInteger(opcion.dado_max) ? opcion.dado_max : 6;
        return `
            <div class="rounded-lg border border-slate-700 bg-slate-950/70 p-3 space-y-2">
                <div>
                    <p class="text-sm font-bold text-slate-100">${opcion.tipo || `Tipo #${opcion.id_tipo_tropa}`}</p>
                    <p class="text-xs text-slate-400">Disponibles: ${disponibles} | Costo: ${costo} | Dado: ${dadoMin}-${dadoMax}</p>
                </div>
                <div class="flex items-center gap-2">
                    <button data-ataque-id="${opcion.id_tipo_tropa}" data-ataque-action="decrease" class="rounded bg-slate-700 px-3 py-1 text-sm font-bold hover:bg-slate-600">-</button>
                    <span class="min-w-[28px] text-center font-semibold">${cantidad}</span>
                    <button data-ataque-id="${opcion.id_tipo_tropa}" data-ataque-action="increase" class="rounded bg-slate-700 px-3 py-1 text-sm font-bold hover:bg-slate-600">+</button>
                </div>
            </div>
        `;
    }).join('');
}

function construirComposicionAtaque() {
    return Array.from(seleccionAtaque.entries())
        .filter(([, cantidad]) => Number.isInteger(cantidad) && cantidad > 0)
        .map(([id_tipo_tropa, cantidad]) => ({ id_tipo_tropa, cantidad }));
}

function actualizarResumenAtaque() {
    const resumen = document.getElementById('ataque-resumen');
    if (!resumen) return;

    const composicion = construirComposicionAtaque();
    const total = totalComposicion(composicion);
    const maximo = Math.max(0, (territorioOrigenMover?.tropas_actuales || 0) - 1);
    resumen.textContent = `Seleccionado: ${total} tropas | Máximo permitido: ${maximo}`;
}

function manejarClickSelectorAtaque(event) {
    const boton = event.target.closest('button[data-ataque-id][data-ataque-action]');
    if (!boton) return;

    const idTipo = Number(boton.getAttribute('data-ataque-id'));
    const action = boton.getAttribute('data-ataque-action');
    if (!Number.isInteger(idTipo)) return;

    const valorActual = seleccionAtaque.get(idTipo) || 0;
    if (action === 'decrease') {
        seleccionAtaque.set(idTipo, Math.max(0, valorActual - 1));
        renderOpcionesAtaque();
        actualizarResumenAtaque();
        return;
    }

    if (action === 'increase') {
        const opcion = opcionesAtaqueActuales.find((item) => item.id_tipo_tropa === idTipo);
        const disponibles = Number.isInteger(opcion?.disponibles) ? opcion.disponibles : 0;
        if (valorActual >= disponibles) {
            alert("No hay más tropas disponibles de este tipo.");
            return;
        }

        const composicionActual = construirComposicionAtaque();
        const totalActual = totalComposicion(composicionActual);
        const maximo = Math.max(0, (territorioOrigenMover?.tropas_actuales || 0) - 1);
        if ((totalActual + 1) > maximo) {
            alert("Debés dejar al menos 1 tropa en el territorio de origen.");
            return;
        }

        seleccionAtaque.set(idTipo, valorActual + 1);
        renderOpcionesAtaque();
        actualizarResumenAtaque();
    }
}

async function confirmarAtaqueModal() {
    if (!territorioOrigenMover || !territorioDestinoAtaque) {
        cerrarModalAtaque();
        return;
    }

    const composicion = construirComposicionAtaque();
    const total = totalComposicion(composicion);
    const maximo = Math.max(0, (territorioOrigenMover?.tropas_actuales || 0) - 1);
    if (total <= 0) {
        alert("Debés seleccionar al menos una tropa para atacar.");
        return;
    }
    if (total > maximo) {
        alert("La cantidad seleccionada excede el máximo permitido para atacar.");
        return;
    }

    try {
        const resultadoAtaque = await apiAtacar(partidaId, territorioOrigenMover.id, territorioDestinoAtaque.id, composicion);
        estadoJuego = resultadoAtaque.estado;

        const res = resultadoAtaque.combatResult;
        if (res) {
            const tiradasAtaque = res.attackRolls ? res.attackRolls.join(", ") : "";
            const tiradasDefensa = res.defenseRolls ? res.defenseRolls.join(", ") : "";
            const modAtkStr = res.modAttackUsed !== 1 ? ` (Mod. Terreno: x${res.modAttackUsed})` : "";
            const modDefStr = res.modDefenseUsed !== 1 ? ` (Mod. Terreno: x${res.modDefenseUsed})` : "";

            const textoResultado = res.attackerWins
                ? `⚔️ ¡VICTORIA DE ATAQUE!\n\n- ATACANTE: Dados [${tiradasAtaque}] -> Suma: ${res.totalAttackBase}${modAtkStr} = TOTAL ${res.totalAttack}\n- DEFENSOR: Dados [${tiradasDefensa}] -> Suma: ${res.totalDefenseBase}${modDefStr} = TOTAL ${res.totalDefense}\n\n¡Conquistaste el territorio!`
                : `🛡️ DERROTA EN EL ATAQUE\n\n- ATACANTE: Dados [${tiradasAtaque}] -> Suma: ${res.totalAttackBase}${modAtkStr} = TOTAL ${res.totalAttack}\n- DEFENSOR: Dados [${tiradasDefensa}] -> Suma: ${res.totalDefenseBase}${modDefStr} = TOTAL ${res.totalDefense}\n\nEl defensor repelió el asalto.`;
            alert(textoResultado);
        }

        if (resultadoAtaque.victory?.isGameOver) {
            alert(`🏆 ¡PARTIDA FINALIZADA!\n\nGanó la civilización ID: ${resultadoAtaque.victory.winnerCountryId}`);
        }

        cerrarModalAtaque();
        dibujarGrafo(estadoJuego.territorios, estadoJuego.fronteras);
        actualizarInfoTurno();
        deseleccionarTerritorio();
        verificarYMostrarVictoria();
    } catch (error) {
        console.error("Error al atacar:", error);
        alert(`No se pudo atacar: \n- ${error.message}`);
    }
}

function obtenerOpcionesDesdeTerritorio(territorio) {
    const composicion = Array.isArray(territorio?.composicion_tropas) ? territorio.composicion_tropas : [];
    return composicion
        .filter((item) => Number.isInteger(item?.id_tipo_tropa) && Number.isInteger(item?.cantidad) && item.cantidad > 0)
        .map((item) => ({
            id_tipo_tropa: item.id_tipo_tropa,
            tipo: item.tipo || `Tipo #${item.id_tipo_tropa}`,
            dado_min: item.dado_min,
            dado_max: item.dado_max,
            costo: item.costo,
            disponibles: item.cantidad
        }));
}

async function obtenerOpcionesRefuerzo() {
    if (!catalogoTropas.length) {
        catalogoTropas = await obtenerCatalogoTropas();
    }

    return catalogoTropas
        .filter((item) => Number.isInteger(item?.id))
        .map((item) => ({
            id_tipo_tropa: item.id,
            tipo: item.tipo || `Tipo #${item.id}`,
            dado_min: item.dado_min,
            dado_max: item.dado_max,
            costo: item.costo,
            disponibles: null
        }));
}

async function obtenerCatalogoTropas() {
    const respuesta = await fetch(`${API_BASE}/api/tipos-tropas`);
    return procesarRespuestaApi(respuesta);
}

function calcularPuntosEconomia(economia) {
    const valor = Number(economia);
    if (!Number.isFinite(valor) || valor <= 1) return 1;
    if (valor <= 3) return 2;
    if (valor <= 5) return 3;
    if (valor <= 7) return 4;
    if (valor <= 9) return 5;
    return 6;
}

function obtenerPresupuestoFortificacion() {
    const turnoActual = estadoJuego?.partida?.turno_actual;
    const paisActivo = estadoJuego?.paises?.find((p) => (p.pais_id === turnoActual || p.id === turnoActual));
    if (Number.isInteger(paisActivo?.presupuesto_fortificacion)) {
        return paisActivo.presupuesto_fortificacion;
    }
    return 0;
}

function armarMensajeComposicion(titulo, opciones, maximoTotal, presupuestoMaximo) {
    const encabezado = [titulo, ""];
    const detalle = opciones.map((item) => {
        const disponiblesTxt = Number.isInteger(item.disponibles) ? ` | disponibles: ${item.disponibles}` : "";
        const dadosTxt = Number.isInteger(item.dado_min) && Number.isInteger(item.dado_max)
            ? ` | dado: ${item.dado_min}-${item.dado_max}`
            : "";
        const costoTxt = Number.isInteger(item.costo) ? ` | costo: ${item.costo}` : "";
        return `- ${item.id_tipo_tropa}: ${item.tipo}${disponiblesTxt}${dadosTxt}${costoTxt}`;
    });

    const reglas = [
        "",
        `Formato: ${FORMATO_COMPOSICION_EJEMPLO}`,
        "Ingresá pares id:cantidad separados por coma."
    ];

    if (Number.isInteger(maximoTotal)) {
        reglas.push(`Máximo total permitido: ${maximoTotal} tropas.`);
    }
    if (Number.isInteger(presupuestoMaximo)) {
        reglas.push(`Presupuesto máximo: ${presupuestoMaximo} pts.`);
    }

    return [...encabezado, ...detalle, ...reglas].join("\n");
}

function parsearComposicionIngresada(input, opciones) {
    const disponiblesPorId = new Map(opciones.map((item) => [item.id_tipo_tropa, item]));
    const acumulado = new Map();
    const pares = input.split(",").map((item) => item.trim()).filter(Boolean);

    if (!pares.length) {
        throw new Error("No ingresaste ninguna tropa.");
    }

    for (const par of pares) {
        const [idRaw, cantidadRaw] = par.split(":").map((x) => x && x.trim());
        const id = Number(idRaw);
        const cantidad = Number(cantidadRaw);

        if (!Number.isInteger(id) || !Number.isInteger(cantidad) || cantidad <= 0) {
            throw new Error(`Formato inválido en '${par}'. Debe ser id:cantidad.`);
        }
        if (!disponiblesPorId.has(id)) {
            throw new Error(`El tipo de tropa ${id} no existe en esta acción.`);
        }

        acumulado.set(id, (acumulado.get(id) || 0) + cantidad);
    }

    const composicion = Array.from(acumulado.entries())
        .map(([id_tipo_tropa, cantidad]) => ({ id_tipo_tropa, cantidad }));

    for (const item of composicion) {
        const opcion = disponiblesPorId.get(item.id_tipo_tropa);
        if (Number.isInteger(opcion.disponibles) && item.cantidad > opcion.disponibles) {
            throw new Error(`No hay suficientes ${opcion.tipo}. Máximo disponible: ${opcion.disponibles}.`);
        }
    }

    return composicion;
}

function calcularCostoComposicion(composicion, opciones) {
    const costos = new Map(opciones.map((item) => [item.id_tipo_tropa, Number.isInteger(item.costo) ? item.costo : 1]));
    return composicion.reduce((acc, item) => acc + ((costos.get(item.id_tipo_tropa) || 1) * item.cantidad), 0);
}

function totalComposicion(composicion) {
    return composicion.reduce((sum, item) => sum + item.cantidad, 0);
}

async function solicitarComposicionPorPrompt({ titulo, opciones, maximoTotal, presupuestoMaximo }) {
    if (!opciones.length) {
        alert("No hay tipos de tropas disponibles para esta acción.");
        return null;
    }

    const mensaje = armarMensajeComposicion(titulo, opciones, maximoTotal, presupuestoMaximo);
    const ingreso = prompt(mensaje);
    if (!ingreso || !ingreso.trim()) {
        return null;
    }

    let composicion;
    try {
        composicion = parsearComposicionIngresada(ingreso.trim(), opciones);
    } catch (error) {
        alert(error.message);
        return null;
    }

    const total = totalComposicion(composicion);
    if (total <= 0) {
        alert("Debés indicar al menos una tropa.");
        return null;
    }

    if (Number.isInteger(maximoTotal) && total > maximoTotal) {
        alert(`Excediste el máximo permitido (${maximoTotal} tropas).`);
        return null;
    }

    if (Number.isInteger(presupuestoMaximo)) {
        const costo = calcularCostoComposicion(composicion, opciones);
        if (costo > presupuestoMaximo) {
            alert(`La composición cuesta ${costo} pts y supera el presupuesto de ${presupuestoMaximo} pts.`);
            return null;
        }
    }

    return composicion;
}

function manejarSalirAlMenu() {
    const confirmar = confirm("¿Seguro que querés salir al menú principal? Se perderá la vista actual de la partida.");
    if (!confirmar) return;
    window.location.href = "index.html";
}