# Identità prodotto — Controllo Totale

**Controllo Totale** è un gestionale ristorazione indipendente. Nel codice:

- Costanti centrali: `backend/src/constants/productIdentity.js` (piano predefinito, `source` verso integrazioni esterne).
- Stripe: variabili `STRIPE_PRICE_CONTROLLO_TOTALE_*` (vedi `backend/src/config/stripeEnv.js` e `.env.example`).
- Log: prefisso da `getLogPrefix()` in `backend/src/config/branding.js` (`APP_NAME`).

Non usare nomi, variabili d’ambiente o database di altri prodotti sullo stesso deploy: vedi `DATABASE_ISOLATION.md`.
