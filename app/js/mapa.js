const SVG_NS = "http://www.w3.org/2000/svg";

const ESCALA = 150; 
const OFFSET_X = 100;
const OFFSET_Y = 100;

let estadoJuego = null;
let territorioSeleccionado = null;
let modoMoverActivo = false;
let territorioOrigenMover = null;

document.addEventListener('DOMContentLoaded', () => {
    const parametros = new URLSearchParams(window.location.search);
    const partidaId = parametros.get('id');

    if (partidaId) {
        cargarYRenderizarMapa(partidaId);
        configurarEscuchadoresTeclado();
    } else {
        alert("No se encontró el ID de la partida. Volvé al menú principal.");
        window.location.href = "index.html";
    }
});

async function cargarYRenderizarMapa(partidaId) {
    try {
        const respuesta = await fetch(`http://localhost:8000/api/partidas/${partidaId}/estado`);
        
        if (!respuesta.ok) {
            throw new Error(`Error de red: ${respuesta.status}`);
        }

        estadoJuego = await respuesta.json();
        console.log("Estado de la partida:", estadoJuego);
        
        dibujarGrafo(estadoJuego.territorios, estadoJuego.fronteras);
        
    } catch (error) {
        console.error("Error al cargar el mapa:", error);
    }
}

function dibujarGrafo(territorios, fronteras) {
    const svg = document.getElementById('lienzo-mapa');
    svg.innerHTML = ''; 
    const tooltip = document.getElementById("tooltip");

    svg.addEventListener("mousemove", (event) => {
        tooltip.style.left = `${event.clientX + 15}px`;
        tooltip.style.top = `${event.clientY + 15}px`;
    });

    //Calculo dinamico ViewBox
    let maxCoordX = 0;
    let maxCoordY = 0;
    territorios.forEach(t => {
        if (t.coord_x > maxCoordX) maxCoordX = t.coord_x;
        if (t.coord_y > maxCoordY) maxCoordY = t.coord_y;
    });

    const anchoTotal = (maxCoordX * ESCALA) + (OFFSET_X * 2);
    const altoTotal = (maxCoordY * ESCALA) + (OFFSET_Y * 2);
    svg.setAttribute('viewBox', `0 0 ${anchoTotal} ${altoTotal}`);

    //Dibujar fronteras
    fronteras.forEach(frontera => {
        const origen = territorios.find(t => t.id === frontera.id_territorio_origen);
        const destino = territorios.find(t => t.id === frontera.id_territorio_destino);

        if (origen && destino) {
            const linea = document.createElementNS(SVG_NS, 'line');
            linea.setAttribute('x1', (origen.coord_x * ESCALA) + OFFSET_X);
            linea.setAttribute('y1', (origen.coord_y * ESCALA) + OFFSET_Y);
            linea.setAttribute('x2', (destino.coord_x * ESCALA) + OFFSET_X);
            linea.setAttribute('y2', (destino.coord_y * ESCALA) + OFFSET_Y);
            linea.setAttribute('stroke', '#475569'); 
            linea.setAttribute('stroke-width', '4');
            svg.appendChild(linea);
        }
    });

    //Dibujar territorios
    territorios.forEach(territorio => {
        const centroX = (territorio.coord_x * ESCALA) + OFFSET_X;
        const centroY = (territorio.coord_y * ESCALA) + OFFSET_Y;
        const esElSeleccionado = territorioSeleccionado && territorioSeleccionado.id === territorio.id;

        const grupo = document.createElementNS(SVG_NS, 'g');
        grupo.classList.add('cursor-pointer', 'transition-transform', 'hover:scale-110');
        
        const circulo = document.createElementNS(SVG_NS, 'circle');
        circulo.setAttribute('cx', centroX);
        circulo.setAttribute('cy', centroY);
        circulo.setAttribute('r', '35'); 
        circulo.setAttribute('fill', territorio.pais_duenio_color || '#94a3b8'); 
        
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

        //Tooltip
        grupo.addEventListener("mouseenter", () => {
            circulo.setAttribute("fill", "#4F4F4F");
            tooltip.innerHTML = `
                <strong>País: ${territorio.pais_duenio_nombre || 'Neutral'}</strong><br>
                Tipo: ${territorio.tipo_terreno_nombre}
            `;
            tooltip.classList.remove("hidden");
        });

        grupo.addEventListener("mouseleave", () => {
            circulo.setAttribute("fill", territorio.pais_duenio_color || "#94a3b8");
            tooltip.innerHTML = "";
            tooltip.classList.add("hidden");
        });

        grupo.appendChild(circulo);
        grupo.appendChild(textoTropas);
        svg.appendChild(grupo);
    });
}

function seleccionarTerritorio(territorio) {
    territorioSeleccionado = territorio;
    const panel = document.getElementById('panel-acciones');
    const titulo = document.getElementById('panel-titulo');
    const subtitulo = document.getElementById('panel-subtitulo');
    titulo.textContent = territorio.nombre || `Territorio #${territorio.id}`;
    subtitulo.textContent = `Perteneciente a ${territorio.pais_duenio_nombre} (${territorio.tropas_actuales} tropas)`;
    panel.style.display = 'flex';
    dibujarGrafo(estadoJuego.territorios, estadoJuego.fronteras);
}

