const express = require('express');
const router = express.Router();
const pacientesController = require('../controllers/pacientesController');
const multerPaciente = require('../middlewares/multerPaciente');

// Rutas del CRUD
router.get('/', pacientesController.index);
router.get('/nuevo', pacientesController.form);
router.post('/guardar', pacientesController.guardar);
router.get('/editar/:id', pacientesController.editar);
router.post('/actualizar/:id', pacientesController.actualizar);
router.post('/eliminar/:id', pacientesController.eliminar);
router.get('/:id', pacientesController.detalle);
router.post('/:id/subir', multerPaciente.single('archivo'), pacientesController.subirArchivo);
router.post('/:id/progreso', pacientesController.guardarProgreso);


module.exports = router;
