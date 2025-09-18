const { Op } = require('sequelize');
const Receta = require('../models/Receta');
const PlanAlimenticio = require('../models/PlanAlimenticio');
const sequelize = require('../config/db');
const Paciente = require('../models/Paciente');

const PUBLIC_OWNER_ID = parseInt(process.env.RECETAS_PUBLIC_USER_ID || '2', 10);

/* =========================
  Helpers
========================= */
const normalizeImagen = (img) => {
  if (!img) return null;
  const val = String(img).trim();
  if (val.startsWith('http') || val.startsWith('/uploads/')) return val;
  return `/uploads/recetas/${val}`;
};

const canSeeMisRecetas = (user) => {
  if (!user) return false;
  if (user.rol === 'admin') return true;
  return user.plan === 'premium';
};

const isOwnerOrAdmin = (user, receta) => {
  if (!user) return false;
  if (user.rol === 'admin') return true;
  return receta.usuario_id === user.id;
};

const toInt = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (s === '') return null;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
};

const toFloat = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().replace(',', '.');
  if (s === '') return null;
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
};

const normEnumDificultad = (v) => {
  if (!v) return 'fácil';
  const s = String(v).toLowerCase().trim();
  if (['fácil', 'medio', 'difícil'].includes(s)) return s;
  if (s === 'facil') return 'fácil';
  if (s === 'dificil') return 'difícil';
  return 'fácil';
};

/* =========================
  INDEX (Listado general)
========================= */
const index = async (req, res) => {
  const { q: busqueda, categoria, etiqueta, page = 1 } = req.query;
  const user = req.session?.usuario || {};
  const limit = 12;
  const offset = (page - 1) * limit;

  // soporta ?addToPlan=, ?planId= o ?plan_id=
  const addToPlanId = req.query.addToPlan || req.query.planId || req.query.plan_id || null;
  const backToPlanURL = addToPlanId ? `/planes-alimenticios/${addToPlanId}` : null;

  try {
    const where = { archivada: false };

    if (busqueda) {
      where[Op.or] = [
        { titulo: { [Op.like]: `%${busqueda}%` } },
        { descripcion: { [Op.like]: `%${busqueda}%` } }
      ];
    }
    if (categoria) where.categoria = categoria;
    if (etiqueta) where.etiquetas = { [Op.like]: `%${etiqueta}%` };

    if (user.rol !== 'admin') {
      const visibles = [PUBLIC_OWNER_ID];
      if (user.id) visibles.push(user.id);
      where.usuario_id = { [Op.in]: visibles };
    }

    const { count: totalItems, rows } = await Receta.findAndCountAll({
      where,
      limit,
      offset,
      order: [['titulo', 'ASC']]
    });

    const recetas = rows.map(r => {
      const plain = r.get({ plain: true });
      plain.imagen = normalizeImagen(plain.imagen);
      return plain;
    });

    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const currentPage = Math.max(1, Math.min(parseInt(page, 10) || 1, totalPages));

    const categoriasResult = await Receta.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('categoria')), 'categoria']],
      raw: true
    });

    const todasEtiquetasResult = await Receta.findAll({ attributes: ['etiquetas'], raw: true });
    const etiquetasUnicas = [...new Set(
      todasEtiquetasResult.flatMap(r => r.etiquetas ? r.etiquetas.split(',').map(e => e.trim()) : [])
    )].filter(Boolean);

    res.render('recetas', {
      layout: 'layouts/sistema',
      recetas,
      categorias: categoriasResult.map(c => c.categoria).filter(Boolean),
      etiquetas: etiquetasUnicas,
      busqueda,
      categoriaSeleccionada: categoria || '',
      etiquetaSeleccionada: etiqueta || '',
      pagination: { totalItems, totalPages, currentPage, limit, offset },
      active: 'recetas',
      user,
      messages: req.flash(),
      // props para el EJS
      addToPlanId,
      backToPlanURL,
      query: req.query
    });
  } catch (error) {
    console.error('Error en index de recetas:', error);
    req.flash('error', 'Error al cargar recetas');
    res.redirect('/');
  }
};

