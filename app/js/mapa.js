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

document.addEventListener('DOMContentLoaded', () => {
    const parametros = new URLSearchParams(window.location.search);
    const partidaId = parametros.get('id');
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

    if (partidaId) {
        cargarYRenderizarMapa(partidaId);
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
  
        const estado = await respuesta.json();
        
        console.log("Datos del estado recibidos:", estado);
        
        dibujarGrafo(estado.territorios, estado.fronteras);
        
    } catch (error) {
        console.error("Error al cargar el mapa:", error);
    }
}

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

        const grupo = document.createElementNS(SVG_NS, 'g');
        grupo.classList.add('cursor-pointer');

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

        const textoTropas = document.createElementNS(SVG_NS, 'text');
        textoTropas.setAttribute('x', centroX);
        textoTropas.setAttribute('y', centroY);
        textoTropas.setAttribute('text-anchor', 'middle');
        textoTropas.setAttribute('dominant-baseline', 'central');
        textoTropas.setAttribute('fill', 'white');
        textoTropas.setAttribute('font-weight', 'bold');
        textoTropas.setAttribute('font-family', 'sans-serif');
        textoTropas.setAttribute('font-size', '18px');
        textoTropas.style.pointerEvents = 'none';
        textoTropas.textContent = territorio.tropas_actuales;

        grupo.addEventListener("mouseenter", () => {
            tooltip.style.backgroundColor = territorio.pais_duenio_color || '#94a3b8';
            tooltip.style.borderColor = '#000000';
            tooltip.style.color = '#ffffff';
            tooltip.style.webkitTextStroke = '0.05px #000000';
            tooltip.style.textShadow = '1px 0 #000000, -1px 0 #000000, 0 1px #000000, 0 -1px #000000';
            bordeTerreno.setAttribute("r", "53");
            separadorBorde.setAttribute("r", "47");
            circulo.setAttribute("r", "43");
            tooltip.innerHTML = `
                <strong>País: ${territorio.pais_duenio_nombre || 'Neutral'}</strong><br>
                Tipo: ${territorio.tipo_terreno_nombre}
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
