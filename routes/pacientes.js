const express = require('express');
const router = express.Router();
const pacientesController = require('../controllers/pacientesController');
const upload = require('../middlewares/multerPacientes'); // Solo esta, ya incluye .single y .fields

// Rutas del CRUD
router.get('/', pacientesController.index);
router.get('/nuevo', pacientesController.form);

router.post(
    '/guardar',
    upload.fields([
        { name: 'foto', maxCount: 1 },
        { name: 'archivo', maxCount: 1 }
    ]),
    pacientesController.guardar
);

// Notas del nutriólogo
router.post('/:id/notas', pacientesController.guardarNota);
router.post('/:id/notas/:notaId/eliminar', pacientesController.eliminarNota);

// Edición y eliminación
router.get('/editar/:id', pacientesController.editar);
router.post('/actualizar/:id', upload.fields([
    { name: 'foto', maxCount: 1 },
    { name: 'archivo', maxCount: 1 }
]), pacientesController.actualizar);

router.post('/eliminar/:id', pacientesController.eliminar);

// Detalle
router.get('/:id', pacientesController.detalle);

// Subir archivo adicional
router.post('/:id/subir', upload.single('archivo'), pacientesController.subirArchivo);

// Progreso del paciente
router.post('/:id/progreso', pacientesController.guardarProgreso);

module.exports = router;

console.log(typeof pacientesController.guardarProgreso); // Debería mostrar "function"
