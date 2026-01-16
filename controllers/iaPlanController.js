const axios = require('axios');
const { Paciente, Progreso, NotaNutriologo, PlanAlimenticio } = require('../models/associations');

// Helper: id del usuario logueado
const uid = (req) => req.session?.usuario?.id || null;

// Edad desde fecha de nacimiento
function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return 'N/D';
  const hoy = new Date();
  const n = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - n.getFullYear();
  const m = hoy.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < n.getDate())) edad--;
  return `${edad} años`;
}

// Prompt en español con formato Markdown compatible con nuestro parser
function buildPrompt(paciente, progresos = [], notas = []) {
  const progTxt =
    (progresos || [])
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
      .map((p) => {
        const f = p.fecha ? new Date(p.fecha).toISOString().slice(0, 10) : 's/f';
        const peso = (p.peso || p.peso === 0) ? `${p.peso} kg` : '—';
        const obs = p.observaciones ? ` • ${p.observaciones}` : '';
        return `- ${f}: ${peso}${obs}`;
      })
      .join('\n') || 'Sin registros';

  const notasTxt = (notas || []).map((n) => `- ${n.nota}`).join('\n') || 'Sin notas';

  return `
Eres un nutriólogo. Genera un plan alimenticio **semanal** en **español** y en **Markdown** para este paciente.
Formatea EXACTAMENTE así para cada día:
"Lunes:", "Martes:", "Miércoles:", "Jueves:", "Viernes:", "Sábado:", "Domingo:" (con dos puntos).
Dentro de cada día usa subsecciones (también con dos puntos): "Desayuno:", "Snack 1:", "Comida:", "Snack 2:", "Cena:".
Bajo cada subsección, lista las preparaciones como viñetas con "- ". Sé concreto (sin texto florido) y respeta preferencias/restricciones.

Paciente:
- Nombre: ${paciente.nombre || 'N/A'}
- Sexo: ${paciente.genero || 'N/A'}
- Edad: ${calcularEdad(paciente.fecha_nacimiento)}
- Estatura: ${paciente.estatura || 'N/A'} cm
- Actividad física: ${paciente.actividad || 'N/A'}
- Objetivo nutricional: ${paciente.objetivo || 'N/A'}
- Comidas al día: ${paciente.comidas_dia || 'N/A'}
- País de residencia: ${paciente.pais_residencia || 'N/A'}
- Preferencias / Restricciones: ${paciente.preferencias || 'N/A'}
- Historial médico relevante: ${paciente.historial || 'N/A'}

Progresos (fecha • peso • observaciones):
${progTxt}

Notas del nutriólogo:
${notasTxt}

Recuerda: Markdown plano, sin HTML. Cada comida debe tener al menos 2-3 viñetas. Evita ingredientes imposibles de conseguir en México si no son imprescindibles.
`.trim();
}

function wantsJSON(req) {
  return (
    req.xhr ||
    req.headers['x-requested-with'] === 'XMLHttpRequest' ||
    (req.headers.accept || '').includes('application/json') ||
    req.query.return === 'json'
  );
}

exports.generarPlan = async (req, res) => {
  try {
    const user = req.session?.usuario || {};
    const userId = uid(req);
    if (!userId) return res.redirect('/login');

    // --- GATE de plan: solo admin o premium ---
    if (user.rol !== 'admin' && user.plan !== 'premium') {
      const msg = 'Necesitas plan Premium para crear planes con IA.';
      if (wantsJSON(req)) return res.status(403).json({ ok: false, error: msg });
      req.flash('error', msg);
      const backId = req.params?.id || req.body?.paciente_id;
      return res.redirect(backId ? `/pacientes/${backId}` : '/planes');
    }
    // ------------------------------------------

    const pacienteId = Number(req.params.id || req.body.paciente_id);
    if (!pacienteId) {
      const msg = 'Falta el ID del paciente.';
      if (wantsJSON(req)) return res.status(400).json({ ok: false, error: msg });
      req.flash('error', msg);
      return res.redirect('back');
    }

    // Verifica propiedad del paciente
    const paciente = await Paciente.findOne({
      where: { id: pacienteId, usuario_id: userId },
      include: [
        { model: Progreso, as: 'Progresos' },
        { model: NotaNutriologo, as: 'NotaNutriologos' },
      ],
    });
    if (!paciente) {
      const msg = 'Paciente no encontrado o no autorizado.';
      if (wantsJSON(req)) return res.status(404).json({ ok: false, error: msg });
      req.flash('error', msg);
      return res.redirect('back');
    }

    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      const msg = 'No hay MISTRAL_API_KEY configurada en el servidor.';
      if (wantsJSON(req)) return res.status(500).json({ ok: false, error: msg });
      req.flash('error', msg);
      return res.redirect('back');
    }

    // Modelo configurable por .env (fallback seguro)
    const model = process.env.MISTRAL_MODEL || 'mistral-small-latest';

    const prompt = buildPrompt(
      paciente.get({ plain: true }),
      paciente.Progresos || [],
      paciente.NotaNutriologos || []
    );

    // Llamada a Mistral
    const { data } = await axios.post(
      'https://api.mistral.ai/v1/chat/completions',
      {
        model,
        messages: [
          { role: 'system', content: 'Eres un asistente experto en nutrición.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.6,
        max_tokens: 1500,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    const md = data?.choices?.[0]?.message?.content?.trim();
    if (!md) {
      const msg = 'La IA no devolvió contenido.';
      if (wantsJSON(req)) return res.status(502).json({ ok: false, error: msg });
      req.flash('error', msg);
      return res.redirect('back');
    }

    // Guarda el plan generado automáticamente
    const plan = await PlanAlimenticio.create({
      titulo: `Plan IA • ${paciente.nombre}`,
      tipo: 'ia',
      contenido: md,
      paciente_id: paciente.id,
      usuario_id: userId,
    });
<<<<<<< Updated upstream
=======
    // ===========================
    // Asignación automática de recetas
    // ===========================
    const parsed = parsePlanIA(md);
    const fechasSemana = getDatesForWeek();

    for (let i = 0; i < parsed.length; i++) {
      const dia = parsed[i];
      const fecha = fechasSemana[i];

      for (let meal of dia.comidas) {
        const categoria = mapMealToCategory(meal.tipo);
        const receta = await selectRecipe(categoria);

        if (!receta) continue;

        await PlanReceta.create({
          plan_id: plan.id,
          paciente_id: paciente.id,
          receta_id: receta.id,
          fecha,
          momento: categoria,
          porciones: 1,
          notas: null
        });
      }
    }

    console.log("Recetas asignadas automáticamente ✔️");
>>>>>>> Stashed changes

    if (wantsJSON(req)) return res.json({ ok: true, planId: plan.id, contenido: md });

    req.flash('success', 'Plan alimenticio generado con IA.');
    return res.redirect(`/planes-alimenticios/${plan.id}`);
  } catch (error) {
    console.error('[IA] Error al generar plan con Mistral:', error?.response?.data || error.message || error);
    const msg = 'No se pudo generar el plan con IA.';
    if (wantsJSON(req)) return res.status(500).json({ ok: false, error: msg });
    req.flash('error', msg);
    return res.redirect('back');
  }
};
