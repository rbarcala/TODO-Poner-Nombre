import { Router } from "express";
import {
  obtenerTerrenos,
  obtenerTerreno,
  crearTerreno,
  editarTerreno,
  borrarTerreno
} from "../bdd/terrenos.js";
import { pool } from "../pool.js";

export const endpointsTerrenos = Router();

const contarReferenciasTerreno = async (id) => {
  const resultado = await pool.query(
    `SELECT
      (SELECT COUNT(*) FROM paises WHERE resistencia_terreno_id = $1)::integer AS paises,
      (SELECT COUNT(*) FROM territorios WHERE tipo_terreno_id = $1)::integer AS territorios`,
    [id],
  );

  return resultado.rows[0];
};

const totalReferencias = (referencias) => (
  Object.values(referencias).reduce((total, cantidad) => total + cantidad, 0)
);

// GET /api/terrenos - Listar todos los tipos de terreno
endpointsTerrenos.get("/", async (req, res) => {
  const terrenos = await obtenerTerrenos();
  if (!terrenos) return res.status(500).json({ error: "Error al obtener terrenos" });
  res.json(terrenos);
});

// GET /api/terrenos/:id - Obtener un terreno por ID
endpointsTerrenos.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const terreno = await obtenerTerreno(id);
  if (!terreno) return res.status(404).json({ error: "Tipo de terreno no encontrado" });
  res.json(terreno);
});

// POST /api/terrenos - Crear un nuevo terreno
endpointsTerrenos.post("/", async (req, res) => {
  const { nombre, descripcion, color_hex, modificador_ataque, modificador_defensa } = req.body;

  if (!nombre || !color_hex) {
    return res.status(400).json({ error: "Nombre y color_hex son obligatorios" });
  }

  const nuevo = await crearTerreno(
    nombre,
    descripcion || null,
    color_hex,
    modificador_ataque || 1.0,
    modificador_defensa || 1.0
  );

  if (!nuevo) return res.status(500).json({ error: "Error al crear el terreno" });
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

  if (!actualizado) return res.status(404).json({ error: "Terreno no encontrado o error al actualizar" });
  res.json(actualizado);
});

// DELETE /api/terrenos/:id - Eliminar un terreno
endpointsTerrenos.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const terreno = await obtenerTerreno(id);
  if (!terreno) return res.status(404).json({ error: "Terreno no encontrado" });

  const referencias = await contarReferenciasTerreno(id);
  if (totalReferencias(referencias) > 0) {
    return res.status(409).json({
      error: "No se puede eliminar el terreno porque esta usado por paises o territorios.",
      referencias,
    });
  }

  const eliminado = await borrarTerreno(id);
  if (!eliminado) return res.status(404).json({ error: "Terreno no encontrado o no se pudo eliminar" });
  res.json({ message: "Terreno eliminado correctamente", id });
});
