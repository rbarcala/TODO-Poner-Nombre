import { Router } from "express";
import {
  obtenerTerrenos,
  obtenerTerreno,
  crearTerreno,
  editarTerreno,
  borrarTerreno
} from "../bdd/terrenos.js";

export const endpointsTerrenos = Router();

// GET /api/terrenos - Listar todos los tipos de terreno
endpointsTerrenos.get("/", async (req, res) => {
  const terrenos = await obtenerTerrenos();
  if (!terrenos) return res.sendStatus(500);
  res.json(terrenos);
});

// GET /api/terrenos/:id - Obtener un terreno por ID
endpointsTerrenos.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const terreno = await obtenerTerreno(id);
  if (!terreno) return res.sendStatus(404);
  res.json(terreno);
});

// POST /api/terrenos - Crear un nuevo terreno
endpointsTerrenos.post("/", async (req, res) => {
  const { nombre, descripcion, color_hex, modificador_ataque, modificador_defensa } = req.body;

  if (!nombre || !color_hex) {
    return res.status(400).send("Nombre y color_hex son obligatorios");
  }

  const nuevo = await crearTerreno(
    nombre,
    descripcion || null,
    color_hex,
    modificador_ataque || 1.0,
    modificador_defensa || 1.0
  );

  if (!nuevo) return res.sendStatus(500);
  res.status(201).json(nuevo);
});

// PUT /api/terrenos/:id - Actualizar un terreno existente
endpointsTerrenos.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { nombre, descripcion, color_hex, modificador_ataque, modificador_defensa } = req.body;

  const actualizado = await editarTerreno(
    id,
    nombre,
    descripcion,
    color_hex,
    modificador_ataque,
    modificador_defensa
  );

  if (!actualizado) return res.sendStatus(404);
  res.json(actualizado);
});

// DELETE /api/terrenos/:id - Eliminar un terreno
endpointsTerrenos.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const eliminado = await borrarTerreno(id);
  if (!eliminado) return res.sendStatus(404);
  res.sendStatus(204);
});
