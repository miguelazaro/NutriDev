// routes/ia.js
const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middlewares/auth');
const { requirePlan } = require('../middlewares/checkPlan');
const iaPlanController = require('../controllers/iaPlanController');

// --- TODAS las entradas que generan plan IA deben ser Premium (o admin) ---

// POST /ia/plan/:id   (id = paciente_id en params)
router.post(
    '/plan/:id',
    requireAuth,
    requirePlan(['premium']),
    iaPlanController.generarPlan
);

// POST /ia/plan  (paciente_id va en body)
router.post(
    '/plan',
    requireAuth,
    requirePlan(['premium']),
    iaPlanController.generarPlan
);

// GET /ia/generar-plan/:id   (compatibilidad antigua)
router.get(
    '/generar-plan/:id',
    requireAuth,
    requirePlan(['premium']),
    iaPlanController.generarPlan
);

module.exports = router;