const ver = async (req, res) => {
  const { id } = req.params;
  const user = req.session?.usuario || {};

  try {
    const receta = await Receta.findByPk(id);
    if (!receta) {
      req.flash('error', 'Receta no encontrada');
      return res.redirect('/recetas');
    }

    if (user.rol !== 'admin') {
      const isPublic = receta.usuario_id === PUBLIC_OWNER_ID;
      const isMine = user.id && receta.usuario_id === user.id;
      if (!isPublic && !isMine) {
        req.flash('error', 'No tienes permiso para ver esta receta');
        return res.redirect('/recetas');
      }
    }

    const recetaPlain = receta.get({ plain: true });
    recetaPlain.imagen = normalizeImagen(recetaPlain.imagen);

    res.render('recetas_ver', {
      layout: 'layouts/sistema',
      receta: recetaPlain,
      user,
      messages: req.flash()
    });
  } catch (error) {
    console.error('Error al ver receta:', error);
    req.flash('error', 'Error al cargar la receta');
    res.status(500).redirect('/recetas');
  }
};

const importarDesdeAPI = async (req, res) => {
  const user = req.session?.usuario || {};
  if (!user.id) { req.flash('error', 'Debes iniciar sesión para importar recetas.'); return res.redirect('/login'); }

  try {
    const { titulo, categoria, dataAPI } = req.body;
    const recetaData = JSON.parse(dataAPI);

    const tiempoPreparacion = recetaData.totalTime ? toInt(recetaData.totalTime) : null;

    const etiquetas = [...(recetaData.dietLabels || []), ...(recetaData.healthLabels || [])]
      .filter((v, i, self) => self.indexOf(v) === i)
      .join(', ') || null;

    const procesarImagenImportar = (url) => {
      if (!url) return null;
      try {
        const u = String(url).trim();
        if (u.includes('edamam-product-images')) {
          const cleanUrl = u.split('?')[0];
          return cleanUrl.startsWith('http') ? cleanUrl : `https:${cleanUrl}`;
        }
        new URL(u);
        return u;
      } catch {
        return null;
      }
    };

    await Receta.create({
      titulo,
      categoria,
      descripcion: `Receta importada automáticamente. Contiene ${Math.round(recetaData.calories || 0)} calorías totales y rinde aproximadamente ${recetaData.yield || 'N/A'} porciones.`,
      ingredientes: (recetaData.ingredientLines || []).join('\n'),
      preparacion: 'Pasos de preparación no disponibles desde la API. Añadir manualmente.',
      calorias: toInt(recetaData.calories),
      porciones: toInt(recetaData.yield),
      tiempo_preparacion: tiempoPreparacion,
      etiquetas,
      dificultad: 'fácil',
      imagen: procesarImagenImportar(recetaData.image),
      equivalentes_simplificados: false,
      equivalentes_smae: false,
      usuario_id: user.id,
      archivada: false
    });

    req.flash('success', 'Receta importada y guardada en tu recetario.');
    res.redirect('/recetas');
  } catch (error) {
    console.error('Error al importar receta desde API:', error);
    req.flash('error', 'No se pudo importar la receta. Verifica los datos e intenta nuevamente.');
    res.redirect('/recetas');
  }
};

