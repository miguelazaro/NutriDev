// controllers/iaPlanController.js
const axios = require('axios');
const Paciente = require('../models/Paciente');
const Progreso = require('../models/Progreso');

// Función auxiliar para calcular edad a partir de fecha de nacimiento
function calcularEdad(fechaNacimiento) {
    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const m = hoy.getMonth() - nacimiento.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
        edad--;
    }
    return edad;
}

exports.generarPlan = async (req, res) => {
    const { id } = req.params;

    try {
        const paciente = await Paciente.findByPk(id, {
            include: [{ model: Progreso, as: 'Progresos' }]
        });

        if (!paciente) {
            return res.status(404).json({ error: 'Paciente no encontrado' });
        }

        // Construcción del prompt
        const edad = paciente.fecha_nacimiento ? calcularEdad(paciente.fecha_nacimiento) : 'N/A';
        const progresos = paciente.Progresos?.length > 0
            ? paciente.Progresos.map(p => `(${p.fecha}) ${p.descripcion}`).join('\n')
            : 'No se han registrado progresos.';

        const prompt = `
Genera un plan alimenticio semanal detallado para un paciente con los siguientes datos:

- Nombre: ${paciente.nombre}
- Edad: ${edad} años
- Género: ${paciente.genero}
- Estatura: ${paciente.estatura} cm
- Actividad física: ${paciente.actividad}
- Objetivo nutricional: ${paciente.objetivo}
- Número de comidas al día: ${paciente.comidas_dia}
- País de residencia: ${paciente.pais_residencia}
- Historial médico: ${paciente.historial || 'No proporcionado'}
- Preferencias alimenticias: ${paciente.preferencias || 'No indicadas'}

Últimos progresos del paciente:
${progresos}

El plan debe estar organizado por días de la semana (Lunes a Domingo) e incluir desayuno, comida, cena y snacks. Utiliza un tono profesional pero claro.
`;

        const mistralResponse = await axios.post(
            'https://api.mistral.ai/v1/chat/completions',
            {
                model: 'mistral-medium',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const plan = mistralResponse.data.choices[0].message.content;
        res.json({ plan });
    } catch (error) {
        console.error('Error al generar plan IA con Mistral:', error.message);
        res.status(500).json({ error: 'Error al generar el plan con Mistral.' });
    }
};
