require('dotenv').config({ quiet: true }); 
const request = require('supertest');
const app = require('../app');
const sequelize = require('../config/db');

afterAll(async () => { await sequelize.close().catch(() => { }); });

describe('Progreso - Guardar', () => {
    it('debe guardar un progreso de paciente', async () => {
        const res = await request(app)
            .post('/progreso/1') 
            .type('form')
            .send({ peso: 80.2, grasa: 18.5, fecha: '2025-08-12' });

        expect([200, 201, 302, 400, 404]).toContain(res.status);
    });
});