const papelera = async (req, res) => {
  const user = req.session?.usuario || {};

  try {
    const busquedaNombre = req.query.q || '';
    const busquedaCategoria = req.query.categoria || '';
    const busquedaEtiqueta = req.query.etiqueta || '';

    const where = { archivada: true };

    if (user.rol !== 'admin') {
      if (!user.id) {
        return res.render('papelera', {
          layout: 'layouts/sistema',
          recetas: [], categorias: [], etiquetas: [],
          busquedaNombre: '', busquedaCategoria: '', busquedaEtiqueta: '',
          user, messages: req.flash()
        });
      }
      where.usuario_id = user.id;
    }

    if (busquedaNombre) where.titulo = { [Op.like]: `%${busquedaNombre}%` };
    if (busquedaCategoria) where.categoria = busquedaCategoria;
    if (busquedaEtiqueta) where.etiquetas = { [Op.like]: `%${busquedaEtiqueta}%` };

    const recetasBD = await Receta.findAll({ where });
    const recetas = recetasBD.map(r => {
      const plain = r.get({ plain: true });
      plain.imagen = normalizeImagen(plain.imagen);
      return plain;
    });

    const categoriasRaw = await Receta.aggregate('categoria', 'DISTINCT', { plain: false });
    const etiquetasRaw = await Receta.aggregate('etiquetas', 'DISTINCT', { plain: false });

    const categorias = categoriasRaw.map(c => c.DISTINCT).filter(Boolean);
    const etiquetas = etiquetasRaw.map(e => e.DISTINCT).filter(Boolean);

    res.render('papelera', {
      layout: 'layouts/sistema',
      recetas, categorias, etiquetas,
      busquedaNombre, busquedaCategoria, busquedaEtiqueta,
      user, messages: req.flash()
    });
  } catch (error) {
    console.error('Error al cargar la papelera:', error);
    res.status(500).send('Error interno al cargar la papelera');
  }
};
// Archivar receta (mueve a papelera)
const archivar = async (req, res) => {
  const user = req.session?.usuario || {};
  try {
    const receta = await Receta.findByPk(req.params.id);
    if (!receta) {
      req.flash('error', 'Receta no encontrada');
      return res.redirect('/recetas');
    }
    const esDuenio = user.id && receta.usuario_id === user.id;
    if (user.rol !== 'admin' && !esDuenio) {
      req.flash('error', 'No autorizado');
      return res.redirect('/recetas');
    }

    receta.archivada = true;
    await receta.save();

    req.flash('success', 'Receta archivada correctamente.');
    res.redirect('/recetas');
  } catch (error) {
    console.error('Error al archivar receta:', error);
    req.flash('error', 'No se pudo archivar la receta.');
    res.redirect('/recetas');
  }
};
// Nueva (formulario de creación)
const nueva = (req, res) => {
  const user = req.session?.usuario || {};
  if (!user.id) return res.redirect('/login');
  res.render('recetas_form', {
    layout: 'layouts/sistema',
    receta: null,
    active: 'recetas',
    messages: req.flash()
  });
};

const guardar = async (req, res) => {
  const user = req.session?.usuario || {};
  try {
    const { titulo, ingredientes, preparacion, categoria } = req.body;
    if (!titulo || !ingredientes || !preparacion || !categoria) {
      req.flash('error', 'Los campos marcados con * son obligatorios');
      return res.redirect('/recetas/nueva');
    }

    const dataToCreate = {
      titulo: req.body.titulo,
      descripcion: req.body.descripcion || '',
      ingredientes: req.body.ingredientes || '',
      preparacion: req.body.preparacion || '',
      categoria: (req.body.categoria || 'general').toLowerCase(),
      etiquetas: req.body.etiquetas || '',
      tiempo_preparacion: toInt(req.body.tiempo_preparacion),
      tiempo_coccion:     toInt(req.body.tiempo_coccion),
      porciones:          toInt(req.body.porciones),
      dificultad:         normEnumDificultad(req.body.dificultad),
      calorias:           toInt(req.body.calorias),
      proteinas:          toFloat(req.body.proteinas),
      carbohidratos:      toFloat(req.body.carbohidratos),
      grasas:             toFloat(req.body.grasas),
      usuario_id:         user.id,
      archivada:          false
    };

    if (req.file) {
      dataToCreate.imagen = `/uploads/recetas/${req.file.filename}`;
    }

    await Receta.create(dataToCreate);

    req.flash('success', 'Receta creada exitosamente.');
    return canSeeMisRecetas(user) ? res.redirect('/recetas/mis-recetas') : res.redirect('/recetas');
  } catch (error) {
    console.error('Error al guardar receta:', error);
    req.flash('error', 'No se pudo crear la receta.');
    res.redirect('/recetas/nueva');
  }
};

