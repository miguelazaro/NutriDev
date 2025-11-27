const { Cita, Paciente } = require("../models/associations");
const { Op } = require("sequelize");

// ===================== LISTADO =====================
module.exports.index = async (req, res) => {
  try {
    const usuarioId = req.session.usuario.id;

    const citas = await Cita.findAll({
      where: { usuario_id: usuarioId },
      include: [
        {
          model: Paciente,
          as: "paciente",
          attributes: ["nombre"],
        },
      ],
      order: [["fecha", "DESC"], ["hora", "ASC"]],
    });

    const citasMapped = citas.map((c) => ({
      id: c.id,
      paciente: c.paciente ? c.paciente.nombre : "Sin nombre",
      fecha: c.fecha,
      hora: c.hora,
      motivo: c.motivo,
      estado: c.estado,
    }));

    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    const nuevasEsteMes = await Cita.count({
      where: {
        usuario_id: usuarioId,
        fecha_creacion: { [Op.gte]: inicioMes },
      },
    });

    const estados = ["Pendiente", "Confirmada", "Cancelada", "Completada"];
    const distribucionEstados = {};

    for (const est of estados) {
      distribucionEstados[est] = await Cita.count({
        where: { usuario_id: usuarioId, estado: est },
      });
    }

    res.render("citas/index", {
      citas: citasMapped,
      nuevasEsteMes,
      distribucionEstados,
      messages: req.flash(),
    });
  } catch (error) {
    console.error(error);
    req.flash("error", "Error al cargar citas");
    return res.redirect("/");
  }
};

// ===================== FORMULARIO NUEVA CITA =====================
module.exports.form = async (req, res) => {
  try {
    const usuarioId = req.session.usuario.id;

    const pacientes = await Paciente.findAll({
      where: { usuario_id: usuarioId },
      attributes: ["id", "nombre"],
    });

    res.render("citas/create", { pacientes, messages: req.flash() });
  } catch (error) {
    console.error(error);
    req.flash("error", "Error al cargar formulario");
    res.redirect("/citas");
  }
};

// ===================== GUARDAR =====================
module.exports.guardar = async (req, res) => {
  try {
    const usuarioId = req.session.usuario.id;
    const { paciente_id, fecha, hora, motivo, observaciones } = req.body;

    await Cita.create({
      usuario_id: usuarioId,
      paciente_id,
      fecha,
      hora,
      motivo,
      observaciones,
      estado: "Pendiente",
    });

    req.flash("success", "Cita registrada correctamente");
    res.redirect("/citas");
  } catch (error) {
    console.error(error);
    req.flash("error", "No se pudo registrar la cita");
    res.redirect("/citas/nueva");
  }
};

// ===================== EDITAR =====================
module.exports.editar = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.session.usuario.id;

    const cita = await Cita.findOne({
      where: { id, usuario_id: usuarioId },
    });

    if (!cita) {
      req.flash("error", "Cita no encontrada");
      return res.redirect("/citas");
    }

    const pacientes = await Paciente.findAll({
      where: { usuario_id: usuarioId },
      attributes: ["id", "nombre"],
    });

    res.render("citas/editar", { cita, pacientes, messages: req.flash() });
  } catch (error) {
    console.error(error);
    req.flash("error", "Error al cargar cita");
    res.redirect("/citas");
  }
};

// ===================== ACTUALIZAR =====================
module.exports.actualizar = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.session.usuario.id;
    const { paciente_id, fecha, hora, motivo, estado, observaciones } = req.body;

    await Cita.update(
      { paciente_id, fecha, hora, motivo, estado, observaciones },
      { where: { id, usuario_id: usuarioId } }
    );

    req.flash("success", "Cita actualizada correctamente");
    res.redirect("/citas");
  } catch (error) {
    console.error(error);
    req.flash("error", "Error al actualizar la cita");
    res.redirect(`/citas/editar/${id}`);
  }
};

// ===================== ELIMINAR =====================
module.exports.eliminar = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.session.usuario.id;

    await Cita.destroy({
      where: { id, usuario_id: usuarioId },
    });

    req.flash("success", "Cita eliminada correctamente");
    res.redirect("/citas");
  } catch (error) {
    console.error(error);
    req.flash("error", "Error al eliminar cita");
    res.redirect("/citas");
  }
};

// ===================== DETALLE =====================
module.exports.detalle = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.session.usuario.id;

    const cita = await Cita.findOne({
      where: { id, usuario_id: usuarioId },
      include: [{ model: Paciente, as: "paciente" }],
    });

    if (!cita) {
      req.flash("error", "Cita no encontrada");
      return res.redirect("/citas");
    }

    res.render("citas/detalle", { cita, messages: req.flash() });
  } catch (error) {
    console.error(error);
    req.flash("error", "Error al cargar detalles");
    res.redirect("/citas");
  }
};
