const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/auth');
const allowIfSuccess = require('../middlewares/allowIfSuccess');
const cobrosCtrl = require('../controllers/cobrosController');

// Vista principal: permitir ?ok=1/0 o sesión
router.get('/', allowIfSuccess, cobrosCtrl.vistaPrincipal);

// Stripe Connect (privado)
router.get('/stripe/connect',  requireAuth, cobrosCtrl.stripeConnectStart);
router.get('/confirm', requireAuth, cobrosCtrl.confirmarDesdeSession);

// Retornos de Stripe (públicos con ?ok=1/0)
router.get('/stripe/return',   allowIfSuccess, cobrosCtrl.stripeReturn);   // success_url
router.get('/stripe/refresh',  allowIfSuccess, cobrosCtrl.stripeRefresh);  // cancel/refresh_url

// Crear cobro (privado)
router.get('/nuevo',  requireAuth, cobrosCtrl.formNuevoCobro);
router.post('/crear', requireAuth, cobrosCtrl.crearCobroCheckout);

// Acciones sobre un cobro (privadas)
router.get('/:id',           requireAuth, cobrosCtrl.verCobro);
router.get('/:id/reenviar',  requireAuth, cobrosCtrl.reenviarRecibo);
router.delete('/:id',        requireAuth, cobrosCtrl.eliminarCobro);

module.exports = router;