const editar = async (req, res) => {
  const user = req.session?.usuario || {};
  const receta = await Receta.findByPk(req.params.id);
  if (!receta || !isOwnerOrAdmin(user, receta)) {
    return res.status(403).send('No autorizado');
  }
  res.render('recetas_form', {
    layout: 'layouts/sistema',
    receta: receta.get({ plain: true }),
    active: 'recetas',
    messages: req.flash()
  });
};

const actualizar = async (req, res) => {
  const user = req.session?.usuario || {};
  try {
    const receta = await Receta.findByPk(req.params.id);
    if (!receta || !isOwnerOrAdmin(user, receta)) {
      return res.status(403).send('No autorizado');
    }

    const dataToUpdate = {
      titulo: req.body.titulo,
      descripcion: req.body.descripcion || '',
      ingredientes: req.body.ingredientes || '',
      preparacion: req.body.preparacion || '',
      categoria: (req.body.categoria || 'general').toLowerCase(),
      etiquetas: req.body.etiquetas || '',
      tiempo_preparacion: toInt(req.body.tiempo_preparacion),
      tiempo_coccion:     toInt(req.body.tiempo_coccion),
      porciones:          toInt(req.body.porciones),
      dificultad:         normEnumDificultad(req.body.dificultad),
      calorias:           toInt(req.body.calorias),
      proteinas:          toFloat(req.body.proteinas),
      carbohidratos:      toFloat(req.body.carbohidratos),
      grasas:             toFloat(req.body.grasas)
    };

    if (req.file) {
      dataToUpdate.imagen = `/uploads/recetas/${req.file.filename}`;
    }

    await receta.update(dataToUpdate);
    req.flash('success', 'Receta actualizada correctamente.');
    res.redirect(`/recetas/ver/${receta.id}`);
  } catch (error) {
    console.error('Error al actualizar receta:', error);
    req.flash('error', 'No se pudo actualizar la receta.');
    res.redirect(`/recetas/editar/${req.params.id}`);
  }
};

const eliminar = async (req, res) => {
  const user = req.session?.usuario || {};
  try {
    const receta = await Receta.findByPk(req.params.id);
    if (!receta || !isOwnerOrAdmin(user, receta)) {
      return res.status(403).send('No autorizado');
    }
    await receta.destroy();
    req.flash('success', 'Receta eliminada permanentemente.');
    res.redirect('/recetas/papelera');
  } catch (error) {
    console.error('Error al eliminar receta:', error);
    req.flash('error', 'No se pudo eliminar la receta.');
    res.redirect('/recetas/papelera');
  }
};

const restaurar = async (req, res) => {
  const user = req.session?.usuario || {};
  try {
    const receta = await Receta.findByPk(req.params.id);
    if (!receta || !isOwnerOrAdmin(user, receta)) {
      return res.status(403).send('No autorizado');
    }
    receta.archivada = false;
    await receta.save();
    req.flash('success', 'Receta restaurada correctamente.');
    res.redirect('/recetas/papelera');
  } catch (error) {
    console.error('Error al restaurar receta:', error);
    req.flash('error', 'No se pudo restaurar la receta.');
    res.redirect('/recetas/papelera');
  }
};

