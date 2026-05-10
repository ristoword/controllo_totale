# Deploy Controllo Totale

## Cosa viene eseguito

- **Locale / CI:** `npm start` dalla root → `npm run start --workspace=backend` (vedi `package.json` root).
- **Docker / Railway (consigliato):** `node backend/src/server.js` (vedi `Dockerfile`, `railway.toml`, `Procfile`) — evita di dipendere da vecchi script `cd backend`.
- **Processo Node:** `backend/src/server.js` → carica `backend/src/app.js`

## Variabili obbligatorie (produzione)

| Variabile | Note |
|-----------|------|
| `SESSION_SECRET` | **Fortemente consigliata in produzione.** Se manca, il server genera un segreto temporaneo all’avvio (così il deploy non resta in 502), ma **ogni deploy/ravvio disconnette tutti** e con più repliche le sessioni non sono coerenti. Imposta una stringa lunga casuale (≥ 32 caratteri) nelle **Variables** del servizio Railway. |
| `NODE_ENV` | `production` |
| `PUBLIC_APP_URL` o `BASE_URL` | URL pubblico senza slash finale (es. `https://xxx.up.railway.app`) |

Con **`USE_MYSQL_DATABASE=true`**, nel servizio web servono anche **`DATABASE_URL`** (o credenziali MySQL) coerenti con il plugin DB Railway. Per test: `USE_MYSQL_DATABASE=false` isola errori di DB.

Vedi `backend/.env.example` per l’elenco completo (MySQL, Stripe, AI, ecc.).

## Healthcheck (Railway / K8s / load balancer)

- **Path:** `GET /api/health`  
- Risposta `200` JSON con `status`, `uptime`, `version`, `product`.

Configurazione già allineata in `railway.toml` (root).

## Railway (due modalità valide)

### A1) Dockerfile (consigliato se l’healthcheck fallisce con build “cached”)

Se in build vedi **ancora** `using build driver railpack` e `npm ci cached`, Railway **non** sta usando il Dockerfile. Il file **`railway.toml`** in root include **`[build] builder = "DOCKERFILE"`** per forzare la build Docker. Dopo il push, nei log dovresti vedere qualcosa tipo **“Using Dockerfile”** (non solo Railpack).

In root c’è un **`Dockerfile`**: `COPY . .` poi `RUN npm ci` (workspaces: un solo lockfile installa anche `backend/`).

Se il deploy è ancora cached: **Settings → Clear build cache** oppure variabile **`NO_CACHE=1`** sul servizio, poi ridistribuisci.

### A) Root directory = repository root (consigliato con questo repo)

- **Start command:** `node backend/src/server.js` (anche in `railway.toml` / `Procfile` — non usare un vecchio `cd backend && npm start` senza aver aggiornato il lockfile workspaces).
- **Healthcheck path:** `/api/health`

### B) Root directory = `backend`

- **Start command:** `npm start`
- **Healthcheck path:** `/api/health`  
- Usa `backend/railway.toml` se la piattaforma lo legge dalla sottocartella.

## MySQL (produzione)

**Database dedicato:** crea un **nuovo** database MySQL per questo sito e non riusare DB di altri progetti. Vedi `docs/DATABASE_ISOLATION.md`.

Imposta `USE_MYSQL_DATABASE=true` e `DATABASE_URL` (o variabili host/user/password come da `backend/.env.example`). Esegui le migrazioni/bootstrap indicati in `backend/docs/MYSQL_RAILWAY.md` se applicabile.

## Build

Non è richiesto un transpile: applicazione Node.js CommonJS.

**Monorepo (root + `backend/`):** il `package.json` in root dichiara **`"workspaces": ["backend"]`** e un **`package-lock.json` unico**. Un solo **`npm ci`** (o `npm install`) dalla root installa **tutte** le dipendenze dell’API (`dotenv`, `express`, …), incluso quando Railpack esegue solo `npm ci` sulla root. Non serve più `postinstall` separato. Se vedi ancora `Cannot find module 'dotenv'`, il deploy non sta usando il lockfile aggiornato: **commit + push** di `package-lock.json` e svuota la cache di build.

## Post-deploy

1. Apri `/login/login.html` e completi setup licenza / owner come da flusso onboarding.  
2. Verifica `GET /api/system/product` per nome prodotto e versione.
