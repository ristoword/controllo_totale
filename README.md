# Controllo Totale

**Repository GitHub:** [github.com/ristoword/controllo_totale](https://github.com/ristoword/controllo_totale)

Gestionale ristorazione **multi-reparto** e **multi-tenant** (Sala, Cucina, Bar, Pizzeria, Cassa, Magazzino, Supervisor, Asporto, Catering, Staff).  
Prodotto **pronto al deploy**: un solo backend Node in `backend/`, healthcheck `/api/health`, branding e metadati prodotto via variabili d’ambiente.

**Questo repository è indipendente** da altri progetti sul computer: non condividere cartelle, database né dati con altre installazioni.

### Schema e logica dati

- **MySQL (opzionale):** `USE_MYSQL_DATABASE=true` — tabelle tenant in `backend/src/db/` e `docs/` (es. `DATABASE_EXTENSIONS.sql`, `DATABASE_ISOLATION.md`).
- **JSON per tenant:** file sotto `backend/data/tenants/<id>/` (inventario, fornitori quando non si usa MySQL, ecc.) — non committare dati sensibili di produzione; in repo restano solo esempi o cartelle vuote se presenti.
- **Moduli JSON in MySQL:** payload in `tenant_module_data` (chiavi come `inventory`, `suppliers`).

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
| [docs/PRODUCT_IDENTITY.md](docs/PRODUCT_IDENTITY.md) | Nomi e costanti del prodotto (Controllo Totale) |

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
| `/magazzino/magazzino.html` | Magazzino centrale / ricezione |
| `/fornitori/fornitori.html` | Schedario fornitori (anagrafica, ordini, fatture) |

---

## Identità prodotto (env)

`APP_NAME`, `APP_VERSION`, `PRODUCT_SLUG` — vedi `backend/.env.example`.  
`GET /api/system/product` — JSON pubblico (branding client / monitoraggio).
