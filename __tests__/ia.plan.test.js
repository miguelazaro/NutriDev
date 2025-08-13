// __tests__/ia.plan.test.js
require('dotenv').config({ quiet: true }); 
jest.mock('axios', () => ({
    post: jest.fn(async () => ({
        data: { choices: [{ message: { content: '## Plan demo\n\nLunes:\n- Desayuno: ...' } }] }
    }))
}));

require('dotenv').config();
const request = require('supertest');
const app = require('../app');
const sequelize = require('../config/db');

const { Paciente } = require('../models/associations');
let Usuario;
try { Usuario = require('../models/Usuario'); } catch { }

afterAll(async () => { await sequelize.close().catch(() => { }); });

async function getUserIdByEmail(email) {
    if (Usuario?.findOne) {
        const u = await Usuario.findOne({ where: { email } });
        if (u?.id) return u.id;
    }
    const [[row]] = await sequelize.query(
        'SELECT id FROM usuarios WHERE email = ? LIMIT 1',
        { replacements: [email] }
    );
    return row?.id || null;
}

async function loginAgent() {
    const agent = request.agent(app);
    const email = `iauser${Date.now()}@test.com`;

    const reg = await agent.post('/register').type('form').send({
        nombre: 'IA Tester',
        email,
        password: 'Secret123*',
        terms: 'on'
    });
    expect([200, 302]).toContain(reg.status);

    const log = await agent.post('/login').type('form').send({ email, password: 'Secret123*' });
    expect([200, 302]).toContain(log.status);

    const userId = await getUserIdByEmail(email);
    if (!userId) throw new Error(`No se pudo obtener userId para ${email}.`);
    return { agent, userId };
}

describe('IA - Generar plan', () => {
    it('debe generar un plan con IA para un paciente del usuario', async () => {
        const { agent, userId } = await loginAgent();

        const paciente = await Paciente.create({
            nombre: 'Paciente IA',
            email: `pac${Date.now()}@demo.com`,
            usuario_id: userId
        });

        const res = await agent.post(`/ia/plan/${paciente.id}`);
        expect([200, 201, 302]).toContain(res.status);
    });
});
