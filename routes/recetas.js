const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload');
const recetasController = require('../controllers/recetaController');
const { requireAuth } = require('../middlewares/auth'); // Tu middleware de autenticación
const { requirePlan } = require('../middlewares/checkPlan'); // <-- 1. IMPORTAMOS NUESTRO GUARDIA

// --- RUTAS DEL PLAN BÁSICO (o para todos los usuarios logueados) ---
// Se necesita iniciar sesión para todas estas acciones.
router.get('/', requireAuth, recetasController.index);
router.get('/nueva', requireAuth, recetasController.nueva);
router.post('/guardar', requireAuth, upload.single('imagen'), recetasController.guardar);
router.get('/ver/:tipo/:id', requireAuth, recetasController.ver);
router.post('/importar-api', requireAuth, recetasController.importarDesdeAPI);


// --- RUTAS PREMIUM ---
// A partir de aquí, solo los usuarios con plan 'premium' (o los admins) podrán pasar.
// Fíjate cómo ponemos a requireAuth primero y luego a requirePlan.

router.get('/papelera', requireAuth, requirePlan(['premium']), recetasController.papelera);
router.post('/archivar/:id', requireAuth, requirePlan(['premium']), recetasController.archivar);
router.get('/editar/:id', requireAuth, requirePlan(['premium']), recetasController.editar);
router.post('/actualizar/:id', requireAuth, upload.single('imagen'), recetasController.actualizar);
router.post('/restaurar/:id', requireAuth, requirePlan(['premium']), recetasController.restaurar);
router.post('/eliminar-definitivo/:id', requireAuth, requirePlan(['premium']), recetasController.eliminar);

// La ruta para eliminar normal (mandar a papelera) también debería ser premium.
// Si la tienes, debería ser así:
// router.post('/eliminar/:id', requireAuth, requirePlan(['premium']), recetasController.eliminar);


// Ruta para limpiar mensajes flash (no necesita protección de plan)
router.post('/clear-flash-error', (req, res) => {
  req.flash('error', '');
  res.sendStatus(200);
});


module.exports = router;
