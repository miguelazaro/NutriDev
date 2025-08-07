const express = require('express');
const router = express.Router();
const { generarPlan } = require('../controllers/iaPlanController');
const { requireAuth } = require('../middlewares/auth');

router.get('/generar-plan/:id', requireAuth, generarPlan);

module.exports = router;
