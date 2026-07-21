import { pool } from '../pool.js';

export const obtenerTerrenos = async () => {
    try {
        const resultado = await pool.query('SELECT * FROM tipos_de_terreno ORDER BY id ASC');
        return resultado.rows;
    } catch (error) {
        return undefined;
    }
};

export const obtenerTerreno = async (id) => {
    try {
        const resultado = await pool.query('SELECT * FROM tipos_de_terreno WHERE id = $1', [id]);
        return resultado.rows[0];
    } catch (error) {
        return undefined;
    }
};

export const crearTerreno = async (nombre, descripcion, color_hex, modificador_ataque, modificador_defensa) => {
    try {
        const query = `
            INSERT INTO tipos_de_terreno (nombre, descripcion, color_hex, modificador_ataque, modificador_defensa) 
            VALUES ($1, $2, $3, $4, $5) 
            RETURNING *
        `;
        const valores = [nombre, descripcion, color_hex, modificador_ataque, modificador_defensa];
        const resultado = await pool.query(query, valores);
        return resultado.rows[0];
    } catch (error) {
        return undefined;
    }
};

export const editarTerreno = async (id, nombre, descripcion, color_hex, modificador_ataque, modificador_defensa) => {
    try {
        const query = `
            UPDATE tipos_de_terreno 
            SET nombre = $1, descripcion = $2, color_hex = $3, modificador_ataque = $4, modificador_defensa = $5 
            WHERE id = $6 
            RETURNING *
        `;
        const valores = [nombre, descripcion, color_hex, modificador_ataque, modificador_defensa, id];
        const resultado = await pool.query(query, valores);
        return resultado.rows[0];
    } catch (error) {
        return undefined;
    }
};

export const borrarTerreno = async (id) => {
    try {
        const resultado = await pool.query('DELETE FROM tipos_de_terreno WHERE id = $1 RETURNING *', [id]);
        return resultado.rows.length > 0;
    } catch (error) {
        return false;
    }
};
