const express = require('express');
const router = express.Router();
const planesController = require('../controllers/planesAlimenticiosController');
const { requireAuth } = require('../middlewares/auth');
const puppeteer = require('puppeteer');

// =============================
// Listado
// =============================
router.get('/', requireAuth, planesController.index);

// =============================
// NUEVO plan manual 
// =============================
router.get('/nuevo', requireAuth, planesController.nuevoForm);
router.post('/', requireAuth, planesController.guardarManual);

// Eliminar plan (usar method-override)
router.delete('/:id', requireAuth, planesController.eliminar);


// =============================
// Planes IA
// =============================
router.post('/guardar-desde-ia/:id', requireAuth, planesController.guardarDesdeIA);
router.post('/guardar', requireAuth, planesController.guardarDesdeIA);

// =============================
// Editar / actualizar (antes de '/:id')
// =============================
router.get('/:id/editar', requireAuth, planesController.editarVista);
router.put('/:id', requireAuth, planesController.actualizar);

// =============================
// Ver / imprimir / PDF / debug (pueden ir antes o después, '/:id' al final)
// =============================
router.get('/:id/print', requireAuth, planesController.verImprimible);
router.get('/:id/pdf', requireAuth, planesController.descargarPDF);
router.get('/:id/html-debug', requireAuth, planesController.verImprimible);

// =============================
// Prueba Puppeteer
// =============================
router.get('/:id/pdf-test', requireAuth, async (req, res) => {
    try {
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        await page.setContent(`
      <!doctype html><html><body>
        <h1>PDF de prueba</h1>
        <p>Si ves este PDF, Puppeteer funciona correctamente.</p>
      </body></html>
    `, { waitUntil: 'load' });
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
        await browser.close();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', pdfBuffer.length);
        res.setHeader('Content-Disposition', 'inline; filename="test.pdf"');
        res.end(pdfBuffer);
    } catch (err) {
        console.error('[PDF-TEST] Error:', err);
        res.status(500).send('PDF-TEST falló');
    }
});

// =============================
// Ver plan (deja esta al FINAL)
// =============================
router.get('/:id', requireAuth, planesController.verVista);

module.exports = router;