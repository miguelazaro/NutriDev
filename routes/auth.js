const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { redirectIfAuthenticated } = require('../middlewares/auth');

// Vistas
router.get('/login', redirectIfAuthenticated, authController.loginView);
router.get('/register', redirectIfAuthenticated, authController.registerView);

// Acciones
router.post('/login', authController.loginUser);
router.post('/register', authController.registerUser);

// Cierre de sesión
router.get('/logout', authController.logout);

module.exports = router;
