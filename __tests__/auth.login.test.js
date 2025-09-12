require('dotenv').config({ quiet: true });

const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../app');
const Usuario = require('../models/Usuario');

describe('Auth - Login', () => {
    const emailOK = 'test_login@nutridev.com';
    const passOK = 'testpass123'; // >= 8, simple para pruebas
    let userId;

    beforeAll(async () => {
        await Usuario.destroy({ where: { email: emailOK } });

        const hashed = await bcrypt.hash(passOK, 10);
        const u = await Usuario.create({
            nombre: 'Tester Login',
            email: emailOK,
            password: hashed,
            rol: 'nutriologo',
            plan: 'basico',
        });
        userId = u.id;
    });

    afterAll(async () => {
        await Usuario.destroy({ where: { id: userId } });
    });

    it('debe iniciar sesión con credenciales válidas y redirigir a /dashboard', async () => {
        const res = await request(app)
            .post('/login')
            .send({ email: emailOK, password: passOK });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/dashboard');
        expect(res.headers['set-cookie']).toBeDefined();
    });

    it('debe rechazar cuando faltan campos y mostrar flash "Correo y contraseña son obligatorios."', async () => {
        // Hacemos el POST sin password
        const res = await request(app)
            .post('/login')
            .send({ email: emailOK, password: '' });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/login');
        const cookie = res.headers['set-cookie'];
        const page = await request(app).get('/login').set('Cookie', cookie);
        expect(page.text).toContain('Correo y contraseña son obligatorios.');
        expect(page.text).toContain(emailOK);
    });

    it('debe mostrar mensaje de "Credenciales incorrectas" cuando la contraseña es inválida', async () => {
        const res = await request(app)
            .post('/login')
            .send({ email: emailOK, password: 'contrasena_incorrecta' });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/login');

        const cookie = res.headers['set-cookie'];
        const page = await request(app).get('/login').set('Cookie', cookie);

        expect(page.text).toContain('Credenciales incorrectas. Verifica tu correo o contraseña.');
        expect(page.text).toContain(emailOK);
    });

    it('logout debe limpiar la sesión y redirigir a /login', async () => {
        const loginRes = await request(app)
            .post('/login')
            .send({ email: emailOK, password: passOK });
        const cookie = loginRes.headers['set-cookie'];
        const out = await request(app).get('/logout').set('Cookie', cookie);
        expect(out.status).toBe(302);
        expect(out.headers.location).toBe('/login');

        const rec = await request(app).get('/recetas').set('Cookie', cookie);
        expect(rec.status).toBe(302);
        expect(rec.headers.location).toBe('/login');
    });
});
