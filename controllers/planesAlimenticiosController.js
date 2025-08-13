// controllers/planesAlimenticiosController.js
const sanitizeHtml = require('sanitize-html');
const PlanAlimenticio = require('../models/PlanAlimenticio');
const Paciente = require('../models/Paciente');

const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const puppeteer = require('puppeteer');

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Miercoles', 'Jueves', 'Viernes', 'Sábado', 'Sabado', 'Domingo'];
const MEALS = ['Desayuno', 'Snack 1', 'Snack 2', 'Snack', 'Comida', 'Almuerzo', 'Cena'];

let _marked;
const uid  = (req) => req.session?.usuario?.id;
const urol = (req) => req.session?.usuario?.rol || 'nutriologo';

/* ---------------- helpers markdown ---------------- */
function limpiarMarkdownMeta(md) {
  if (!md) return md;
  const lines = md.split(/\r?\n/);
  const start = lines.findIndex(l =>
    /^\s*(\*\*\s*)?(Paciente|Edad|Estatura|Objetivo|Actividad\s*f[ií]sica|Comidas\s+al\s+d[ií]a|Restricciones|Preferencias)\s*:/.test(l)
  );
  if (start === -1) return md;

  let end = start;
  while (
    end < lines.length &&
    lines[end].trim() !== '' &&
    !/^[-*_]{3,}\s*$/.test(lines[end]) &&
    !/^\s*#{1,6}\s+/.test(lines[end])
  ) end++;

  return lines.join('\n')
    .replace(lines.slice(start, end).join('\n'), '')
    .replace(/\n{3,}/g, '\n\n');
}

