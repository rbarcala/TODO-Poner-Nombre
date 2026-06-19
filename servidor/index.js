import express from 'express';
import { endpointsPaises } from './api/paises.js';

const app = express();
const PORT = 3000;

app.use(express.json());

app.use('/api/paises', endpointsPaises);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});