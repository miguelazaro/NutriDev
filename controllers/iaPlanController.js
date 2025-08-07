const axios = require('axios');
const Paciente = require('../models/Paciente');
const Progreso = require('../models/Progreso');

exports.generarPlan = async (req, res) => {
    const { id } = req.params;

    try {
        const paciente = await Paciente.findByPk(id, {
            include: [{ model: Progreso, as: 'Progresos' }]
        });


        if (!paciente) {
            return res.status(404).json({ error: 'Paciente no encontrado' });
        }

        const prompt = `Genera un plan alimenticio detallado para un paciente con los siguientes datos:
Nombre: ${paciente.nombre}
Edad: ${paciente.edad}
Peso: ${paciente.peso} kg
Altura: ${paciente.altura} cm
Historial Médico: ${paciente.historialMedico || 'N/A'}
Últimos progresos:
${paciente.Progresos.map(p => `- (${p.fecha}) ${p.descripcion}`).join('\n')}


El plan debe estar estructurado por días de la semana e incluir desayuno, comida, cena y snacks.`;

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
