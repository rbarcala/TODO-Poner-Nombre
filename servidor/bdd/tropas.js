import { pool } from '../pool.js';

export const obtenerTiposTropas = async () => {
    try {
        const resultado = await pool.query('SELECT * FROM tipos_de_tropas ORDER BY id ASC');
        return resultado.rows;
    } catch (error) {
        return undefined;
    }
};

export const obtenerTipoTropa = async (id) => {
    try {
        const resultado = await pool.query('SELECT * FROM tipos_de_tropas WHERE id = $1', [id]);
        return resultado.rows[0];
    } catch (error) {
        return undefined;
    }
};

export const crearTipoTropa = async (tipo, descripcion, dado_min, dado_max, costo) => {
    try {
        const query = `
            INSERT INTO tipos_de_tropas (tipo, descripcion, dado_min, dado_max, costo) 
            VALUES ($1, $2, $3, $4, $5) 
            RETURNING *
        `;
        const valores = [tipo, descripcion, dado_min, dado_max, costo];
        const resultado = await pool.query(query, valores);
        return resultado.rows[0];
    } catch (error) {
        return undefined;
    }
};

export const editarTipoTropa = async (id, tipo, descripcion, dado_min, dado_max, costo) => {
    try {
        const query = `
            UPDATE tipos_de_tropas 
            SET tipo = $1, descripcion = $2, dado_min = $3, dado_max = $4, costo = $5 
            WHERE id = $6 
            RETURNING *
        `;
        const valores = [tipo, descripcion, dado_min, dado_max, costo, id];
        const resultado = await pool.query(query, valores);
        return resultado.rows[0];
    } catch (error) {
        return undefined;
    }
};

export const borrarTipoTropa = async (id) => {
    try {
        const resultado = await pool.query('DELETE FROM tipos_de_tropas WHERE id = $1 RETURNING *', [id]);
        return resultado.rows.length > 0;
    } catch (error) {
        return false;
    }
};
