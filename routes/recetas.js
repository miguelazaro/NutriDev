const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload');

const recetasController = require('../controllers/recetaController');

router.get('/', recetasController.index);

router.get('/nueva', recetasController.nueva);

router.post('/guardar', upload.single('imagen'), recetasController.guardar);

router.get('/editar/:id', recetasController.editar);
router.post('/actualizar/:id', upload.single('imagen'), recetasController.actualizar);
router.post('/eliminar/:id', recetasController.eliminar);

module.exports = router;
