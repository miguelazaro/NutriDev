const express = require('express');
const router = express.Router();

// Ejemplo de ruta
router.get('/login', (req, res) => {
  res.send('Página de login');
});

module.exports = router;