function deseleccionarTerritorio() {
    territorioSeleccionado = null;
    const panel = document.getElementById('panel-acciones');
    panel.style.display = 'none';
    dibujarGrafo(estadoJuego.territorios, estadoJuego.fronteras);
}

function configurarEscuchadoresTeclado() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && territorioSeleccionado) {
            deseleccionarTerritorio();
        }
    });
}

//Funcion comunicarse con API
async function apiReforzarTerritorio(partidaId, territorioId) {
    const respuesta = await fetch(`http://localhost:8000/api/partidas/${partidaId}/desplegar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ territorio_id: territorioId })
    });
    const data = await respuesta.json();
    
    if (!respuesta.ok) {
        const mensajeError = data.errors ? data.errors.join("\n- ") : (data.error || "Error desconocido");
        throw new Error(mensajeError);
    }
    
    return data;
}

//Actualizar la interfaz y el estado
function actualizarPantallaRefuerzo(nuevoEstado) {
    estadoJuego = nuevoEstado;
    territorioSeleccionado = estadoJuego.territorios.find(t => t.id === territorioSeleccionado.id);

    const subtitulo = document.getElementById('panel-subtitulo');
    subtitulo.textContent = `Perteneciente a ${territorioSeleccionado.pais_duenio_nombre} (${territorioSeleccionado.tropas_actuales} tropas)`;
    dibujarGrafo(estadoJuego.territorios, estadoJuego.fronteras);
}

document.addEventListener('DOMContentLoaded', () => {
    const btnReforzar = document.getElementById('btn-reforzar');
    if (btnReforzar) {
        btnReforzar.addEventListener('click', async () => {
            if (!territorioSeleccionado) return;
            try {
                const partidaId = new URLSearchParams(window.location.search).get('id');
                const nuevoEstado = await apiReforzarTerritorio(partidaId, territorioSeleccionado.id);
                actualizarPantallaRefuerzo(nuevoEstado);

            } catch (error) {
                console.error("Error al reforzar:", error);
                alert(`No se pudo reforzar:\n- ${error.message}`);
            }
        });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const btnMover = document.getElementById('btn-mover');
    const panelMover = document.getElementById('panel-mover-tropas');
    const panelAcciones = document.getElementById('panel-acciones');

    if (btnMover) {
        btnMover.addEventListener('click', () => {
            if (!territorioSeleccionado) return;
            modoMoverActivo = true;
            territorioOrigenMover = territorioSeleccionado;
            
            panelMover.classList.remove('hidden');
            panelMover.style.display = 'block';
            
            if (panelAcciones) {
                panelAcciones.style.display = 'none';
            }
        });
    }
    document.addEventListener('mousemove', (e) => {
        if (modoMoverActivo) {
            panelMover.style.left = (e.pageX + 15) + 'px';
            panelMover.style.top = (e.pageY + 15) + 'px';
        }
    });
});

async function onTerritorioClickeado(territorioDestino) {
    //Modo mover tropas
    if (modoMoverActivo) {
        modoMoverActivo = false;
        const panelMover = document.getElementById('panel-mover-tropas');
        panelMover.classList.add('hidden');
        panelMover.style.display = 'none';

        if (territorioOrigenMover.id === territorioDestino.id) {
            alert("El territorio destino debe ser distinto al de origen.");
            return;
        }
        if (territorioDestino.pais_duenio_id !== estadoJuego.partida.turno_actual) {
            alert("Solo podés mover tropas hacia tus propios territorios.");
            return;
        }
        const cantidadStr = prompt(`¿Cuántas tropas querés mover de ${territorioOrigenMover.nombre || 'origen'} a ${territorioDestino.nombre || 'destino'}?`);
        if (cantidadStr === null || cantidadStr.trim() === '') {
            deseleccionarTerritorio();
            return;
        }

        const cantidad = parseInt(cantidadStr, 10);
        if (isNaN(cantidad) || cantidad <= 0 || cantidad >= territorioOrigenMover.tropas_actuales) {
            alert("Cantidad inválida. Recordá que debés dejar al menos 1 tropa en el territorio de origen.");
            return;
        }
        try {
            const partidaId = new URLSearchParams(window.location.search).get('id');
            const nuevoEstado = await apiMoverTropas(partidaId, territorioOrigenMover.id, territorioDestino.id, cantidad);
            
            estadoJuego = nuevoEstado;
            deseleccionarTerritorio(); 
            
        } catch (error) {
            console.error("Error al mover tropas:", error);
            alert(`No se pudo mover tropas: \n- ${error.message}`);
        }
        return; 
    }
    //Seleccion normal de territorio
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

async function apiMoverTropas(partidaId, origenId, destinoId, cantidad) {
    const respuesta = await fetch(`http://localhost:8000/api/partidas/${partidaId}/mover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            origen_id: origenId,
            destino_id: destinoId,
            tropas: cantidad
        })
    });
    const data = await respuesta.json();
    
    if (!respuesta.ok) {
        const mensajeError = data.errors ? data.errors.join("\n- ") : (data.error || "Error desconocido");
        throw new Error(mensajeError);
    }
    return data;
}