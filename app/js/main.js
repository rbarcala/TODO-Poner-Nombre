document.addEventListener('DOMContentLoaded', () => {
    const btnNuevaPartida = document.querySelector('button.bg-red-700');

    if (btnNuevaPartida) {
        btnNuevaPartida.addEventListener('click', async () => {
            try {
                btnNuevaPartida.textContent = "GENERANDO MAPA...";
                
                const respuesta = await fetch('http://localhost:8000/api/partidas', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ nombre: "Partida de Prueba" })
                });

                if (!respuesta.ok) throw new Error("Error al crear la partida");

                const nuevaPartida = await respuesta.json();

                window.location.href = `mapa.html?id=${nuevaPartida.partida.id}`;

            } catch (error) {
                console.error(error);
                alert("Hubo un error al conectar con el servidor.");
                btnNuevaPartida.textContent = "NUEVA PARTIDA";
            }
        });
    }
});