/* =========================
  Helpers para agregar a Plan
========================= */
const DIAS_ES = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const MEAL_MAP = {
  'desayuno': 'Desayuno',
  'comida': 'Comida',
  'cena': 'Cena',
  'colación': 'Snack',
  'colacion': 'Snack',
  'snack': 'Snack',
  'snack 1': 'Snack 1',
  'snack 2': 'Snack 2',
  'almuerzo': 'Comida',
  'merienda': 'Snack'
};
const dayHeader = (iso) => {
  const d = new Date(iso);
  const name = DIAS_ES[d.getDay()] || 'día';
  return name.charAt(0).toUpperCase() + name.slice(1) + ':'; // "Lunes:"
};
const ensureSection = (md, header) => {
  const re = new RegExp(`^\\s*${header}\\s*$`, 'mi');
  if (re.test(md)) return md;
  return (md?.trim() ? md + '\n\n' : '') + header + '\n';
};
const appendUnder = (md, dayHdr, mealHdr, bullet) => {
  md = ensureSection(md || '', dayHdr);
  const lines = (md || '').split('\n');
  const dayRegex = /^([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+:)\s*$/mi;

  let start = -1, end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().toLowerCase() === dayHdr.toLowerCase()) { start = i; break; }
  }
  if (start >= 0) {
    for (let j = start + 1; j < lines.length; j++) {
      if (dayRegex.test(lines[j])) { end = j; break; }
    }
    const before = lines.slice(0, start).join('\n');
    const block = lines.slice(start, end).join('\n');
    const after  = lines.slice(end).join('\n');

    const hasMeal = new RegExp(`^\\s*${mealHdr}\\s*$`, 'mi').test(block);
    let newBlock = block;
    if (!hasMeal) newBlock += `\n${mealHdr}\n`;
    newBlock += `\n- ${bullet}`;

    return [before, newBlock, after].filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }
  return (md?.trim() ? md + '\n\n' : '') + `${dayHdr}\n${mealHdr}\n- ${bullet}\n`;
};
const buildBullet = (receta, porciones, notas) => {
  const base = `${receta.titulo}${porciones ? ` (x${porciones})` : ''}`;
  return notas ? `${base} — ${notas}` : base;
};

const agregarAPlanForm = async (req, res) => {
  const user = req.session?.usuario || {};
  const { id: recetaId } = req.params;

  try {
    if (!canSeeMisRecetas(user) && user.rol !== 'admin') {
      req.flash('error', 'Necesitas plan Premium para usar esta función.');
      return res.redirect('/recetas');
    }

    const receta = await Receta.findByPk(recetaId);
    if (!receta) { req.flash('error', 'Receta no encontrada.'); return res.redirect('/recetas'); }

    // Acepta plan_id, planId o addToPlan
    const prePlanId = req.query.plan_id || req.query.planId || req.query.addToPlan || null;
    const plan = prePlanId ? await PlanAlimenticio.findByPk(prePlanId) : null;

    const wherePac = (user.rol === 'admin') ? {} : { usuario_id: user.id };
    const pacientes = await Paciente.findAll({ where: wherePac, order: [['nombre', 'ASC']] });

    return res.render('recetas_agregar_a_plan', {
      layout: 'layouts/sistema',
      user,
      receta: receta.get({ plain: true }),
      pacientes,
      plan: plan ? plan.get({ plain: true }) : null,
      messages: req.flash()
    });
  } catch (err) {
    console.error('Error en agregarAPlanForm:', err);
    req.flash('error', 'No se pudo cargar el formulario.');
    return res.redirect('/recetas');
  }
};

