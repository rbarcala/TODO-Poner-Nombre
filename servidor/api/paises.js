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
  res.json(paises);
});

endpointsPaises.get("/:indice", async (req, res) => {
  let indice = req.params.indice;

  const pais = await obtenerPais(indice);

  if (pais === undefined) {
    res.sendStatus(404);
    return;
  }

  res.json(pais);
});

endpointsPaises.put("/:indice", async (req, res) => {
  let indice = req.params.indice;

  if (
    req.body.economia === undefined ||
    !Number.isInteger(req.body.economia)
  ) {
    res.status(400).send("Economia not set");
    return;
  }

  const terreno = await obtenerTipoTerrenoPorNombre(req.body.terreno);

  if (terreno === undefined) {
    res.sendStatus(404);
    return;
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
    res.sendStatus(500);
    return;
  }

  res.sendStatus(200);
});

endpointsPaises.patch("/:indice", async (req, res) => {
  let indice = req.params.indice;

  if (
    req.body.economia !== undefined &&
    !Number.isInteger(req.body.economia)
  ) {
    res.status(400).send("Economia no es un número");
    return;
  }

  let pais = await obtenerPais(indice);

  if (pais === undefined) {
    res.sendStatus(404);
    return;
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
    res.sendStatus(404);
    return;
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
    res.sendStatus(500);
    return;
  }

  res.sendStatus(200);
});

endpointsPaises.delete("/:indice", async (req, res) => {
  let indice = req.params.indice;

  const pais = await obtenerPais(indice);

  if (pais === undefined) {
    res.sendStatus(404);
    return;
  }

  const eliminado = await borrarPais(indice);

  if (!eliminado) {
    res.sendStatus(500);
    return;
  }

  res.json(pais);
});

endpointsPaises.post("/", async (req, res) => {
  if (
    req.body.economia === undefined ||
    !Number.isInteger(req.body.economia)
  ) {
    res.status(400).send("Economia not set");
    return;
  }

  const terreno = await obtenerTipoTerrenoPorNombre(req.body.terreno);

  if (terreno === undefined) {
    res.sendStatus(404);
    return;
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
    res.sendStatus(500);
    return;
  }

  res.status(201).json({
    nombre: req.body.nombre,
    color_hex: req.body.color_hex,
    economia: req.body.economia,
    tecnologia: req.body.tecnologia,
    agresividad: req.body.agresividad,
    terreno: req.body.terreno,
  });
});