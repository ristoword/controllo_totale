# Deploy Controllo Totale

## Cosa viene eseguito

- **Root repository** (`package.json`): `npm start` → `cd backend && npm start`
- **Processo Node**: `backend/src/server.js` → carica `backend/src/app.js`

## Variabili obbligatorie (produzione)

| Variabile | Note |
|-----------|------|
| `SESSION_SECRET` | Stringa lunga e casuale (≥ 32 caratteri) |
| `NODE_ENV` | `production` |
| `PUBLIC_APP_URL` o `BASE_URL` | URL pubblico senza slash finale (es. `https://tuodominio.com`) |

Vedi `backend/.env.example` per l’elenco completo (MySQL, Stripe, AI, ecc.).

## Healthcheck (Railway / K8s / load balancer)

- **Path:** `GET /api/health`  
- Risposta `200` JSON con `status`, `uptime`, `version`, `product`.

Configurazione già allineata in `railway.toml` (root).

## Railway (due modalità valide)

### A) Root directory = repository root (consigliato con questo repo)

- **Start command:** `npm start` (usa il `package.json` root che entra in `backend/`)
- **Healthcheck path:** `/api/health`

### B) Root directory = `backend`

- **Start command:** `npm start`
- **Healthcheck path:** `/api/health`  
- Usa `backend/railway.toml` se la piattaforma lo legge dalla sottocartella.

## MySQL (produzione)

**Database dedicato:** crea un **nuovo** database MySQL per questo sito e non riusare DB di altri progetti. Vedi `docs/DATABASE_ISOLATION.md`.

Imposta `USE_MYSQL_DATABASE=true` e `DATABASE_URL` (o variabili host/user/password come da `backend/.env.example`). Esegui le migrazioni/bootstrap indicati in `backend/docs/MYSQL_RAILWAY.md` se applicabile.

## Build

Non è richiesto un passo build: applicazione Node.js CommonJS.

## Post-deploy

1. Apri `/login/login.html` e completi setup licenza / owner come da flusso onboarding.  
2. Verifica `GET /api/system/product` per nome prodotto e versione.
