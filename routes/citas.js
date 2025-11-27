const express = require("express");
const router = express.Router();
const citasController = require("../controllers/citasController");
const { requireAuth } = require("../middlewares/auth");

// ---------- Listado y creación ----------
router.get("/", requireAuth, citasController.index);
router.get("/nueva", requireAuth, citasController.form);
router.post("/guardar", requireAuth, citasController.guardar);

// ---------- Edición y eliminación ----------
router.get("/editar/:id", requireAuth, citasController.editar);
router.post("/actualizar/:id", requireAuth, citasController.actualizar);
router.post("/eliminar/:id", requireAuth, citasController.eliminar);

// ---------- Detalle ----------
router.get("/:id", requireAuth, citasController.detalle);

module.exports = router;
