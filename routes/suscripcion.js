const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { requireAuth } = require('../middlewares/auth');
const { Suscripcion, Plan } = require('../models');

router.post('/crear-checkout', requireAuth, async (req, res) => {
  const { plan_id } = req.body;
  const userId = req.session.userId;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{
        price: plan_id,
        quantity: 1,
      }],
      success_url: `${process.env.BASE_URL}/suscripcion/exito?plan_id=${plan_id}`,
      cancel_url: `${process.env.BASE_URL}/planes?cancelado=true`,
      metadata: {
        usuario_id: userId,
        plan_id: plan_id
      }
    });

    res.redirect(303, session.url);
  } catch (error) {
    console.error('Error en Stripe:', error);
    res.redirect('/planes?error=checkout');
  }
});

router.get('/exito', requireAuth, async (req, res) => {
  const usuario_id = req.session.userId;
  const plan_id = req.query.plan_id;

  const hoy = new Date();
  const fin = new Date();
  fin.setMonth(hoy.getMonth() + 1); 

  await Suscripcion.create({
    usuario_id,
    plan_id,
    fecha_inicio: hoy,
    fecha_fin: fin,
    estado: 'activa'
  });

  res.redirect('/dashboard'); 
});

