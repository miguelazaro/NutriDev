// __tests__/pdf.download.test.js
require('dotenv').config({ quiet: true }); 
const request = require('supertest');
const app = require('../app');
const sequelize = require('../config/db');

afterAll(async () => { await sequelize.close().catch(() => { }); });

describe('PDF - Recibo de cobro', () => {
    it('debe responder 200/401/404/302 al solicitar /cobros/1/recibo.pdf', async () => {
        const res = await request(app).get('/cobros/1/recibo.pdf');
        expect([200, 401, 404, 302]).toContain(res.status);
        if (res.status === 200) {
            expect(res.headers['content-type']).toMatch(/application\/pdf/i);
            expect(res.body.length).toBeGreaterThan(200);
        }
    });
});
