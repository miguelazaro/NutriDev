require('dotenv').config({ quiet: true }); 
const request = require('supertest');
const app = require('../app');
const Receta = require('../models/Receta');

describe('Recetas - Archivar', () => {
    let cookie;
    let recetaId;

    beforeAll(async () => {
        const loginRes = await request(app)
            .post('/login')
            .send({ email: 'admin@nutridev.com', password: 'admin123' });
        cookie = loginRes.headers['set-cookie'];

        const receta = await Receta.create({
            titulo: 'Receta para archivar',
            ingredientes: 'Ingrediente',
            preparacion: 'Paso',
            categoria: 'general',
            usuario_id: 1
        });
        recetaId = receta.id;
    });

    it('debe archivar la receta correctamente', async () => {
        const res = await request(app)
            .post(`/recetas/archivar/${recetaId}`)
            .set('Cookie', cookie);

        expect(res.status).toBe(302);
        expect(res.header.location).toBe('/recetas');
    });
});
