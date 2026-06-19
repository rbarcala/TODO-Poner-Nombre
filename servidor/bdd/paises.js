import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    user: 'usuario',
    host: 'bdd', 
    database: 'bdd',
    password: 'contraseña',
    port: 8080,
});

export const obtenerPaises = async () => {
    try {
        const resultado = await pool.query('SELECT * FROM paises');
        return resultado.rows;
    } catch (error) {
        return undefined;
    }
};

export const obtenerPais = async (id) => {
    try {
        const resultado = await pool.query('SELECT * FROM paises WHERE id = $1', [id]);
        return resultado.rows[0];
    } catch (error) {
        return undefined;
    }
};

export const obtenerTipoTerrenoPorNombre = async (nombre) => {
    try {
        const resultado = await pool.query('SELECT * FROM tipos_de_terreno WHERE nombre = $1', [nombre]);
        return resultado.rows[0];
    } catch (error) {
        return undefined;
    }
};

export const crearPais = async (nombre, color_hex, economia, tecnologia, agresividad, resistencia_terreno_id) => {
    try {
        const query = `
            INSERT INTO paises (nombre, color_hex, economia, tecnologia, agresividad, resistencia_terreno_id) 
            VALUES ($1, $2, $3, $4, $5, $6) 
            RETURNING *
        `;
        const valores = [nombre, color_hex, economia, tecnologia, agresividad, resistencia_terreno_id];
        const resultado = await pool.query(query, valores);
        return resultado.rows[0];
    } catch (error) {
        return undefined;
    }
};

export const editarPais = async (id, nombre, color_hex, economia, tecnologia, agresividad, resistencia_terreno_id) => {
    try {
        const query = `
            UPDATE paises 
            SET nombre = $1, color_hex = $2, economia = $3, tecnologia = $4, agresividad = $5, resistencia_terreno_id = $6 
            WHERE id = $7 
            RETURNING *
        `;
        const valores = [nombre, color_hex, economia, tecnologia, agresividad, resistencia_terreno_id, id];
        const resultado = await pool.query(query, valores);
        return resultado.rows.length > 0;
    } catch (error) {
        return false;
    }
};

export const borrarPais = async (id) => {
    try {
        const resultado = await pool.query('DELETE FROM paises WHERE id = $1 RETURNING *', [id]);
        return resultado.rows.length > 0;
    } catch (error) {
        return false;
    }
};