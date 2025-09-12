require('dotenv').config({ quiet: true }); 
const request = require('supertest');
const app = require('../app');
const sequelize = require('../config/db');

const { Paciente } = require('../models/associations');
const { Cobro } = require('../models/associations_cobros');

afterAll(async () => { await sequelize.close().catch(() => { }); });

async function getUserIdByEmail(email) {
    const [[row]] = await sequelize.query(
        'SELECT id FROM usuarios WHERE email = ? LIMIT 1',
        { replacements: [email] }
    );
    return row?.id || null;
}

async function loginAgent() {
    const agent = request.agent(app);
    const email = `pdfuser${Date.now()}@test.com`;

    await agent.post('/register').type('form').send({
        nombre: 'PDF Tester',
        email,
        password: 'Secret123*',
        terms: 'on'
    }).expect([200, 302]);

    await agent.post('/login').type('form').send({ email, password: 'Secret123*' })
        .expect([200, 302]);

    const userId = await getUserIdByEmail(email);
    if (!userId) throw new Error(`No se pudo obtener userId para ${email}.`);
    return { agent, userId };
}

describe('PDF - Recibo autenticado', () => {
    it('debe devolver 200 y application/pdf con usuario y cobro válidos', async () => {
        const { agent, userId } = await loginAgent();

        const paciente = await Paciente.create({
            nombre: 'Paciente PDF',
            email: `p${Date.now()}@demo.com`,
            usuario_id: userId
        });

        const cobro = await Cobro.create({
            usuario_id: userId,
            paciente_id: paciente.id,
            concepto: 'Consulta nutricional',
            estado: 'pagado',
            monto_centavos: 12345,
            moneda: 'MXN',
            fecha: new Date()
        });

        const res = await agent.get(`/cobros/${cobro.id}/recibo.pdf`);
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/application\/pdf/i);
        expect(res.body.length).toBeGreaterThan(500);
    });
});
