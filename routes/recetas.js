// routes/recetas.js
const express = require('express');
const router = express.Router();

const uploadRecetas = require('../middlewares/uploadRecetas'); // <-- middleware específico para recetas
const recetasController = require('../controllers/recetaController');
const { requireAuth } = require('../middlewares/auth');
const { requirePlan } = require('../middlewares/checkPlan');

// --- RUTAS BÁSICAS (usuario logueado) ---
router.get('/', requireAuth, recetasController.index);
router.get('/nueva', requireAuth, recetasController.nueva);

// subir imagen de receta (usa uploadRecetas)
router.post('/guardar', requireAuth, uploadRecetas.single('imagen'), recetasController.guardar);

router.get('/ver/:id', requireAuth, recetasController.ver);
router.post('/importar-api', requireAuth, recetasController.importarDesdeAPI);

// --- RUTAS PREMIUM (o admin, según tu requirePlan) ---
router.get('/papelera', requireAuth, requirePlan(['premium']), recetasController.papelera);

// el form en la vista usa ?_method=PATCH, así que soportamos PATCH;
// si además quieres aceptar POST puro, deja ambas rutas.
router.patch('/archivar/:id', requireAuth, requirePlan(['premium']), recetasController.archivar);
router.post('/archivar/:id', requireAuth, requirePlan(['premium']), recetasController.archivar);

router.get('/editar/:id', requireAuth, requirePlan(['premium']), recetasController.editar);

// actualizar con imagen (usa uploadRecetas)
router.post('/actualizar/:id', requireAuth, uploadRecetas.single('imagen'), recetasController.actualizar);

router.post('/restaurar/:id', requireAuth, requirePlan(['premium']), recetasController.restaurar);
router.post('/eliminar-definitivo/:id', requireAuth, requirePlan(['premium']), recetasController.eliminar);

// Mis recetas (según controller valida premium/admin)
router.get('/mis-recetas', requireAuth, recetasController.misRecetas);

// Limpia flash
router.post('/clear-flash-error', (req, res) => {
  req.flash('error', '');
  res.sendStatus(200);
});

module.exports = router;
