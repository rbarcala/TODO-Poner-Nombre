import { Router } from "express";
import {
  crearPais,
  obtenerPaises,
  obtenerPais,
  borrarPais,
  editarPais,
  obtenerTipoTerrenoPorNombre,
} from "../bdd/paises.js";
import { obtenerTerreno } from "../bdd/terrenos.js";
import { pool } from "../pool.js";

export const endpointsPaises = Router();

const obtenerTerrenoDesdeBody = async (body, actualId = undefined) => {
  const terrenoId = body.resistencia_terreno_id ?? body.terreno_id ?? actualId;

  if (terrenoId !== undefined && terrenoId !== null && terrenoId !== "") {
    return obtenerTerreno(parseInt(terrenoId));
  }

  if (body.terreno !== undefined) {
    return obtenerTipoTerrenoPorNombre(body.terreno);
  }

  return undefined;
};

const contarReferenciasPais = async (id) => {
  const resultado = await pool.query(
    `SELECT
      (SELECT COUNT(*) FROM partidas WHERE pais_ganador_id = $1)::integer AS partidas_ganadas,
      (SELECT COUNT(*) FROM paises_partidas WHERE pais_id = $1)::integer AS partidas,
      (SELECT COUNT(*) FROM territorios WHERE pais_duenio_id = $1)::integer AS territorios,
      (SELECT COUNT(*) FROM movimientos WHERE pais_atacante_id = $1 OR pais_defensor_id = $1)::integer AS movimientos,
      (SELECT COUNT(*) FROM turnos WHERE pais_activo_id = $1)::integer AS turnos`,
    [id],
  );

  return resultado.rows[0];
};

const totalReferencias = (referencias) => (
  Object.values(referencias).reduce((total, cantidad) => total + cantidad, 0)
);

endpointsPaises.get("/", async (req, res) => {
  const paises = await obtenerPaises();
  if (!paises) {
    return res.status(500).json({ error: "Error al obtener paises" });
  }
  res.json(paises);
});

endpointsPaises.get("/:indice", async (req, res) => {
  const indice = req.params.indice;
  const pais = await obtenerPais(indice);

  if (pais === undefined) {
    return res.status(404).json({ error: "Pais no encontrado" });
  }

  res.json(pais);
});

endpointsPaises.put("/:indice", async (req, res) => {
  const indice = req.params.indice;

  if (req.body.economia === undefined || !Number.isInteger(req.body.economia)) {
    return res.status(400).json({ error: "Economia no especificada o no es un numero entero" });
  }

  const terreno = await obtenerTerrenoDesdeBody(req.body);

  if (terreno === undefined) {
    return res.status(404).json({ error: "Tipo de terreno no encontrado" });
  }

  const updated = await editarPais(
    indice,
    req.body.nombre,
    req.body.color_hex,
    req.body.economia,
    req.body.tecnologia,
    req.body.agresividad,
    terreno.id,
  );

  if (!updated) {
    return res.status(500).json({ error: "Error al actualizar el pais" });
  }

  res.json({ message: "Pais actualizado correctamente" });
});

endpointsPaises.patch("/:indice", async (req, res) => {
  const indice = req.params.indice;

  if (req.body.economia !== undefined && !Number.isInteger(req.body.economia)) {
    return res.status(400).json({ error: "Economia no es un numero entero" });
  }

  const pais = await obtenerPais(indice);

  if (pais === undefined) {
    return res.status(404).json({ error: "Pais no encontrado" });
  }

  if (req.body.nombre !== undefined) pais.nombre = req.body.nombre;
  if (req.body.color_hex !== undefined) pais.color_hex = req.body.color_hex;
  if (req.body.economia !== undefined) pais.economia = parseInt(req.body.economia);
  if (req.body.tecnologia !== undefined) pais.tecnologia = parseInt(req.body.tecnologia);
  if (req.body.agresividad !== undefined) pais.agresividad = parseInt(req.body.agresividad);

  const terreno = await obtenerTerrenoDesdeBody(req.body, pais.resistencia_terreno_id);

  if (terreno === undefined) {
    return res.status(404).json({ error: "Tipo de terreno no encontrado" });
  }

  pais.resistencia_terreno_id = terreno.id;

  const updated = await editarPais(
    indice,
    pais.nombre,
    pais.color_hex,
    pais.economia,
    pais.tecnologia,
    pais.agresividad,
    pais.resistencia_terreno_id,
  );

  if (!updated) {
    return res.status(500).json({ error: "Error al actualizar el pais" });
  }

  res.json({ message: "Pais actualizado correctamente" });
});

endpointsPaises.delete("/:indice", async (req, res) => {
  const indice = req.params.indice;
  const pais = await obtenerPais(indice);

  if (pais === undefined) {
    return res.status(404).json({ error: "Pais no encontrado" });
  }

  const referencias = await contarReferenciasPais(indice);
  if (totalReferencias(referencias) > 0) {
    return res.status(409).json({
      error: "No se puede eliminar el pais porque esta usado en partidas, territorios, movimientos o turnos.",
      referencias,
    });
  }

  const eliminado = await borrarPais(indice);

  if (!eliminado) {
    return res.status(500).json({ error: "Error al eliminar el pais" });
  }

  res.json(pais);
});

endpointsPaises.post("/", async (req, res) => {
  if (req.body.economia === undefined || !Number.isInteger(req.body.economia)) {
    return res.status(400).json({ error: "Economia no especificada o no es un numero entero" });
  }

  const terreno = await obtenerTerrenoDesdeBody(req.body);

  if (terreno === undefined) {
    return res.status(404).json({ error: "Tipo de terreno no encontrado" });
  }

  const created = await crearPais(
    req.body.nombre,
    req.body.color_hex,
    req.body.economia,
    req.body.tecnologia,
    req.body.agresividad,
    terreno.id,
  );

  if (!created) {
    return res.status(500).json({ error: "Error al crear el pais" });
  }

  res.status(201).json(created);
});
