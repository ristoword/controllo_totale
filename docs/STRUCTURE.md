# Struttura repository (pulita)

```
CONTROLLO_TOTALE/
├── README.md                 # Punto di ingresso umano
├── DEPLOY.md                 # Solo deploy / healthcheck / Railway
├── package.json              # Avvio: cd backend && npm start
├── railway.toml              # Healthcheck Railway (root)
├── docs/                     # Documentazione prodotto (non runtime)
│   ├── _archive/             # Storico/report/debug (opzionale)
│   ├── CONTROLLO_TOTALE_MASTER_PLAN.md
│   ├── ARCHITECTURE_SAAS_SCALING.md
│   ├── DATABASE_EXTENSIONS.sql
│   └── PRODUCT_SAAS.md
└── backend/                  # UNICA applicazione server
    ├── package.json
    ├── railway.toml          # Se deploy con root = backend
    ├── src/                  # Codice server (Express, servizi, API)
    ├── public/               # UI statiche (moduli sala, cucina, cassa, …)
    ├── data/                 # Persistenza JSON (dev) o vuota se solo MySQL
    ├── db/                   # Schema SQL di riferimento
    └── docs/                 # Note tecniche (MySQL, integrazioni)
```

**Non esiste** un secondo `backend` annidato: il percorso `backend/backend/` era un errore storico (sessioni duplicate) ed è stato rimosso.

**Ristoword** non è in questa cartella: è un progetto separato sul tuo PC; qui lavori solo su **Controllo Totale**.