function parsePlanMarkdown(md) {
  if (!md) return [];
  md = md.replace(/Miercoles/gi, 'Miércoles').replace(/Sabado/gi, 'Sábado');

  const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const MEAL_ALIASES = [
    'Desayuno', 'Snack 1', 'Snack 2', 'Snack', 'Colación', 'Colacion', 'Colación 1', 'Colacion 1',
    'Colación 2', 'Colacion 2', 'Comida', 'Almuerzo', 'Merienda', 'Cena'
  ];

  const lines = md.split(/\r?\n/);
  let days = [];
  let currentDay = null;
  let currentMeal = null;

  const norm = s => (s || '')
    .trim()
    .replace(/^([#>\+\-\*\u2022o\u00B7]\s*)+/g, '')
    .replace(/[*_`~]/g, '')
    .trim();

  const nameOf = (s, arr) => {
    const p = norm(s).replace(/\s*[:\-–—]\s*$/, '').trim();
    return arr.find(d => d.toLowerCase() === p.toLowerCase()) || null;
  };

  const isListItem = s => /^\s*(?:\-|\*|\u2022|o|\u00B7|\u2013|\u2014|\d+\.)\s+/.test(s);

  const pushMealItem = text => {
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

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const dname = nameOf(line, DAY_NAMES);
    if (dname) {
      currentDay = { day: dname, meals: [] };
      days.push(currentDay);
      currentMeal = null;
      continue;
    }

    const meal = nameOf(line, MEAL_ALIASES);
    if (currentDay && meal) {
      currentMeal = { title: meal, items: [] };
      if (/^almuerzo$/i.test(meal)) currentMeal.title = 'Comida';
      if (/^merienda$/i.test(meal)) currentMeal.title = 'Snack';
      currentDay.meals.push(currentMeal);
      continue;
    }

    if (currentDay && (isListItem(raw) || (!/^#/.test(line) && !meal))) {
      pushMealItem(raw);
      continue;
    }
  }

  days = days
    .map(d => ({ ...d, meals: d.meals.filter(m => m.items.length) }))
    .filter(d => d.meals.length);

  return days;
}

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
  const filePath = path.join(__dirname, '../public/assets/img/logo_nutridev.png');
  try {
    if (fs.existsSync(filePath)) {
      const b64 = fs.readFileSync(filePath).toString('base64');
      return `data:image/png;base64,${b64}`;
    }
  } catch (e) {
    console.warn('[PDF] No se pudo leer el logo:', e?.message);
  }
  const base = `${req.protocol}://${req.get('host')}`;
  return `${base}/assets/img/logo_nutridev.png`;
}

async function getMarked() {
  if (!_marked) {
    const mod = await import('marked');
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
      'h1','h2','h3','h4','img','figure','figcaption','span','table','thead','tbody','tr','th','td'
    ]),
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height'],
      '*': ['style', 'class']
    },
    allowedSchemes: ['data', 'http', 'https']
  });
}

/* =========================
   Listar (solo del dueño)
========================= */
exports.index = async (req, res) => {
  try {
    const planes = await PlanAlimenticio.findAll({
      where: { usuario_id: uid(req) },
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

/* =========================
   Guardar desde IA
========================= */
exports.guardarDesdeIA = async (req, res) => {
  try {
    const { titulo, contenido, paciente_id, tipo } = req.body;
    if (!titulo || !contenido) {
      req.flash('error', 'Faltan campos requeridos');
      return res.redirect('back');
    }

    // Valida propiedad del paciente (si viene)
    if (paciente_id) {
      const p = await Paciente.findOne({ where: { id: paciente_id, usuario_id: uid(req) } });
      if (!p) {
        req.flash('error', 'Paciente inválido.');
        return res.redirect('back');
      }
    }

    const plan = await PlanAlimenticio.create({
      titulo,
      contenido,
      paciente_id: paciente_id || null,
      tipo,
      usuario_id: uid(req) // dueño
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

/* =========================
   Editar (vista)
========================= */
exports.editarVista = async (req, res) => {
  try {
    const where = (urol(req) === 'admin')
      ? { id: req.params.id }
      : { id: req.params.id, usuario_id: uid(req) };

    const plan = await PlanAlimenticio.findOne({
      where,
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

/* =========================
   Nuevo (form)
========================= */
exports.nuevoForm = async (req, res) => {
  try {
    const pacientes = await Paciente.findAll({
      where: { usuario_id: uid(req) },
      order: [['nombre', 'ASC']],
      attributes: ['id', 'nombre', 'foto']
    });

    res.render('nuevo-plan', {
      pacientes,
      error: req.flash('error'),
      success: req.flash('success'),
      formData: {
        titulo: '',
        paciente_id: '',
        objetivo: '',
        fecha_inicio: '',
        fecha_fin: '',
        calorias: '',
        contenido: ''
      }
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'No se pudo cargar el formulario.');
    return res.redirect('/planes-alimenticios');
  }
};

/* =========================
   Guardar manual
========================= */
exports.guardarManual = async (req, res) => {
  const { titulo, paciente_id, objetivo, fecha_inicio, fecha_fin, calorias, contenido } = req.body;

  try {
    if (!titulo || !contenido) {
      req.flash('error', 'Título y contenido son obligatorios.');
      const pacientes = await Paciente.findAll({
        where: { usuario_id: uid(req) },
        order: [['nombre', 'ASC']],
        attributes: ['id', 'nombre', 'foto']
      });
      return res.render('nuevo-plan', {
        pacientes,
        error: req.flash('error'),
        success: null,
        formData: req.body
      });
    }

    if (paciente_id) {
      const p = await Paciente.findOne({ where: { id: paciente_id, usuario_id: uid(req) } });
      if (!p) {
        req.flash('error', 'Paciente inválido.');
        return res.redirect('/planes-alimenticios/nuevo');
      }
    }

    const meta = [
      objetivo ? `Objetivo: ${objetivo}` : null,
      fecha_inicio ? `Inicio: ${fecha_inicio}` : null,
      fecha_fin ? `Fin: ${fecha_fin}` : null,
      calorias ? `Calorías objetivo: ${calorias} kcal` : null
    ].filter(Boolean).join('\n');

    let contenidoFinal = meta ? `${meta}\n\n${contenido}` : contenido;

    contenidoFinal = sanitizeHtml(contenidoFinal, {
      allowedTags: ['p','b','i','strong','em','ul','ol','li','br','h1','h2','h3','blockquote','span','u'],
      allowedAttributes: { span: ['style'] }
    });

    await PlanAlimenticio.create({
      titulo,
      tipo: 'manual',
      contenido: contenidoFinal,
      paciente_id: paciente_id || null,
      usuario_id: uid(req)
    });

    req.flash('success', 'Plan manual creado correctamente.');
    return res.redirect('/planes-alimenticios');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Ocurrió un error al guardar el plan.');
    const pacientes = await Paciente.findAll({
      where: { usuario_id: uid(req) },
      order: [['nombre', 'ASC']],
      attributes: ['id', 'nombre', 'foto']
    });
    return res.render('nuevo-plan', {
      pacientes,
      error: req.flash('error'),
      success: null,
      formData: req.body
    });
  }
};

/* =========================
   Eliminar
========================= */
exports.eliminar = async (req, res) => {
  const { id } = req.params;
  try {
    const where = (urol(req) === 'admin') ? { id } : { id, usuario_id: uid(req) };
    const plan = await PlanAlimenticio.findOne({ where });
    if (!plan) {
      req.flash('error', 'El plan no existe o no tienes permiso.');
      return res.redirect('/planes-alimenticios');
    }
    await plan.destroy();
    req.flash('success', 'Plan eliminado correctamente.');
    return res.redirect('/planes-alimenticios');
  } catch (err) {
    console.error('[ELIMINAR PLAN] Error:', err);
    req.flash('error', 'No se pudo eliminar el plan.');
    return res.redirect('/planes-alimenticios');
  }
};

/* =========================
   Actualizar
========================= */
exports.actualizar = async (req, res) => {
  try {
    const where = (urol(req) === 'admin')
      ? { id: req.params.id }
      : { id: req.params.id, usuario_id: uid(req) };

    const plan = await PlanAlimenticio.findOne({ where });
    if (!plan) {
      req.flash('error', 'Plan no encontrado.');
      return res.redirect('/planes-alimenticios');
    }

    const { titulo, contenido } = req.body;
    await plan.update({ titulo, contenido });
    req.flash('success', 'Plan actualizado correctamente');
    res.redirect('/planes-alimenticios');
  } catch (error) {
    console.error('Error al actualizar plan:', error);
    req.flash('error', 'Error al actualizar plan');
    res.redirect('/planes-alimenticios');
  }
};

/* =========================
   Ver / Ver imprimible / Descargar PDF
   (siempre validar propiedad)
========================= */
exports.verVista = async (req, res) => {
  try {
    const where = (urol(req) === 'admin')
      ? { id: req.params.id }
      : { id: req.params.id, usuario_id: uid(req) };

    const plan = await PlanAlimenticio.findOne({
      where,
      include: [{ model: Paciente, as: 'paciente' }]
    });
    if (!plan) {
      req.flash('error', 'Plan no encontrado');
      return res.redirect('/planes-alimenticios');
    }

    const contenidoSeguro = await toSafeHtmlFromMarkdown(plan.contenido);
    res.render('ver-plan', { plan, contenidoSeguro });
  } catch (e) {
    console.error('Error verVista:', e);
    req.flash('error', 'No se pudo cargar el plan.');
    res.redirect('/planes-alimenticios');
  }
};

exports.verImprimible = async (req, res) => {
  try {
    const where = (urol(req) === 'admin')
      ? { id: req.params.id }
      : { id: req.params.id, usuario_id: uid(req) };

    const plan = await PlanAlimenticio.findOne({
      where,
      include: [{ model: Paciente, as: 'paciente' }]
    });
    if (!plan) return res.status(404).send('No encontrado');

    const md = limpiarMarkdownMeta ? limpiarMarkdownMeta(plan.contenido) : plan.contenido;
    const week = parsePlanMarkdown(md);
    const contenidoSeguro = await toSafeHtmlFromMarkdown(md);
    const logoSrc = getLogoSrc(req);
    const edadPaciente = plan.paciente?.fecha_nacimiento ? calcularEdad(plan.paciente.fecha_nacimiento) : null;

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

exports.descargarPDF = async (req, res) => {
  try {
    const where = (urol(req) === 'admin')
      ? { id: req.params.id }
      : { id: req.params.id, usuario_id: uid(req) };

    const plan = await PlanAlimenticio.findOne({
      where,
      include: [{ model: Paciente, as: 'paciente' }]
    });
    if (!plan) {
      req.flash('error', 'Plan no encontrado');
      return res.redirect('/planes-alimenticios');
    }

    const md = limpiarMarkdownMeta ? limpiarMarkdownMeta(plan.contenido) : plan.contenido;
    const week = parsePlanMarkdown(md);
    const contenidoSeguro = await toSafeHtmlFromMarkdown(md);
    const logoSrc = getLogoSrc(req);
    const edadPaciente = plan.paciente?.fecha_nacimiento ? calcularEdad(plan.paciente.fecha_nacimiento) : null;

    const html = await ejs.renderFile(
      path.join(__dirname, '../views/plan-pdf.ejs'),
      { layout: false, plan, contenidoSeguro, logoSrc, edadPaciente, week, showPacienteEnHeader: false },
      { async: true }
    );

    // 👇 Importante para servidores: no-sandbox
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.emulateMediaType('screen');
    try { await page.evaluateHandle('document.fonts.ready'); } catch {}

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });

    await browser.close();

    if (!pdfBuffer?.length) return res.status(500).send('No se pudo generar el PDF.');

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
