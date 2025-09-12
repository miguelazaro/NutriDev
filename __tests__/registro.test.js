// __tests__/auth.register.test.js
require('dotenv').config({ quiet: true });

const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../app');
const Usuario = require('../models/Usuario');

describe('Auth - Register', () => {
    const baseEmail = () => `jest-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
    let dupEmail;

    beforeAll(async () => {
        dupEmail = baseEmail();
        const hashed = await bcrypt.hash('Password123!', 10);
        await Usuario.create({
            nombre: 'Duplicado',
            email: dupEmail,
            password: hashed,
            rol: 'nutriologo',
            plan: 'basico',
        });
    });

    afterAll(async () => {
        await Usuario.destroy({ where: { email: dupEmail } }).catch(() => { });
    });

    it('debe registrar un usuario correctamente y redirigir a /login con mensaje de éxito', async () => {
        const email = baseEmail();

        const res = await request(app)
            .post('/register')
            .type('form')
            .send({
                nombre: 'Test OK',
                email,
                password: 'Miguellazaro_23232!',
                terms: 'on',
            });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/login');
        const cookie = res.headers['set-cookie'];
        const page = await request(app).get('/login').set('Cookie', cookie);
        expect(page.text).toMatch(/Cuenta creada|¡Cuenta creada exitosamente!/i);
    });

    it('debe rechazar si la contraseña tiene menos de 8 caracteres', async () => {
        const email = baseEmail();

        const res = await request(app)
            .post('/register')
            .type('form')
            .send({
                nombre: 'Pass Corta',
                email,
                password: '12345', // demasiado corta
                terms: 'on',
            });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/register');

        const cookie = res.headers['set-cookie'];
        const page = await request(app).get('/register').set('Cookie', cookie);
        expect(page.text).toContain('La contraseña debe tener al menos 8 caracteres.');
    });

    it('debe rechazar si el correo ya está registrado', async () => {
        const res = await request(app)
            .post('/register')
            .type('form')
            .send({
                nombre: 'Dup',
                email: dupEmail, // ya existe
                password: 'Password123!',
                terms: 'on',
            });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/register');

        const cookie = res.headers['set-cookie'];
        const page = await request(app).get('/register').set('Cookie', cookie);
        expect(page.text).toContain('Este correo ya está registrado.');
    });

    it('debe rechazar si el email es inválido', async () => {
        const res = await request(app)
            .post('/register')
            .type('form')
            .send({
                nombre: 'Email Malo',
                email: 'no-es-email',
                password: 'Password123!',
                terms: 'on',
            });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/register');

        const cookie = res.headers['set-cookie'];
        const page = await request(app).get('/register').set('Cookie', cookie);
        expect(page.text).toContain('Correo electrónico no válido.');
    });

    it('debe rechazar si faltan campos obligatorios', async () => {
        const res = await request(app)
            .post('/register')
            .type('form')
            .send({
                nombre: '',
                email: '',
                password: '',
                terms: 'on',
            });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/register');

        const cookie = res.headers['set-cookie'];
        const page = await request(app).get('/register').set('Cookie', cookie);
        expect(page.text).toContain('Todos los campos son obligatorios.');
    });

    it('debe exigir aceptar términos y privacidad', async () => {
        const email = baseEmail();

        const res = await request(app)
            .post('/register')
            .type('form')
            .send({
                nombre: 'Sin Terminos',
                email,
                password: 'Password123!',
                // sin 'terms'
            });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/register');

        const cookie = res.headers['set-cookie'];
        const page = await request(app).get('/register').set('Cookie', cookie);
        expect(page.text).toContain('Debes aceptar los Términos y la Política de Privacidad para continuar.');
    });
});
