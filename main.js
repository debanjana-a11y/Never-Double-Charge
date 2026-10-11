require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;
const stripe = process.env.STRIPE_SECRET_KEY
	? require('stripe')(process.env.STRIPE_SECRET_KEY)
	: null;
console.log(`Stripe is ${stripe ? 'configured' : 'not configured'}.`);

const products = {
	'pocket-30': { name: 'Pocket 30', price: 2400 },
	'desk-65': { name: 'Desk 65', price: 4200 },
	'power-100': { name: 'Power 100', price: 6800 },
};

app.post(
	'/api/stripe/webhook',
	express.raw({ type: 'application/json' }),
	async (req, res) => {
		if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
			return res.status(503).send('Stripe webhook is not configured.');
		}

		let event;
		try {
			event = stripe.webhooks.constructEvent(
				req.body,
				req.headers['stripe-signature'],
				process.env.STRIPE_WEBHOOK_SECRET,
			);
		} catch (error) {
			return res.status(400).send(`Webhook Error: ${error.message}`);
		}

		if (event.type === 'checkout.session.completed') {
			const session = event.data.object;
			if (
				session.payment_status === 'paid' &&
				session.customer_details?.email
			) {
				const { RESEND_API_KEY, RESEND_FROM } = process.env;
				if (!RESEND_API_KEY || !RESEND_FROM) {
					return res
						.status(503)
						.json({ error: 'Confirmation email provider is not configured.' });
				}

				try {
					const response = await fetch('https://api.resend.com/emails', {
						method: 'POST',
						headers: {
							Authorization: `Bearer ${RESEND_API_KEY}`,
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							from: RESEND_FROM,
							to: [session.customer_details.email],
							subject: 'Your Never Double Charge order is confirmed',
							text: `Thanks for your order. Order ${session.id} is paid. Total: $${(session.amount_total / 100).toFixed(2)}. Track your order at ${process.env.APP_URL || `http://localhost:${PORT}`}/?track=${session.id}`,
						}),
					});
					if (!response.ok)
						throw new Error(`Resend returned HTTP ${response.status}`);
				} catch (error) {
					console.error('Confirmation email could not be sent:', error.message);
					return res
						.status(502)
						.json({ error: 'Confirmation email delivery failed.' });
				}
			}
		}

		res.json({ received: true });
	},
);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/create-checkout-session', async (req, res) => {
	console.log(`Stripe is ${stripe ? 'configured' : 'not configured'}.`);
	if (!stripe) {
		return res.status(503).json({
			error:
				'Checkout is not configured yet. Add STRIPE_SECRET_KEY to the server environment.',
		});
	}

	const { email, items } = req.body;
	if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		return res.status(400).json({ error: 'Enter a valid email address.' });
	}
	if (
		!Array.isArray(items) ||
		items.length === 0 ||
		items.length > Object.keys(products).length
	) {
		return res.status(400).json({ error: 'Your cart is empty.' });
	}

	const lineItems = [];
	for (const item of items) {
		const product = products[item.id];
		if (
			!product ||
			!Number.isInteger(item.quantity) ||
			item.quantity < 1 ||
			item.quantity > 20
		) {
			return res
				.status(400)
				.json({ error: 'One or more cart items are invalid.' });
		}
		lineItems.push({
			quantity: item.quantity,
			price_data: {
				currency: 'usd',
				unit_amount: product.price,
				product_data: { name: product.name },
			},
		});
	}

	try {
		const session = await stripe.checkout.sessions.create({
			mode: 'payment',
			customer_email: email,
			line_items: lineItems,
			success_url: `${process.env.APP_URL || `${req.protocol}://${req.get('host')}`}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `${process.env.APP_URL || `${req.protocol}://${req.get('host')}`}/?checkout=cancelled`,
		});
		res.json({ url: session.url });
	} catch (error) {
		console.error('Could not create Stripe checkout session:', error.message);
		res
			.status(502)
			.json({ error: 'Checkout could not be started. Please try again.' });
	}
});

app.get('/api/orders/:sessionId', async (req, res) => {
	if (!stripe) {
		return res
			.status(503)
			.json({ error: 'Order tracking is not configured yet.' });
	}
	if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(req.params.sessionId)) {
		return res.status(400).json({ error: 'Enter a valid order reference.' });
	}

	try {
		const session = await stripe.checkout.sessions.retrieve(
			req.params.sessionId,
		);
		res.json({
			orderId: session.id,
			status: session.payment_status,
			email: session.customer_details?.email || session.customer_email,
			total: session.amount_total,
		});
	} catch (error) {
		res.status(404).json({ error: 'We could not find that order reference.' });
	}
});

app.listen(PORT, () => {
	console.log(`Server is listening on http://localhost:${PORT}`);
	// Check if the server handle is keeping the loop alive
	console.log('Active handles:', process._getActiveHandles().length);
});
