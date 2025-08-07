const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/auth');
const cobrosController = require('../controllers/cobrosController');

// Ruta principal que mostrará el dashboard de cobros.
// En el futuro, esta función también será premium.
router.get('/', requireAuth, cobrosController.vistaPrincipal);

// Aquí iremos añadiendo más rutas después, como la de vincular Stripe
// y la de crear un nuevo cobro.

module.exports = router;
