// controllers/recetaController.js
const { Op } = require('sequelize');
const Receta = require('../models/Receta');
const sequelize = require('../config/db');

// ID del “dueño” de recetas públicas/descargadas (las 531)
const PUBLIC_OWNER_ID = parseInt(process.env.RECETAS_PUBLIC_USER_ID || '2', 10);

/* =========================
   Helpers
========================= */

// Normaliza rutas de imagen (URL absoluta o /uploads/...)
const normalizeImagen = (img) => {
  if (!img) return null;
  const val = String(img).trim();
  if (val.startsWith('http') || val.startsWith('/uploads/')) return val;
  // si quedó solo el nombre de archivo
  return `/uploads/recetas/${val}`;
};

// ¿El usuario puede ver “Mis Recetas”?
const canSeeMisRecetas = (user) => {
  if (!user) return false;
  if (user.rol === 'admin') return true;
  return user.plan === 'premium';
};

// ¿Es dueño o admin?
const isOwnerOrAdmin = (user, receta) => {
  if (!user) return false;
  if (user.rol === 'admin') return true;
  return receta.usuario_id === user.id;
};

// Casteos seguros: '' -> null, string -> int/float
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

// Normaliza la dificultad al ENUM del modelo: 'fácil' | 'medio' | 'difícil'
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
   Admin: ve TODO (no archivado).
   No admin: ve las públicas (PUBLIC_OWNER_ID) + sus propias.
========================= */
const index = async (req, res) => {
  const { q: busqueda, categoria, etiqueta, page = 1 } = req.query;
  const user = req.session?.usuario || {};
  const limit = 12;
  const offset = (page - 1) * limit;

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

    // Listas para filtros (puedes afinarlas con el mismo "where" si quieres)
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
      messages: req.flash()
    });
  } catch (error) {
    console.error('Error en index de recetas:', error);
    req.flash('error', 'Error al cargar recetas');
    res.redirect('/');
  }
};

/* =========================
   VER (Detalle)
========================= */
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

/* =========================
   IMPORTAR (desde API)
========================= */
const importarDesdeAPI = async (req, res) => {
  const user = req.session?.usuario || {};

  if (!user.id) {
    req.flash('error', 'Debes iniciar sesión para importar recetas.');
    return res.redirect('/login');
  }

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

/* =========================
   PAPELERA
========================= */
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
          recetas: [],
          categorias: [],
          etiquetas: [],
          busquedaNombre: '',
          busquedaCategoria: '',
          busquedaEtiqueta: '',
          user,
          messages: req.flash()
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
      recetas,
      categorias,
      etiquetas,
      busquedaNombre,
      busquedaCategoria,
      busquedaEtiqueta,
      user,
      messages: req.flash()
    });
  } catch (error) {
    console.error('Error al cargar la papelera:', error);
    res.status(500).send('Error interno al cargar la papelera');
  }
};

/* =========================
   ARCHIVAR
========================= */
const archivar = async (req, res) => {
  const user = req.session?.usuario || {};
  try {
    const receta = await Receta.findByPk(req.params.id);
    if (!receta || !isOwnerOrAdmin(user, receta)) {
      return res.status(403).send('No autorizado');
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

/* =========================
   NUEVA
========================= */
const nueva = (req, res) => {
  res.render('recetas_form', { layout: 'layouts/sistema', receta: null, active: 'recetas', messages: req.flash() });
};

/* =========================
   GUARDAR (crear)
========================= */
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

/* =========================
   EDITAR
========================= */
const editar = async (req, res) => {
  const user = req.session?.usuario || {};
  const receta = await Receta.findByPk(req.params.id);
  if (!receta || !isOwnerOrAdmin(user, receta)) {
    return res.status(403).send('No autorizado');
  }
  res.render('recetas_form', { layout: 'layouts/sistema', receta: receta.get({ plain: true }), active: 'recetas', messages: req.flash() });
};

/* =========================
   ACTUALIZAR
========================= */
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

/* =========================
   ELIMINAR (definitivo)
========================= */
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

/* =========================
   RESTAURAR
========================= */
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
   MIS RECETAS (solo admin o premium)
========================= */
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

  try {
    const where = {
      archivada: false,
      usuario_id: user.id
    };

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
      tituloPagina: 'Mis Recetas'
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
  nueva,
  guardar,
  editar,
  actualizar,
  eliminar,
  restaurar,
  misRecetas
};
