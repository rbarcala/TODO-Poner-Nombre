import { Router } from "express";
import {
  crearPais,
  obtenerPaises,
  obtenerPais,
  borrarPais,
  editarPais,
  obtenerTipoTerrenoPorNombre,
} from "../bdd/paises.js";

export const endpointsPaises = Router();

endpointsPaises.get("/", async (req, res) => {
  const paises = await obtenerPaises();
  if (!paises) {
    return res.status(500).json({ error: "Error al obtener países" });
  }
  res.json(paises);
});

endpointsPaises.get("/:indice", async (req, res) => {
  let indice = req.params.indice;

  const pais = await obtenerPais(indice);

  if (pais === undefined) {
    return res.status(404).json({ error: "País no encontrado" });
  }

  res.json(pais);
});

endpointsPaises.put("/:indice", async (req, res) => {
  let indice = req.params.indice;

  if (
    req.body.economia === undefined ||
    !Number.isInteger(req.body.economia)
  ) {
    return res.status(400).json({ error: "Economía no especificada o no es un número entero" });
  }

  const terreno = await obtenerTipoTerrenoPorNombre(req.body.terreno);

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
    return res.status(500).json({ error: "Error al actualizar el país" });
  }

  res.json({ message: "País actualizado correctamente" });
});

endpointsPaises.patch("/:indice", async (req, res) => {
  let indice = req.params.indice;

  if (
    req.body.economia !== undefined &&
    !Number.isInteger(req.body.economia)
  ) {
    return res.status(400).json({ error: "Economía no es un número entero" });
  }

  let pais = await obtenerPais(indice);

  if (pais === undefined) {
    return res.status(404).json({ error: "País no encontrado" });
  }

  if (req.body.nombre !== undefined) pais.nombre = req.body.nombre;
  if (req.body.color_hex !== undefined) pais.color_hex = req.body.color_hex;
  if (req.body.economia !== undefined) pais.economia = parseInt(req.body.economia);
  if (req.body.tecnologia !== undefined) pais.tecnologia = parseInt(req.body.tecnologia);
  if (req.body.agresividad !== undefined) pais.agresividad = parseInt(req.body.agresividad);

  let terreno;
  if (req.body.terreno !== undefined) {
    terreno = await obtenerTipoTerrenoPorNombre(req.body.terreno);
  } else {
    terreno = { id: pais.resistencia_terreno_id };
  }

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
    return res.status(500).json({ error: "Error al actualizar el país" });
  }

  res.json({ message: "País actualizado correctamente" });
});

endpointsPaises.delete("/:indice", async (req, res) => {
  let indice = req.params.indice;

  const pais = await obtenerPais(indice);

  if (pais === undefined) {
    return res.status(404).json({ error: "País no encontrado" });
  }

  const eliminado = await borrarPais(indice);

  if (!eliminado) {
    return res.status(500).json({ error: "Error al eliminar el país" });
  }

  res.json(pais);
});

endpointsPaises.post("/", async (req, res) => {
  if (
    req.body.economia === undefined ||
    !Number.isInteger(req.body.economia)
  ) {
    return res.status(400).json({ error: "Economía no especificada o no es un número entero" });
  }

  const terreno = await obtenerTipoTerrenoPorNombre(req.body.terreno);

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
    return res.status(500).json({ error: "Error al crear el país" });
  }

  res.status(201).json(created);
});