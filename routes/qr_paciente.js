const express = require("express");
const router = express.Router();
const qrcode = require("qrcode");

router.get("/:idPaciente", async (req, res) => {
  try {
    const { idPaciente } = req.params;

    const urlPwa = `http://localhost:3000/paciente_pwa/${idPaciente}`;

    const qr = await qrcode.toDataURL(urlPwa);

    return res.render("paciente_pwa/qr_paciente", {
      layout: false,
      qr,
      pacienteId: idPaciente
    });

  } catch (error) {
    console.error("Error generando QR:", error);
    return res.status(500).send("Error generando QR");
  }
});

module.exports = router;
