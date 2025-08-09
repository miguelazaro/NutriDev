const express = require('express');
const router = express.Router();
const planesController = require('../controllers/planesAlimenticiosController');
const requireAuth = require('../middlewares/auth').requireAuth;
const puppeteer = require('puppeteer');

// =============================
// Rutas para planes alimenticios IA
// =============================
router.get('/', requireAuth, planesController.index);
router.post('/guardar-desde-ia/:id', requireAuth, planesController.guardarDesdeIA);
router.post('/guardar', requireAuth, planesController.guardarDesdeIA);

// =============================
// Rutas para editar y actualizar
// =============================
router.get('/:id/editar', requireAuth, planesController.editarVista);
router.put('/:id', requireAuth, planesController.actualizar);

// =============================
// Rutas para ver, imprimir y descargar PDF
// =============================
router.get('/:id', requireAuth, planesController.verVista);            // Ver plan (HTML)
router.get('/:id/print', requireAuth, planesController.verImprimible); // Versión imprimible (HTML)
router.get('/:id/pdf', requireAuth, planesController.descargarPDF);    // Descargar PDF

// =============================
// Ruta de debug: ver HTML usado para el PDF
// (reusa el render imprimible para inspección)
// =============================
router.get('/:id/html-debug', requireAuth, planesController.verImprimible);

// =============================
// Ruta de prueba: generar PDF simple (para validar Puppeteer)
// =============================
router.get('/:id/pdf-test', requireAuth, async (req, res) => {
    try {
        const browser = await puppeteer.launch({
            headless: 'new',
            // Si tienes problemas en tu entorno, prueba:
            // args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

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

module.exports = router;