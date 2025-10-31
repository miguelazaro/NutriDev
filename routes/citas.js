const express = require("express");
const router = express.Router();
const citasController = require("../controllers/citasController");

// ---------- Listado & creación ----------
router.get("/", citasController.index);
router.get("/nueva", citasController.form);
router.post("/guardar", citasController.guardar);

// ---------- Edición y eliminación ----------
router.get("/editar/:id", citasController.editar);
router.post("/actualizar/:id", citasController.actualizar);
router.post("/eliminar/:id", citasController.eliminar);

// ---------- Detalle ----------
router.get("/:id", citasController.detalle);

module.exports = router; // ✅ CommonJS export
