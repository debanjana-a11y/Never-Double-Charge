# Never Double Charge

A three-product charging accessory shop with a cart, Stripe-hosted checkout, order lookup, and purchase confirmation emails.

## Run locally

1. Install Node.js, then run `npm install`.
2. Copy `.env.example` to `.env` (keep your existing `.env` if you already have one). Set `STRIPE_SECRET_KEY` to a Stripe **secret** key (`sk_test_...` for test mode or `sk_live_...` for live mode), and add your Resend API key. Verify the sender domain used in `RESEND_FROM` with Resend. Never commit `.env` or put secret keys in browser code.
3. Start the app with `npm start` and open <http://localhost:3000>.
4. To test paid-order webhooks locally, run `stripe listen --forward-to localhost:3000/api/stripe/webhook` and set `STRIPE_WEBHOOK_SECRET` to the signing secret printed by Stripe CLI.

If you add or change a key while the app is running, stop it with Ctrl+C and run `npm start` again; environment variables are read at startup.

Stripe Checkout handles card details and payment. The server emails the customer through Resend only after Stripe reports a completed, paid checkout session. Set `APP_URL` to the public HTTPS site URL in production; configure Stripe to forward the `checkout.session.completed` event to `/api/stripe/webhook`.

The catalog and prices are configured in `main.js` and mirrored in `public/app.js` for display.
