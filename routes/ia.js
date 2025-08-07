// routes/ia.js
const express = require('express');
const router = express.Router();
const { generarPlan } = require('../controllers/iaPlanController');
const { requireAuth } = require('../middlewares/auth');

// Ruta protegida
router.get('/plan/:id', requireAuth, generarPlan);

module.exports = router;
