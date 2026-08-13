import { pool } from '../pool.js';

const normalizarEnteroPositivo = (valor) => {
    const numero = Number(valor);
    return Number.isInteger(numero) && numero > 0 ? numero : 0;
};

const obtenerTipoInfanteriaId = async (client, troopTypesCatalog = []) => {
    const desdeCatalogo = (troopTypesCatalog || []).find((tipo) => (
        Number.isInteger(tipo?.id)
        && tipo.id > 0
        && typeof tipo?.tipo === 'string'
        && tipo.tipo.trim().toLowerCase() === 'infanteria'
    ));

    if (desdeCatalogo) return desdeCatalogo.id;

    const resultado = await client.query(`
        SELECT id
        FROM tipos_de_tropas
        WHERE LOWER(TRIM(tipo)) = 'infanteria'
        LIMIT 1
    `);

    const idInfanteria = resultado.rows[0]?.id;
    if (!idInfanteria) {
        throw new Error('No existe el tipo de tropa "Infanteria" en el catálogo. No se puede inicializar la partida.');
    }

    return idInfanteria;
};

const obtenerTipoBaseId = async (client, troopTypesCatalog = []) => {
    const primerTipoCatalogo = (troopTypesCatalog || []).find((tipo) => Number.isInteger(tipo?.id) && tipo.id > 0);
    if (primerTipoCatalogo) return primerTipoCatalogo.id;

    const resultado = await client.query('SELECT id FROM tipos_de_tropas ORDER BY id ASC LIMIT 1');
    return resultado.rows[0]?.id;
};

const asegurarTropaPorTipo = async (client, idTipoTropa) => {
    const resultado = await client.query(`
        INSERT INTO tropas (id_tipo_tropa)
        VALUES ($1)
        ON CONFLICT (id_tipo_tropa)
        DO UPDATE SET id_tipo_tropa = EXCLUDED.id_tipo_tropa
        RETURNING id
    `, [idTipoTropa]);

    return resultado.rows[0]?.id;
};

const normalizarComposicionTropas = async (client, tropasEntrada, troopTypesCatalog = []) => {
    const acumulado = new Map();
    const agregar = (idTipoTropa, cantidad) => {
        const idNormalizado = normalizarEnteroPositivo(idTipoTropa);
        const cantidadNormalizada = normalizarEnteroPositivo(cantidad);
        if (idNormalizado <= 0 || cantidadNormalizada <= 0) return;
        acumulado.set(idNormalizado, (acumulado.get(idNormalizado) || 0) + cantidadNormalizada);
    };

    if (Array.isArray(tropasEntrada)) {
        tropasEntrada.forEach((item) => {
            agregar(item?.id_tipo_tropa, item?.cantidad);
        });
    } else if (tropasEntrada && typeof tropasEntrada === 'object') {
        Object.entries(tropasEntrada).forEach(([idTipoTropa, cantidad]) => {
            agregar(idTipoTropa, cantidad);
        });
    } else {
        const cantidad = normalizarEnteroPositivo(tropasEntrada);
        if (cantidad > 0) {
            const tipoBaseId = await obtenerTipoBaseId(client, troopTypesCatalog);
            if (!tipoBaseId) {
                throw new Error('No hay tipos de tropas disponibles para asignar al territorio');
            }
            agregar(tipoBaseId, cantidad);
        }
    }

    return Array.from(acumulado.entries())
        .map(([id_tipo_tropa, cantidad]) => ({ id_tipo_tropa, cantidad }))
        .sort((a, b) => a.id_tipo_tropa - b.id_tipo_tropa);
};

const guardarTropasEstacionadas = async (client, territorioId, tropasEntrada, troopTypesCatalog = []) => {
    await client.query('DELETE FROM tropas_estacionadas WHERE id_territorio = $1', [territorioId]);

    const composicion = await normalizarComposicionTropas(client, tropasEntrada, troopTypesCatalog);
    if (composicion.length === 0) return;

    const cacheTropaPorTipo = new Map();
    for (const item of composicion) {
        const idTipoTropa = item.id_tipo_tropa;
        let tropaId = cacheTropaPorTipo.get(idTipoTropa);

        if (!tropaId) {
            tropaId = await asegurarTropaPorTipo(client, idTipoTropa);
            if (!tropaId) {
                throw new Error(`No se pudo obtener la tropa para el tipo ${idTipoTropa}`);
            }
            cacheTropaPorTipo.set(idTipoTropa, tropaId);
        }

        await client.query(`
            INSERT INTO tropas_estacionadas (id_territorio, id_tropa)
            SELECT $1, $2 FROM generate_series(1, $3)
        `, [territorioId, tropaId, item.cantidad]);
    }
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

export const crearPartidaConMapa = async (nombre, paisesParticipantesIds, mapaGenerado, troopTypesCatalog = []) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const idTipoInfanteria = await obtenerTipoInfanteriaId(client, troopTypesCatalog);

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
            const cantidadInicialInfanteria = t.pais_duenio_id ? 3 : 1;
            await guardarTropasEstacionadas(
                client,
                territorioGuardado.id,
                [{ id_tipo_tropa: idTipoInfanteria, cantidad: cantidadInicialInfanteria }],
                troopTypesCatalog
            );
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
            WITH composicion AS (
                SELECT
                    te.id_territorio,
                    tr.id_tipo_tropa,
                    tdt.tipo AS tipo_tropa,
                    tdt.dado_min,
                    tdt.dado_max,
                    tdt.costo,
                    COUNT(*)::integer AS cantidad
                FROM tropas_estacionadas te
                JOIN tropas tr ON tr.id = te.id_tropa
                JOIN tipos_de_tropas tdt ON tdt.id = tr.id_tipo_tropa
                GROUP BY te.id_territorio, tr.id_tipo_tropa, tdt.tipo, tdt.dado_min, tdt.dado_max, tdt.costo
            )
            SELECT
                t.*,
                terr.nombre as tipo_terreno_nombre,
                terr.color_hex as terreno_color,
                terr.modificador_ataque,
                terr.modificador_defensa,
                p.nombre as pais_duenio_nombre,
                p.color_hex as pais_duenio_color,
                COALESCE(SUM(comp.cantidad), 0)::integer as tropas_actuales,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id_tipo_tropa', comp.id_tipo_tropa,
                            'tipo', comp.tipo_tropa,
                            'dado_min', comp.dado_min,
                            'dado_max', comp.dado_max,
                            'costo', comp.costo,
                            'cantidad', comp.cantidad
                        )
                        ORDER BY comp.id_tipo_tropa
                    ) FILTER (WHERE comp.id_tipo_tropa IS NOT NULL),
                    '[]'::json
                ) as composicion_tropas
            FROM territorios t
            LEFT JOIN tipos_de_terreno terr ON t.tipo_terreno_id = terr.id
            LEFT JOIN paises p ON t.pais_duenio_id = p.id
            LEFT JOIN composicion comp ON comp.id_territorio = t.id
            WHERE t.partida_id = $1
            GROUP BY t.id, terr.id, p.id
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

