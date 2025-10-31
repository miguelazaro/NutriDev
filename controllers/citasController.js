// controllers/citasController.js
const db = require('../config/db'); // o tu conexión
const moment = require('moment');
const Paciente = require('../models/Paciente');

const citasController = {
  index: async (req, res) => {
    try {
      const [citas] = await db.query('SELECT * FROM citas ORDER BY fecha DESC');

      // estadísticas
      const mesActual = moment().month() + 1;
      const [nuevasEsteMes] = await db.query(
        'SELECT COUNT(*) AS total FROM citas WHERE MONTH(fecha) = ?',
        { replacements: [mesActual] }
      );

      // distribución por estado
      const [estados] = await db.query(`
        SELECT estado, COUNT(*) AS total 
        FROM citas 
        GROUP BY estado
      `);

      const distribucionEstados = {};
      estados.forEach(e => distribucionEstados[e.estado] = e.total);

      res.render('citas/index', {
        citas,
        nuevasEsteMes: nuevasEsteMes[0].total,
        distribucionEstados,
        messages: req.flash()
      });
    } catch (error) {
      console.error(error);
      req.flash('error', 'Error al cargar citas');
      res.redirect('/');
    }
  },

form: async (req, res) => {
  const pacientes = await Paciente.findAll(); // o tu consulta
  res.render('citas/form', { pacientes, messages: req.flash() });
},


  guardar: async (req, res) => {
    try {
      const { paciente, fecha, motivo } = req.body;
      await db.query('INSERT INTO citas (paciente, fecha, motivo, estado) VALUES (?, ?, ?, ?)', [
        paciente,
        fecha,
        motivo,
        'Pendiente'
      ]);
      req.flash('success', 'Cita registrada correctamente');
      res.redirect('/citas');
    } catch (error) {
      console.error(error);
      req.flash('error', 'No se pudo registrar la cita');
      res.redirect('/citas/nueva');
    }
  },

  editar: async (req, res) => {
    const { id } = req.params;
    const [rows] = await db.query('SELECT * FROM citas WHERE id = ?', [id]);
    res.render('citas/editar', { cita: rows[0], messages: req.flash() });
  },

  actualizar: async (req, res) => {
    const { id } = req.params;
    const { paciente, fecha, motivo, estado } = req.body;
    try {
      await db.query('UPDATE citas SET paciente=?, fecha=?, motivo=?, estado=? WHERE id=?', [
        paciente,
        fecha,
        motivo,
        estado,
        id
      ]);
      req.flash('success', 'Cita actualizada correctamente');
      res.redirect('/citas');
    } catch (error) {
      req.flash('error', 'Error al actualizar la cita');
      res.redirect(`/citas/editar/${id}`);
    }
  },

  eliminar: async (req, res) => {
    const { id } = req.params;
    try {
      await db.query('DELETE FROM citas WHERE id = ?', [id]);
      req.flash('success', 'Cita eliminada');
      res.redirect('/citas');
    } catch (error) {
      req.flash('error', 'Error al eliminar la cita');
      res.redirect('/citas');
    }
  },

  detalle: async (req, res) => {
    const { id } = req.params;
    const [rows] = await db.query('SELECT * FROM citas WHERE id = ?', [id]);
    if (!rows[0]) {
      req.flash('error', 'Cita no encontrada');
      return res.redirect('/citas');
    }
    res.render('citas/detalle', { cita: rows[0], messages: req.flash() });
  },

  reagendar: async (req, res) => {
    const { id } = req.params;
    const { nuevaFecha } = req.body;
    try {
      await db.query('UPDATE citas SET fecha = ? WHERE id = ?', [nuevaFecha, id]);
      req.flash('success', 'Cita reagendada');
      res.redirect(`/citas/${id}`);
    } catch (error) {
      req.flash('error', 'No se pudo reagendar la cita');
      res.redirect(`/citas/${id}`);
    }
  },

  cambiarEstado: async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;
    try {
      await db.query('UPDATE citas SET estado = ? WHERE id = ?', [estado, id]);
      req.flash('success', `Estado actualizado a ${estado}`);
      res.redirect(`/citas/${id}`);
    } catch (error) {
      req.flash('error', 'Error al cambiar estado');
      res.redirect(`/citas/${id}`);
    }
  }
};

module.exports = citasController;
