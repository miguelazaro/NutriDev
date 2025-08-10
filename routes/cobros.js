const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/auth');
const cobrosCtrl = require('../controllers/cobrosController');

// Vista principal
router.get('/', requireAuth, cobrosCtrl.vistaPrincipal);

// --- Stripe Connect (onboarding) ---
router.get('/stripe/connect', requireAuth, cobrosCtrl.stripeConnectStart);
router.get('/stripe/return',  requireAuth, cobrosCtrl.stripeReturn);   // success_url
router.get('/stripe/refresh', requireAuth, cobrosCtrl.stripeRefresh);  // refresh_url

// --- Crear cobro (Checkout Session) ---
router.get('/nuevo',  requireAuth, cobrosCtrl.formNuevoCobro);
router.post('/crear', requireAuth, cobrosCtrl.crearCobroCheckout);

// (Placeholders opcionales para acciones sobre un cobro)
router.get('/:id',               requireAuth, cobrosCtrl.verCobro);
router.get('/:id/reenviar',      requireAuth, cobrosCtrl.reenviarRecibo);
router.delete('/:id',            requireAuth, cobrosCtrl.eliminarCobro);

module.exports = router;
