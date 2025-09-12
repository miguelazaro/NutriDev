const request = require('supertest');
const app = require('../app');
const Receta = require('../models/Receta');
const Paciente = require('../models/Paciente');

describe('Recetas - Agregar a Plan Alimenticio', () => {
    let cookie;
    let recetaId;
    let pacienteId;

    beforeAll(async () => {
        const loginRes = await request(app)
            .post('/login')
            .send({ email: 'admin@nutridev.com', password: 'admin123' });
        cookie = loginRes.headers['set-cookie'];

        const receta = await Receta.create({
            titulo: 'Receta para plan',
            ingredientes: 'Ingrediente',
            preparacion: 'Paso',
            categoria: 'general',
            usuario_id: 1
        });
        recetaId = receta.id;

        const paciente = await Paciente.create({
            nombre: 'Paciente Prueba',
            usuario_id: 1
        });
        pacienteId = paciente.id;
    });

    it('debe agregar la receta a un plan nuevo', async () => {
        const res = await request(app)
            .post(`/recetas/${recetaId}/agregar-a-plan`)
            .set('Cookie', cookie)
            .send({
                paciente_id: pacienteId,
                fecha: '2025-08-12',
                momento: 'comida',
                notas: 'Nota de prueba',
                porciones: 2
            });

        expect(res.status).toBe(302);
        expect(res.header.location).toMatch(/\/planes-alimenticios\//);
    });
});
