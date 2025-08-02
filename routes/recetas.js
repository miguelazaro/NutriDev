const { requireAuth } = require('../middlewares/auth');
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
router.get('/papelera', recetasController.papelera);
router.post('/archivar/:id', recetasController.archivar);
router.post('/restaurar/:id', requireAuth, recetasController.restaurar);
router.post('/eliminar-definitivo/:id', requireAuth, recetasController.eliminar);
router.get('/ver/:tipo/:id', requireAuth, recetasController.ver);

// Nueva ruta para limpiar mensajes flash de error
router.post('/clear-flash-error', (req, res) => {
  req.flash('error', ''); // Limpia el mensaje de error
  res.sendStatus(200);
});

module.exports = router;