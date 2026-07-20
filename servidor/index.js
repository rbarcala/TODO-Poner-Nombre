import express from 'express';
import { endpointsPaises } from './api/paises.js';
import { endpointsTerrenos } from './api/terrenos.js';
import { endpointsTropas } from './api/tropas.js';
import { endpointsPartidas } from './api/partidas.js';

const app = express();
const PORT = 3000;

app.use(express.json());

app.use('/api/paises', endpointsPaises);
app.use('/api/terrenos', endpointsTerrenos);
app.use('/api/tipos-tropas', endpointsTropas);
app.use('/api/partidas', endpointsPartidas);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});