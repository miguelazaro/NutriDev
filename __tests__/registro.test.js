require('dotenv').config({ quiet: true }); 
const request = require('supertest');
const app = require('../app');
const sequelize = require('../config/db');

afterAll(async () => {
    await sequelize.close().catch(() => { });
});

describe('Registro de usuario', () => {
    it('debe registrar un usuario correctamente', async () => {
        const res = await request(app)
            .post('/register') 
            .type('form')
            .send({
                nombre: 'Test',
                email: `test${Date.now()}@example.com`,
                password: '123456'
            });

        expect([200, 302]).toContain(res.status);
    });
});