const agregarAPlan = async (req, res) => {
  const user = req.session?.usuario || {};
  const { id: recetaId } = req.params;

  // helper para conservar el plan en la URL del form cuando hay error
  const backToFormWithPlan = (planId) =>
    res.redirect(`/recetas/${recetaId}/agregar-a-plan${planId ? `?plan_id=${encodeURIComponent(planId)}` : ''}`);

  const t = await sequelize.transaction();
  try {
    if (!canSeeMisRecetas(user) && user.rol !== 'admin') {
      await t.rollback();
      req.flash('error', 'Necesitas plan Premium para usar esta función.');
      return res.redirect('/recetas');
    }

    const receta = await Receta.findByPk(recetaId);
    if (!receta) {
      await t.rollback();
      req.flash('error', 'Receta no encontrada.');
      return res.redirect('/recetas');
    }

    let { paciente_id, fecha, momento, plan_id, notas, porciones } = req.body;

    // Validaciones mínimas
    if (!paciente_id || !fecha || !momento) {
      await t.rollback();
      req.flash('error', 'Paciente, fecha y momento son obligatorios.');
      return backToFormWithPlan(plan_id);
    }

    // Normaliza fecha
    const tryDate = new Date(fecha);
    if (Number.isNaN(tryDate.getTime())) {
      await t.rollback();
      req.flash('error', 'Fecha inválida.');
      return backToFormWithPlan(plan_id);
    }

    // Normaliza / mapea el momento
    const mealHdr = (MEAL_MAP[String(momento).toLowerCase()] || 'Comida') + ':'; // "Desayuno:" / "Comida:" ...
    const dayHdr  = dayHeader(fecha);                                            // "Lunes:"
    const bullet  = buildBullet(receta, toInt(porciones) || 1, (notas || '').trim());

    let planDestino = null;

    if (plan_id && Number(plan_id) > 0) {
      planDestino = await PlanAlimenticio.findByPk(plan_id, { transaction: t });
      if (!planDestino) {
        await t.rollback();
        req.flash('error', 'El plan seleccionado no existe.');
        return backToFormWithPlan(plan_id);
      }
      // (opcional) validar paciente del plan si quieres
    } else {
      // Crea plan manual vacío si no enviaron plan_id
      planDestino = await PlanAlimenticio.create({
        titulo: `Plan manual • ${fecha}`,
        tipo: 'manual',
        contenido: '',
        paciente_id: toInt(paciente_id),
        usuario_id: user.id || null
      }, { transaction: t });
    }

    // Construye/actualiza el markdown
    const mdActual = planDestino.contenido || '';
    const mdNuevo  = appendUnder(mdActual, dayHdr, mealHdr, bullet);

    await planDestino.update({ contenido: mdNuevo, tipo: 'manual' }, { transaction: t });

    await t.commit();
    req.flash('success', 'Receta agregada al plan del paciente.');
    return res.redirect(`/planes-alimenticios/${planDestino.id}`);
  } catch (err) {
    console.error('Error en agregarAPlan:', err);
    await t.rollback();
    req.flash('error', 'No se pudo agregar la receta al plan.');
    return res.redirect('/planes-alimenticios');
  }
};

const misRecetas = async (req, res) => {
  const { q: busqueda, page = 1 } = req.query;
  const user = req.session?.usuario || {};
  if (!user.id) return res.redirect('/login');

  if (!canSeeMisRecetas(user)) {
    req.flash('error', 'Necesitas plan Premium para acceder a Mis Recetas.');
    return res.redirect('/recetas');
  }

  const limit = 12;
  const offset = (page - 1) * limit;

  // soporta ?addToPlan=, ?planId= o ?plan_id=
  const addToPlanId = req.query.addToPlan || req.query.planId || req.query.plan_id || null;
  const backToPlanURL = addToPlanId ? `/planes-alimenticios/${addToPlanId}` : null;

  try {
    const where = { archivada: false, usuario_id: user.id };
    if (busqueda) where.titulo = { [Op.like]: `%${busqueda}%` };

    const { count: totalItems, rows } = await Receta.findAndCountAll({
      where,
      limit,
      offset,
      order: [['titulo', 'ASC']]
    });

    const recetas = rows.map(r => {
      const plain = r.get({ plain: true });
      plain.imagen = normalizeImagen(plain.imagen);
      return plain;
    });

    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const currentPage = Math.max(1, Math.min(parseInt(page, 10) || 1, totalPages));

    res.render('recetas', {
      layout: 'layouts/sistema',
      recetas,
      categorias: [],
      etiquetas: [],
      busqueda,
      categoriaSeleccionada: null,
      etiquetaSeleccionada: null,
      pagination: { totalItems, totalPages, currentPage, limit, offset },
      active: 'recetas',
      user,
      messages: req.flash(),
      tituloPagina: 'Mis Recetas',
      // props para el EJS
      addToPlanId,
      backToPlanURL,
      query: req.query
    });
  } catch (error) {
    console.error('Error en misRecetas:', error);
    req.flash('error', 'Error al cargar tus recetas');
    res.redirect('/');
  }
};

module.exports = {
  index,
  ver,
  importarDesdeAPI,
  papelera,
  archivar,
  nueva,          // ← ya existe
  guardar,
  editar,
  actualizar,
  eliminar,
  restaurar,
  misRecetas,
  agregarAPlanForm,
  agregarAPlan
};
