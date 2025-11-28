const express = require("express");
const router = express.Router();
const path = require("path");

// Importar modelos
const { Paciente, PlanAlimenticio } = require("../models/associations");
const PlanReceta = require("../models/PlanReceta");
const Receta = require("../models/Receta");


// ======================================================
// 📌 0) MODO OFFLINE (PRIMERO!!! OBLIGATORIO)
// ======================================================
router.get("/offline", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "paciente_pwa", "offline.html"));
});


// ======================================================
// 📌 1) VISTA PRINCIPAL  —  /paciente_pwa/:idPaciente
// ======================================================
router.get("/:idPaciente", async (req, res) => {
    try {
        const { idPaciente } = req.params;

        const paciente = await Paciente.findByPk(idPaciente);
        if (!paciente) {
            return res.status(404).render("paciente_pwa/404", {
                layout: false,
                mensaje: "Paciente no encontrado",
            });
        }

        const plan = await PlanAlimenticio.findOne({
            where: { paciente_id: idPaciente },
            order: [["createdAt", "DESC"]],
        });

        const recetasAsignadas = plan
            ? await PlanReceta.findAll({
                where: { plan_id: plan.id },
                include: [{ model: Receta, as: "receta" }],
                order: [["fecha", "ASC"], ["momento", "ASC"]],
            })
            : [];

        return res.render("paciente_pwa/index", {
            layout: false,
            paciente,
            plan,
            recetas: recetasAsignadas,
        });

    } catch (error) {
        console.error("Error cargando PWA del paciente:", error);
        return res.status(500).render("paciente_pwa/500", {
            layout: false,
            mensaje: "Error interno del servidor",
        });
    }
});


// ======================================================
// 📌 2) LISTA DE RECETAS 
// ======================================================
router.get("/:idPaciente/recetas", async (req, res) => {
    const { idPaciente } = req.params;

    const paciente = await Paciente.findByPk(idPaciente);
    if (!paciente) {
        return res.status(404).render("paciente_pwa/404", {
            layout: false,
            mensaje: "Paciente no encontrado",
        });
    }

    const plan = await PlanAlimenticio.findOne({
        where: { paciente_id: idPaciente },
        order: [["createdAt", "DESC"]],
    });

    const recetasAsignadas = plan
        ? await PlanReceta.findAll({
            where: { plan_id: plan.id },
            include: [{ model: Receta, as: "receta" }],
            order: [["fecha", "ASC"], ["momento", "ASC"]],
        })
        : [];

    return res.render("paciente_pwa/recetas", {
        layout: false,
        paciente,
        recetas: recetasAsignadas,
    });
});


// ======================================================
// 📌 3) RECETA INDIVIDUAL  
// ======================================================
router.get("/:idPaciente/recetas/:idReceta", async (req, res) => {
    try {
        const { idPaciente, idReceta } = req.params;

        const paciente = await Paciente.findByPk(idPaciente);
        if (!paciente) {
            return res.status(404).render("paciente_pwa/404", {
                layout: false,
                mensaje: "Paciente no encontrado",
            });
        }

        const receta = await Receta.findByPk(idReceta);
        if (!receta) {
            return res.status(404).render("paciente_pwa/404", {
                layout: false,
                mensaje: "Receta no encontrada",
            });
        }

        return res.render("paciente_pwa/receta_detalle", {
            layout: false,
            paciente,
            receta,
        });

    } catch (error) {
        console.error("Error cargando receta en PWA:", error);
        return res.status(500).render("paciente_pwa/500", {
            layout: false,
            mensaje: "Error interno del servidor",
        });
    }
});


// ======================================================
// 📊 4) PROGRESO DEL PACIENTE
// ======================================================
router.get("/:idPaciente/progreso", async (req, res) => {
    try {
        const { idPaciente } = req.params;

        const paciente = await Paciente.findByPk(idPaciente);
        if (!paciente) {
            return res.status(404).render("paciente_pwa/404", {
                layout: false,
                mensaje: "Paciente no encontrado",
            });
        }

        const progresos = await paciente.getProgresos({
            order: [["fecha", "ASC"]],
        });

        return res.render("paciente_pwa/progreso", {
            layout: false,
            paciente,
            progresos,
        });

    } catch (error) {
        console.error("Error en progreso PWA:", error);
        return res.status(500).render("paciente_pwa/500", {
            layout: false,
            mensaje: "Error interno del servidor",
        });
    }
});


module.exports = router;
