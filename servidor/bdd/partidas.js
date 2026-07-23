import { pool } from '../pool.js';

const obtenerTropaBase = async (client) => {
    const resultado = await client.query(`
        INSERT INTO tropas (id_tipo_tropa)
        SELECT id FROM tipos_de_tropas ORDER BY id ASC LIMIT 1
        ON CONFLICT (id_tipo_tropa)
        DO UPDATE SET id_tipo_tropa = EXCLUDED.id_tipo_tropa
        RETURNING id
    `);

    return resultado.rows[0]?.id;
};

const guardarTropasEstacionadas = async (client, territorioId, cantidad) => {
    await client.query('DELETE FROM tropas_estacionadas WHERE id_territorio = $1', [territorioId]);

    if (cantidad <= 0) return;

    const tropaId = await obtenerTropaBase(client);
    if (!tropaId) {
        throw new Error('No hay tipos de tropas disponibles para asignar al territorio');
    }

    await client.query(`
        INSERT INTO tropas_estacionadas (id_territorio, id_tropa)
        SELECT $1, $2 FROM generate_series(1, $3)
    `, [territorioId, tropaId, cantidad]);
};

export const obtenerPartidas = async () => {
    try {
        const query = `
            SELECT p.*, pg.nombre as pais_ganador_nombre
            FROM partidas p
            LEFT JOIN paises pg ON p.pais_ganador_id = pg.id
            ORDER BY p.id DESC
        `;
        const resultado = await pool.query(query);
        return resultado.rows;
    } catch (error) {
        return undefined;
    }
};

export const obtenerPartida = async (id) => {
    try {
        const query = 'SELECT * FROM partidas WHERE id = $1';
        const resultado = await pool.query(query, [id]);
        return resultado.rows[0];
    } catch (error) {
        return undefined;
    }
};

export const crearPartidaConMapa = async (nombre, paisesParticipantesIds, mapaGenerado) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const primerPaisId = paisesParticipantesIds[0];
        
        // 1. Crear registro de partida
        const resPartida = await client.query(
            `INSERT INTO partidas (nombre, estado, turno_actual) VALUES ($1, $2, $3) RETURNING *`,
            [nombre || 'Nueva Partida', 'en_curso', primerPaisId]
        );
        const partida = resPartida.rows[0];

        // 2. Asociar países a la partida
        for (const paisId of paisesParticipantesIds) {
            await client.query(
                `INSERT INTO paises_partidas (pais_id, partida_id, tropas_actuales, eliminado) VALUES ($1, $2, $3, false)`,
                [paisId, partida.id, 0]
            );
        }

        // Map temporario de ID en memoria de mapaGenerado a ID de base de datos
        const idMap = new Map();

        // 3. Insertar territorios
        for (const t of mapaGenerado.territorios) {
            const resTerritorio = await client.query(
                `INSERT INTO territorios (partida_id, nombre, coord_x, coord_y, tipo_terreno_id, pais_duenio_id)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [partida.id, t.nombre || `Sector (${t.x},${t.y})`, t.x, t.y, t.tipo_terreno_id, t.pais_duenio_id]
            );
            const territorioGuardado = resTerritorio.rows[0];
            await guardarTropasEstacionadas(client, territorioGuardado.id, t.tropas_actuales ?? 3);
            idMap.set(t.id, territorioGuardado.id);
        }

        // 4. Insertar fronteras
        for (const f of mapaGenerado.fronteras) {
            const origenDbId = idMap.get(f.id_territorio_origen);
            const destinoDbId = idMap.get(f.id_territorio_destino);

            if (origenDbId && destinoDbId) {
                await client.query(
                    `INSERT INTO fronteras (id_territorio_origen, id_territorio_destino)
                     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                    [origenDbId, destinoDbId]
                );
            }
        }

        await client.query('COMMIT');
        return partida;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al crear partida con mapa:', error);
        return undefined;
    } finally {
        client.release();
    }
};

