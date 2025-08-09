// controllers/planesAlimenticiosController.js
const PlanAlimenticio = require('../models/PlanAlimenticio');
const Paciente = require('../models/Paciente');

// ✅ dynamic import para ESM
const sanitizeHtml = require('sanitize-html');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const puppeteer = require('puppeteer');

// === helpers en tu controlador ===
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Miercoles', 'Jueves', 'Viernes', 'Sábado', 'Sabado', 'Domingo'];
const MEALS = ['Desayuno', 'Snack 1', 'Snack 2', 'Snack', 'Comida', 'Almuerzo', 'Cena'];

let _marked; // cache

// en tu controlador (arriba del todo o junto a otros helpers)
function limpiarMarkdownMeta(md) {
    if (!md) return md;
    const lines = md.split(/\r?\n/);

    // Busca la primera línea que parezca el inicio del bloque meta
    const start = lines.findIndex(l =>
        /^\s*(\*\*\s*)?(Paciente|Edad|Estatura|Objetivo|Actividad\s*f[ií]sica|Comidas\s+al\s+d[ií]a|Restricciones|Preferencias)\s*:/.test(l)
    );

    if (start === -1) return md;

    // Avanza hasta que termine el bloque: línea en blanco o separador --- o ### etc.
    let end = start;
    while (
        end < lines.length &&
        lines[end].trim() !== '' &&
        !/^[-*_]{3,}\s*$/.test(lines[end]) &&   // --- o *** como separador
        !/^\s*#{1,6}\s+/.test(lines[end])      // siguiente encabezado Markdown
    ) {
        end++;
    }

    // Elimina el bloque y una línea en blanco extra si la hay
    const removeCount = (lines[end] && lines[end].trim() === '') ? (end - start + 1) : (end - start);
    lines.splice(start, removeCount);

    // Compacta saltos de línea excesivos
    return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

function parsePlanMarkdown(md) {
    if (!md) return [];

    // Normaliza tildes frecuentes
    md = md.replace(/Miercoles/gi, 'Miércoles')
        .replace(/Sabado/gi, 'Sábado');

    const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const MEAL_ALIASES = [
        'Desayuno', 'Snack 1', 'Snack 2', 'Snack', 'Colación', 'Colacion', 'Colación 1', 'Colacion 1', 'Colación 2', 'Colacion 2',
        'Comida', 'Almuerzo', 'Merienda', 'Cena'
    ];

    const lines = md.split(/\r?\n/);

    let days = [];
    let currentDay = null;
    let currentMeal = null;

    // Quita bullets/hashes/negritas al inicio con ESCAPES unicode
    const norm = (s) => (s || '')
        .trim()
        // ^([#>\+\-\*\u2022o\u00B7]\s*)+   -> #, >, +, -, *, •(2022), o, ·(00B7)
        .replace(/^([#>\+\-\*\u2022o\u00B7]\s*)+/g, '')
        .replace(/[*_`~]/g, '')
        .trim();

    const isDay = (s) => {
        const p = norm(s).replace(/\s*[:\-–—]\s*$/, '').trim();
        return DAY_NAMES.some(d => p.toLowerCase() === d.toLowerCase());
    };
    const dayName = (s) => {
        const p = norm(s).replace(/\s*[:\-–—]\s*$/, '').trim();
        return DAY_NAMES.find(d => d.toLowerCase() === p.toLowerCase()) || null;
    };

    const isMealHeader = (s) => {
        const p = norm(s).replace(/\s*[:\-–—]\s*$/, '').trim();
        return MEAL_ALIASES.some(m => p.toLowerCase() === m.toLowerCase());
    };
    const mealTitle = (s) => {
        let p = norm(s).replace(/\s*[:\-–—]\s*$/, '').trim();
        if (/^almuerzo$/i.test(p)) p = 'Comida';
        if (/^merienda$/i.test(p)) p = 'Snack';
        if (/^colaci[oó]n\s*1?$/i.test(p)) p = 'Snack 1';
        if (/^colaci[oó]n\s*2$/i.test(p)) p = 'Snack 2';
        return p.charAt(0).toUpperCase() + p.slice(1);
    };

    // Ítems de lista: -, *, •(2022), o, ·(00B7), –(2013), —(2014), o "1."
    const isListItem = (s) => /^\s*(?:\-|\*|\u2022|o|\u00B7|\u2013|\u2014|\d+\.)\s+/.test(s);

    const pushMealItem = (text) => {
        if (!currentDay) return;
        if (!currentMeal) {
            currentMeal = { title: 'Menú', items: [] };
            currentDay.meals.push(currentMeal);
        }
        const cleaned = String(text).trim()
            .replace(/^\s*\d+\.\s+/, '')
            .replace(/^\s*(?:\-|\*|\u2022|o|\u00B7|\u2013|\u2014)\s+/, '');
        if (cleaned) currentMeal.items.push(cleaned);
    };

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const line = raw.trim();
        if (!line) continue;

        // Día
        const dname = dayName(line);
        if (dname) {
            currentDay = { day: dname, meals: [] };
            days.push(currentDay);
            currentMeal = null;
            continue;
        }

        // Encabezado de comida
        if (currentDay && isMealHeader(line)) {
            currentMeal = { title: mealTitle(line), items: [] };
            currentDay.meals.push(currentMeal);
            continue;
        }

        // Ítem de lista o texto suelto bajo un día
        if (currentDay && (isListItem(raw) || (!/^#/.test(line) && !isMealHeader(line)))) {
            pushMealItem(raw);
            continue;
        }
    }

    // Limpia días sin ítems
    days = days
        .map(d => ({ ...d, meals: d.meals.filter(m => m.items.length) }))
        .filter(d => d.meals.length);

    return days;
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function calcularEdad(fechaNacimiento) {
    if (!fechaNacimiento) return null;
    const hoy = new Date();
    const n = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - n.getFullYear();
    const m = hoy.getMonth() - n.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < n.getDate())) edad--;
    return edad;
}

function getLogoSrc(req) {
    // Ajusta el path si tu logo cambia de nombre o carpeta
    const filePath = path.join(__dirname, '../public/assets/img/logo_nutridev.png');
    try {
        if (fs.existsSync(filePath)) {
            const b64 = fs.readFileSync(filePath).toString('base64');
            return `data:image/png;base64,${b64}`;
        }
    } catch (e) {
        console.warn('[PDF] No se pudo leer el logo como base64:', e?.message);
    }
    // Fallback por si no se encuentra el archivo: usa URL absoluta
    const base = `${req.protocol}://${req.get('host')}`;
    return `${base}/assets/img/logo_nutridev.png`;
}

async function getMarked() {
    if (!_marked) {
        const mod = await import('marked'); // ESM
        _marked = mod.marked;
        _marked.setOptions({ breaks: true });
    }
    return _marked;
}

async function toSafeHtmlFromMarkdown(mdText) {
    const marked = await getMarked();
    const html = marked.parse(mdText || '');
    return sanitizeHtml(html, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat([
            'h1', 'h2', 'h3', 'h4', 'img', 'figure', 'figcaption', 'span', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
        ]),
        allowedAttributes: {
            a: ['href', 'name', 'target', 'rel'],
            img: ['src', 'alt', 'width', 'height'],
            '*': ['style', 'class']
        },
        allowedSchemes: ['data', 'http', 'https']
    });
}

exports.index = async (req, res) => {
    try {
        const planes = await PlanAlimenticio.findAll({
            include: [{ model: Paciente, as: 'paciente' }],
            order: [['createdAt', 'DESC']]
        });

        res.render('planes-alimenticios', {
            planes,
            success: req.flash('success'),
            error: req.flash('error')
        });
    } catch (error) {
        console.error('Error al obtener planes alimenticios:', error);
        req.flash('error', 'Error al obtener planes alimenticios.');
        res.render('planes-alimenticios', { planes: [], success: null, error: req.flash('error') });
    }
};

//funcion para guardar un plan alimenticio desde IA
exports.guardarDesdeIA = async (req, res) => {
    try {
        const { titulo, contenido, paciente_id, tipo } = req.body;

        if (!titulo || !contenido) {
            req.flash('error', 'Faltan campos requeridos');
            return res.redirect('back');
        }

        const plan = await PlanAlimenticio.create({
            titulo,
            contenido,
            paciente_id,
            tipo,
            usuario_id: req.session.usuario?.id || null
        });

        console.log('✅ Plan creado:', plan?.id);

        req.flash('success', 'Plan guardado exitosamente');
        res.redirect('back');
    } catch (error) {
        console.error('Error al guardar plan IA:', error);
        req.flash('error', 'Error al guardar el plan.');
        res.redirect('back');
    }
};

// Mostrar formulario de edición
exports.editarVista = async (req, res) => {
    try {
        const plan = await PlanAlimenticio.findByPk(req.params.id, {
            include: [{ model: Paciente, as: 'paciente' }]
        });

        if (!plan) {
            req.flash('error', 'Plan no encontrado');
            return res.redirect('/planes-alimenticios');
        }

        res.render('editar-plan', { plan });
    } catch (error) {
        console.error('Error al cargar vista de edición:', error);
        req.flash('error', 'Ocurrió un error');
        res.redirect('/planes-alimenticios');
    }
};

// Actualizar plan
exports.actualizar = async (req, res) => {
    try {
        const { titulo, contenido } = req.body;

        await PlanAlimenticio.update(
            { titulo, contenido },
            { where: { id: req.params.id } }
        );

        req.flash('success', 'Plan actualizado correctamente');
        res.redirect('/planes-alimenticios');
    } catch (error) {
        console.error('Error al actualizar plan:', error);
        req.flash('error', 'Error al actualizar plan');
        res.redirect('/planes-alimenticios');
    }
};

// verVista
exports.verVista = async (req, res) => {
    try {
        const plan = await PlanAlimenticio.findByPk(req.params.id, {
            include: [{ model: Paciente, as: 'paciente' }]
        });
        if (!plan) { req.flash('error', 'Plan no encontrado'); return res.redirect('/planes-alimenticios'); }

        const contenidoSeguro = await toSafeHtmlFromMarkdown(plan.contenido); // 👈

        res.render('ver-plan', { plan, contenidoSeguro });
    } catch (e) {
        console.error('Error verVista:', e);
        req.flash('error', 'No se pudo cargar el plan.');
        res.redirect('/planes-alimenticios');
    }
};

// verImprimible
exports.verImprimible = async (req, res) => {
    try {
        const plan = await PlanAlimenticio.findByPk(req.params.id, {
            include: [{ model: Paciente, as: 'paciente' }]
        });
        if (!plan) return res.status(404).send('No encontrado');

        // 1) Limpia meta y parsea semana
        const md = limpiarMarkdownMeta ? limpiarMarkdownMeta(plan.contenido) : plan.contenido;
        const week = parsePlanMarkdown(md);

        // 2) HTML seguro del markdown limpio (fallback)
        const contenidoSeguro = await toSafeHtmlFromMarkdown(md);

        // 3) Logo + edad
        const logoSrc = getLogoSrc(req);
        const edadPaciente = plan.paciente && plan.paciente.fecha_nacimiento
            ? calcularEdad(plan.paciente.fecha_nacimiento)
            : null;

        // 4) Render
        res.render('plan-pdf', {
            layout: false,
            plan,
            contenidoSeguro,
            logoSrc,
            edadPaciente,
            week,
            showPacienteEnHeader: false
        });
    } catch (e) {
        console.error('Error verImprimible:', e);
        res.status(500).send('Error');
    }
};

// descargarPDF (EJS -> HTML -> PDF)
exports.descargarPDF = async (req, res) => {
    try {
        const plan = await PlanAlimenticio.findByPk(req.params.id, {
            include: [{ model: Paciente, as: 'paciente' }]
        });
        if (!plan) { req.flash('error', 'Plan no encontrado'); return res.redirect('/planes-alimenticios'); }

        const md = limpiarMarkdownMeta ? limpiarMarkdownMeta(plan.contenido) : plan.contenido;
        const week = parsePlanMarkdown(md);
        const contenidoSeguro = await toSafeHtmlFromMarkdown(md);

        const logoSrc = getLogoSrc(req);
        const edadPaciente = plan.paciente && plan.paciente.fecha_nacimiento
            ? calcularEdad(plan.paciente.fecha_nacimiento)
            : null;

        // (debug opcional)
        console.log('[PDF] week length:', week ? week.length : 0);

        const html = await ejs.renderFile(
            path.join(__dirname, '../views/plan-pdf.ejs'),
            { layout: false, plan, contenidoSeguro, logoSrc, edadPaciente, week, showPacienteEnHeader: false },
            { async: true }
        );

        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'load' });
        await page.emulateMediaType('screen');
        try { await page.evaluateHandle('document.fonts.ready'); } catch { }

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0', right: '0', bottom: '0', left: '0' }
        });

        await browser.close();
        if (!pdfBuffer || !pdfBuffer.length) return res.status(500).send('No se pudo generar el PDF (buffer vacío).');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', pdfBuffer.length);
        res.setHeader('Content-Disposition', `inline; filename="plan-${plan.id}.pdf"`);
        res.end(pdfBuffer);
    } catch (e) {
        console.error('Error descargarPDF:', e);
        req.flash('error', 'No se pudo generar el PDF.');
        res.redirect(`/planes-alimenticios/${req.params.id}`);
    }
};