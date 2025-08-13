const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/auth');
const planesController = require('../controllers/planesController');

// Esta ruta muestra los planes (se queda igual)
router.get('/', requireAuth, planesController.vistaPlanes);

// Esta ruta inicia la compra (se queda igual)
router.get('/comprar/:tipo', requireAuth, planesController.comprarPlan);

// Aquí es donde Stripe mandará al usuario después de un pago exitoso.
router.get('/success', requireAuth, planesController.pagoExitoso);

module.exports = router;