export const obtenerEstadoCompletoPartida = async (partidaId) => {
    try {
        const resPartida = await pool.query('SELECT * FROM partidas WHERE id = $1', [partidaId]);
        if (resPartida.rows.length === 0) return undefined;
        const partida = resPartida.rows[0];

        const resPaises = await pool.query(`
            SELECT pp.*, p.nombre, p.color_hex, p.economia, p.tecnologia, p.agresividad, p.resistencia_terreno_id
            FROM paises_partidas pp
            JOIN paises p ON pp.pais_id = p.id
            WHERE pp.partida_id = $1
        `, [partidaId]);

        const resTerritorios = await pool.query(`
            SELECT t.*, tt.nombre as tipo_terreno_nombre, tt.color_hex as terreno_color,
                   tt.modificador_ataque, tt.modificador_defensa,
                   p.nombre as pais_duenio_nombre, p.color_hex as pais_duenio_color,
                   COUNT(te.id_tropa)::integer as tropas_actuales
            FROM territorios t
            LEFT JOIN tipos_de_terreno tt ON t.tipo_terreno_id = tt.id
            LEFT JOIN paises p ON t.pais_duenio_id = p.id
            LEFT JOIN tropas_estacionadas te ON t.id = te.id_territorio
            WHERE t.partida_id = $1
            GROUP BY t.id, tt.id, p.id
            ORDER BY t.id ASC
        `, [partidaId]);

        const territoriosIds = resTerritorios.rows.map(t => t.id);
        let fronteras = [];
        if (territoriosIds.length > 0) {
            const resFronteras = await pool.query(`
                SELECT id_territorio_origen, id_territorio_destino
                FROM fronteras
                WHERE id_territorio_origen = ANY($1::int[]) OR id_territorio_destino = ANY($1::int[])
            `, [territoriosIds]);
            fronteras = resFronteras.rows;
        }

        return {
            partida,
            paises: resPaises.rows,
            territorios: resTerritorios.rows,
            fronteras
        };
    } catch (error) {
        console.error('Error al obtener estado completo de la partida:', error);
        return undefined;
    }
};

export const actualizarTerritorio = async (territorioId, paisDuenioId, tropasActuales, troopTypesCatalog = []) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const query = `
            UPDATE territorios 
            SET pais_duenio_id = $1 
            WHERE id = $2 
            RETURNING *
        `;
        const resultado = await client.query(query, [paisDuenioId, territorioId]);
        if (resultado.rows.length === 0) {
            await client.query('ROLLBACK');
            return undefined;
        }

        await guardarTropasEstacionadas(client, territorioId, tropasActuales, troopTypesCatalog);
        await client.query('COMMIT');
        return resultado.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        return undefined;
    } finally {
        client.release();
    }
};

export const actualizarEstadoPartida = async (partidaId, turnoActualPaisId, estado, paisGanadorId = null) => {
    try {
        const query = `
            UPDATE partidas 
            SET turno_actual = COALESCE($1, turno_actual), 
                estado = COALESCE($2, estado), 
                pais_ganador_id = COALESCE($3, pais_ganador_id) 
            WHERE id = $4 
            RETURNING *
        `;
        const resultado = await pool.query(query, [turnoActualPaisId, estado, paisGanadorId, partidaId]);
        return resultado.rows[0];
    } catch (error) {
        return undefined;
    }
};

export const borrarPartida = async (id) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM fronteras WHERE id_territorio_origen IN (SELECT id FROM territorios WHERE partida_id = $1)', [id]);
        await client.query('DELETE FROM tropas_estacionadas WHERE id_territorio IN (SELECT id FROM territorios WHERE partida_id = $1)', [id]);
        await client.query('DELETE FROM territorios WHERE partida_id = $1', [id]);
        await client.query('DELETE FROM paises_partidas WHERE partida_id = $1', [id]);
        await client.query('DELETE FROM turnos WHERE partida_id = $1', [id]);
        const res = await client.query('DELETE FROM partidas WHERE id = $1 RETURNING *', [id]);
        await client.query('COMMIT');
        return res.rows.length > 0;
    } catch (error) {
        await client.query('ROLLBACK');
        return false;
    } finally {
        client.release();
    }
};
