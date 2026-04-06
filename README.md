# Controllo Totale

**Piano B** — evoluzione enterprise di Ristoword: stesso codice base, stessi colori e flussi operativi, con documentazione e scheletri per **multi-locale**, **SaaS** e **scala massiccia** (obiettivo progettuale: fino a 10.000 ristoranti in architettura multi-tenant).

Questa cartella è una **copia completa** del repository Ristoword (senza `node_modules` / `.git` al momento della copia). Va trattata come **prodotto separato** per roadmap, branding e deploy.

## Avvio rapido

```bash
cd backend
cp .env.example .env   # configura SESSION_SECRET, DB, ecc.
npm install
npm start
```

Apri `http://localhost:8080/dashboard/dashboard.html` (porta da `.env`).

## Documentazione chiave

| Documento | Contenuto |
|-----------|-----------|
| [docs/CONTROLLO_TOTALE_MASTER_PLAN.md](docs/CONTROLLO_TOTALE_MASTER_PLAN.md) | Visione moduli: Sala fullscreen, Cucina↔Menu, Magazzino, Staff HR, Cassa, SaaS |
| [docs/ARCHITECTURE_SAAS_SCALING.md](docs/ARCHITECTURE_SAAS_SCALING.md) | Multi-tenant, MySQL, strategia 10k tenant |
| [docs/DATABASE_EXTENSIONS.sql](docs/DATABASE_EXTENSIONS.sql) | Schema estensioni (HR, ricezioni, fornitori) — bozza evolutiva |

## Pagine aggiunte in questa fork

- **Sala schermo intero:** `/sala/sala-fullscreen.html` — mappa centrale, barra superiore (personale + orologio), stesso flusso ordini del modulo Sala classico (iframe verso `sala.html`).
- **Staff HR (scheletro):** `/staff-hr/index.html` — struttura per presenze, schede dipendenti, ferie, permessi, pagamenti (API da collegare alle tabelle in `DATABASE_EXTENSIONS.sql`).

## Branding

Le nuove pagine usano il marchio **Controllo Totale (CT)**. Il resto dell’app può restare etichettato Ristoword fino a una passata di i18n/rebrand globale.

## Licenza / vendita

Progettato per essere offerto come **gestionale multi-locale** e **SaaS**: isolamento tenant, sessioni, billing (Stripe già presente nel core) — vedi architettura.
