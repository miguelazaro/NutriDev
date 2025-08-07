const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Usuario = require('../models/Usuario'); // <-- 1. ¡MUY IMPORTANTE! Importamos el modelo Usuario

// Tu función para mostrar los planes (se queda igual)
exports.vistaPlanes = (req, res) => {
    const user = req.session.usuario;
    res.render('planes', {
        user,
        active: 'planes',
        messages: req.flash()
    });
};

// Tu función para comprar el plan (se queda igual, ¡ya estaba perfecta!)
exports.comprarPlan = async (req, res) => {
    const { tipo } = req.params;
    const usuario = req.session.usuario;

    if (!usuario || !usuario.id) {
        return res.status(401).send('No autorizado');
    }

    const priceId = tipo === 'premium'
        ? process.env.STRIPE_PREMIUM_PRICE_ID
        : process.env.STRIPE_BASIC_PRICE_ID;

    if (!priceId || tipo !== 'premium') { // Solo permitimos comprar premium
        req.flash('error', 'Solo el plan Premium está disponible para compra.');
        return res.redirect('/planes');
    }

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price: priceId, 
                quantity: 1
            }],
            mode: 'subscription', 
            success_url: `${process.env.BASE_URL}/planes/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.BASE_URL}/planes`,
            metadata: {
                usuarioId: usuario.id,
                tipoPlan: tipo
            }
        });
        
        res.redirect(session.url);
    } catch (error) {
        console.error('Error creando sesión de checkout:', error);
        res.status(500).send('Error al crear la sesión de pago');
    }
};


// --- 2. AÑADE ESTA NUEVA FUNCIÓN, BEBESITA ---
exports.pagoExitoso = async (req, res) => {
    const { session_id } = req.query;
    const usuarioEnSesion = req.session.usuario;

    try {
        // Verificamos con Stripe que la sesión de pago es real
        const session = await stripe.checkout.sessions.retrieve(session_id);

        // Si el pago fue exitoso (status 'complete')
        if (session.payment_status === 'paid') {
            const usuarioId = session.metadata.usuarioId;

            // Actualizamos al usuario en la base de datos a 'premium'
            await Usuario.update(
                { plan: 'premium' },
                { where: { id: usuarioId } }
            );

            // Actualizamos la sesión actual para que no tenga que volver a loguearse
            if (usuarioEnSesion && String(usuarioEnSesion.id) === String(usuarioId)) {
                req.session.usuario.plan = 'premium';
            }
            
            req.flash('success', '¡Felicidades, mi amor! Tu plan ha sido actualizado a Premium.');
            return res.redirect('/dashboard');
        }

        // Si el pago no fue exitoso por alguna razón
        req.flash('error', 'Parece que hubo un problema con el pago.');
        res.redirect('/planes');

    } catch (error) {
        console.error("Error al procesar el pago exitoso:", error);
        req.flash('error', 'Hubo un problema al verificar tu pago. Por favor, contacta a soporte.');
        res.redirect('/planes');
    }
};
