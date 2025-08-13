// __tests__/pacientes.create.test.js
require('dotenv').config({ quiet: true }); 
const request = require('supertest');
const app = require('../app');
const sequelize = require('../config/db');

afterAll(async () => { await sequelize.close().catch(() => { }); });

describe('Pacientes - Crear', () => {
    it('debe crear un paciente correctamente', async () => {
        const res = await request(app)
            .post('/pacientes')
            .type('form')
            .send({
                nombre: 'Paciente Demo',
                email: `p${Date.now()}@demo.com`,
                genero: 'M',
                fecha_nacimiento: '2000-01-01',
                estatura: 175,
                actividad: 'moderada',
                objetivo: 'definir',
                comidas_dia: 3
            });

        expect([200, 302]).toContain(res.status);
    });
});