export const asegurarColumnasPartida = async () => {
    try {
        await pool.query('ALTER TABLE partidas ADD COLUMN IF NOT EXISTS movimientos_realizados INTEGER DEFAULT 0;');
        await pool.query('ALTER TABLE partidas ADD COLUMN IF NOT EXISTS ha_fortificado BOOLEAN DEFAULT FALSE;');
    } catch (e) {
        // Ignorar si ya existen
    }
};

// Alias para compatibilidad con llamadas existentes
export const asegurarColumnaMovimientos = asegurarColumnasPartida;

export const marcarFortificacionRealizada = async (partidaId) => {
    await asegurarColumnasPartida();
    try {
        const res = await pool.query(
            'UPDATE partidas SET ha_fortificado = TRUE WHERE id = $1 RETURNING *',
            [partidaId]
        );
        return res.rows[0];
    } catch (e) {
        return undefined;
    }
};

export const incrementarMovimientosPartida = async (partidaId) => {
    await asegurarColumnasPartida();
    try {
        const res = await pool.query(
            'UPDATE partidas SET movimientos_realizados = COALESCE(movimientos_realizados, 0) + 1 WHERE id = $1 RETURNING *',
            [partidaId]
        );
        return res.rows[0];
    } catch (e) {
        return undefined;
    }
};

export const resetearMovimientosPartida = async (partidaId) => {
    await asegurarColumnasPartida();
    try {
        const res = await pool.query(
            'UPDATE partidas SET movimientos_realizados = 0, ha_fortificado = FALSE WHERE id = $1 RETURNING *',
            [partidaId]
        );
        return res.rows[0];
    } catch (e) {
        return undefined;
    }
};

export const actualizarEstadoPartida = async (partidaId, turnoActualPaisId, estado, paisGanadorId = null) => {
    await asegurarColumnasPartida();
    try {
        const query = `
            UPDATE partidas 
            SET turno_actual = COALESCE($1, turno_actual), 
                estado = COALESCE($2, estado), 
                pais_ganador_id = COALESCE($3, pais_ganador_id),
                movimientos_realizados = CASE WHEN $1 IS NOT NULL AND $1 <> turno_actual THEN 0 ELSE movimientos_realizados END,
                ha_fortificado = CASE WHEN $1 IS NOT NULL AND $1 <> turno_actual THEN FALSE ELSE ha_fortificado END
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

export const limpiarDatosDePartidas = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const conteos = await client.query(`
            SELECT
                (SELECT COUNT(*) FROM partidas)::integer AS partidas,
                (SELECT COUNT(*) FROM paises_partidas)::integer AS paises_partidas,
                (SELECT COUNT(*) FROM territorios)::integer AS territorios,
                (SELECT COUNT(*) FROM fronteras)::integer AS fronteras,
                (SELECT COUNT(*) FROM turnos)::integer AS turnos,
                (SELECT COUNT(*) FROM movimientos)::integer AS movimientos,
                (SELECT COUNT(*) FROM tropas_estacionadas)::integer AS tropas_estacionadas,
                (SELECT COUNT(*) FROM tropas)::integer AS tropas
        `);

        await client.query('DELETE FROM turnos');
        await client.query('DELETE FROM movimientos');
        await client.query('DELETE FROM fronteras');
        await client.query('DELETE FROM tropas_estacionadas');
        await client.query('DELETE FROM territorios');
        await client.query('DELETE FROM paises_partidas');
        await client.query('DELETE FROM partidas');
        await client.query('DELETE FROM tropas');

        await client.query('COMMIT');
        return conteos.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        return undefined;
    } finally {
        client.release();
    }
};
