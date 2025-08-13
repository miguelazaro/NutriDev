// routes/ia.js
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/auth');
const iaPlanController = require('../controllers/iaPlanController');

// Ruta nueva y recomendada (POST)
router.post('/plan/:id', requireAuth, iaPlanController.generarPlan);
// Alternativa por body (POST /ia/plan con { paciente_id })
router.post('/plan', requireAuth, iaPlanController.generarPlan);

// Compatibilidad con tu ruta vieja (GET)
router.get('/generar-plan/:id', requireAuth, iaPlanController.generarPlan);

module.exports = router;

