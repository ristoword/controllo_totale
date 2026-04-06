# Controllo Totale

Gestionale ristorazione **multi-reparto** e **multi-tenant** (Sala, Cucina, Bar, Pizzeria, Cassa, Magazzino, Supervisor, Asporto, Catering, Staff).  
Prodotto **pronto al deploy**: un solo backend Node in `backend/`, healthcheck `/api/health`, branding e metadati prodotto via variabili d’ambiente.

**Questo repository è indipendente** da altri progetti sul computer (es. Ristoword): non condividere cartelle né dati con copie parallele.

---

## Avvio locale

```bash
cd backend
cp .env.example .env
# Imposta almeno SESSION_SECRET (lungo e casuale)
npm install
npm start
```

*(Se cloni solo la cartella `backend` per il deploy, esegui `npm install` lì.)*

Apri il browser su `http://localhost:8080` (o la porta in `.env` / `PORT`).  
Dashboard: `/dashboard/dashboard.html` · Login: `/login/login.html`

---

## Deploy produzione

Leggi **[DEPLOY.md](./DEPLOY.md)** (Railway, variabili, healthcheck, MySQL).

---

## Documentazione

| File | Contenuto |
|------|-----------|
| [DEPLOY.md](./DEPLOY.md) | Deploy, healthcheck, env |
| [docs/STRUCTURE.md](docs/STRUCTURE.md) | Albero cartelle (senza duplicati) |
| [docs/PRODUCT_SAAS.md](docs/PRODUCT_SAAS.md) | Posizionamento SaaS e endpoint pubblici |
| [docs/CONTROLLO_TOTALE_MASTER_PLAN.md](docs/CONTROLLO_TOTALE_MASTER_PLAN.md) | Roadmap moduli |
| [docs/ARCHITECTURE_SAAS_SCALING.md](docs/ARCHITECTURE_SAAS_SCALING.md) | Multi-tenant e scala |
| [docs/DATABASE_EXTENSIONS.sql](docs/DATABASE_EXTENSIONS.sql) | Estensioni DB (HR, fornitori, ricezioni) |
| [docs/DATABASE_ISOLATION.md](docs/DATABASE_ISOLATION.md) | DB dedicato per deploy (non mischiare con altri progetti) |

Storico e report di progetto sono in **`docs/_archive/`** (non servono al runtime).

---

## Moduli UI principali (dopo login)

| Percorso | Modulo |
|----------|--------|
| `/sala/sala.html` | Sala |
| `/sala/sala-fullscreen.html` | Sala mappa a schermo intero |
| `/cucina/cucina.html` | Cucina / KDS |
| `/cassa/cassa.html` | Cassa |
| `/staff-hr/index.html` | HR (hub + roadmap) |
| `/dashboard/dashboard.html` | Dashboard operativa |

---

## Identità prodotto (env)

`APP_NAME`, `APP_VERSION`, `PRODUCT_SLUG` — vedi `backend/.env.example`.  
`GET /api/system/product` — JSON pubblico (branding client / monitoraggio).
