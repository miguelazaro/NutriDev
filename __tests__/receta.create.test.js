require('dotenv').config({ quiet: true }); 
const request = require('supertest');
const app = require('../app');

describe('Recetas - Crear', () => {
    let cookie;

    beforeAll(async () => {
        const loginRes = await request(app)
            .post('/login')
            .send({ email: 'admin@nutridev.com', password: 'admin123' });
        cookie = loginRes.headers['set-cookie'];
    });

    it('debe crear una receta con datos válidos', async () => {
        const res = await request(app)
            .post('/recetas/guardar')
            .set('Cookie', cookie)
            .field('titulo', 'Receta de prueba')
            .field('ingredientes', 'Ingrediente 1\nIngrediente 2')
            .field('preparacion', 'Paso 1\nPaso 2')
            .field('categoria', 'Postres');

        expect(res.status).toBe(302); // redirige después de guardar
        expect(res.header.location).toMatch(/\/recetas/);
    });

    it('debe rechazar si faltan campos obligatorios', async () => {
        const res = await request(app)
            .post('/recetas/guardar')
            .set('Cookie', cookie)
            .field('titulo', '');

        expect(res.status).toBe(302);
        expect(res.header.location).toBe('/recetas/nueva');
    });
});
