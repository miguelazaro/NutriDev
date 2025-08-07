const Paciente = require('../models/Paciente');
const Progreso = require('../models/Progreso');
const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));
require('dotenv').config();

exports.generarPlan = async (req, res) => {
    try {
        const { id } = req.params;
        const paciente = await Paciente.findByPk(id, {
            include: [{ model: Progreso, as: 'Progresos' }],
        });

        if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });

        // Edad
        const nacimiento = new Date(paciente.fecha_nacimiento);
        const hoy = new Date();
        let edad = hoy.getFullYear() - nacimiento.getFullYear();
        const m = hoy.getMonth() - nacimiento.getMonth();
        if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) edad--;

        // Último peso
        const ultimoPeso = paciente.Progresos?.length > 0
            ? paciente.Progresos[paciente.Progresos.length - 1].peso
            : 'No registrado';

        const prompt = `
Eres un nutriólogo profesional. Crea un plan alimenticio semanal para el siguiente paciente:

- Nombre: ${paciente.nombre}
- Edad: ${edad} años
- Sexo: ${paciente.genero}
- Estatura: ${paciente.estatura} cm
- Peso actual: ${ultimoPeso} kg
- Nivel de actividad: ${paciente.actividad}
- Objetivo: ${paciente.objetivo}
- Comidas por día: ${paciente.comidas_dia}
- Preferencias o alergias: ${paciente.preferencias || 'Ninguna'}
- Historial médico: ${paciente.historial || 'No especificado'}

El plan debe incluir desayuno, comida, cena y snacks para 7 días, con estimación de calorías y macros. Usa un lenguaje claro y accesible para pacientes.
`;

        const response = await fetch(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + process.env.GEMINI_API_KEY,

            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                }),
            }
        );

        const data = await response.json();

        if (!response.ok || !data.candidates || !data.candidates.length) {
            console.error('Respuesta de Gemini inválida:', data);
            return res.status(500).json({ error: 'Error al generar el plan con Gemini' });
        }

        const text = data.candidates[0].content.parts[0].text;
        res.json({ plan: text });

    } catch (error) {
        console.error('Error al generar plan con Gemini (fetch):', error);
        res.status(500).json({ error: 'Error al generar el plan con Gemini' });
    }
};
