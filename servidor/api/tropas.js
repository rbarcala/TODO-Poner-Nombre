import { Router } from "express";
import {
  obtenerTiposTropas,
  obtenerTipoTropa,
  crearTipoTropa,
  editarTipoTropa,
  borrarTipoTropa
} from "../bdd/tropas.js";
import { pool } from "../pool.js";

export const endpointsTropas = Router();

const contarReferenciasTipoTropa = async (id) => {
  const resultado = await pool.query(
    `SELECT COUNT(*)::integer AS tropas FROM tropas WHERE id_tipo_tropa = $1`,
    [id],
  );

  return resultado.rows[0];
};

const totalReferencias = (referencias) => (
  Object.values(referencias).reduce((total, cantidad) => total + cantidad, 0)
);

// GET /api/tipos-tropas
endpointsTropas.get("/", async (req, res) => {
  try {
    const tropas = await obtenerTiposTropas();
    if (!tropas) return res.status(500).json({ error: "Error al obtener tipos de tropas" });
    res.json(tropas);
  } catch (error) {
    console.error("Error en GET /tipos-tropas:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// GET /api/tipos-tropas/:id - Obtener un tipo de tropa por ID
endpointsTropas.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const tropa = await obtenerTipoTropa(id);
  if (!tropa) return res.status(404).json({ error: "Tipo de tropa no encontrado" });
  res.json(tropa);
});

// POST /api/tipos-tropas - Crear un nuevo tipo de tropa
endpointsTropas.post("/", async (req, res) => {
  const { tipo, descripcion, dado_min, dado_max, costo } = req.body;

  if (!tipo) {
    return res.status(400).json({ error: "El nombre del tipo de tropa es obligatorio" });
  }

  const nueva = await crearTipoTropa(
    tipo,
    descripcion || null,
    dado_min || 1,
    dado_max || 6,
    costo || 1
  );

  if (!nueva) return res.status(500).json({ error: "Error al crear el tipo de tropa" });
  res.status(201).json(nueva);
});

// PUT /api/tipos-tropas/:id - Editar tipo de tropa
endpointsTropas.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { tipo, descripcion, dado_min, dado_max, costo } = req.body;

  const actualizada = await editarTipoTropa(
    id,
    tipo,
    descripcion,
    dado_min,
    dado_max,
    costo 
  );

  if (!actualizada) return res.status(404).json({ error: "Tipo de tropa no encontrado o error al actualizar" });
  res.json(actualizada);
});

// DELETE /api/tipos-tropas/:id - Borrar tipo de tropa
endpointsTropas.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const tropa = await obtenerTipoTropa(id);
  if (!tropa) return res.status(404).json({ error: "Tipo de tropa no encontrado" });

  const referencias = await contarReferenciasTipoTropa(id);
  if (totalReferencias(referencias) > 0) {
    return res.status(409).json({
      error: "No se puede eliminar el tipo de tropa porque esta usado por tropas existentes.",
      referencias,
    });
  }

  const eliminada = await borrarTipoTropa(id);
  if (!eliminada) return res.status(404).json({ error: "Tipo de tropa no encontrado o no se pudo eliminar" });
  res.json({ message: "Tipo de tropa eliminado correctamente", id });
});
