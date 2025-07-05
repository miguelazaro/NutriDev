const express = require('express');
const router = express.Router();
const pacientesController = require('../controllers/pacientesController');

// Rutas del CRUD
router.get('/', pacientesController.index);
router.get('/nuevo', pacientesController.form);
router.post('/guardar', pacientesController.guardar);
router.get('/editar/:id', pacientesController.editar);
router.post('/actualizar/:id', pacientesController.actualizar);
router.post('/eliminar/:id', pacientesController.eliminar);

module.exports = router;
