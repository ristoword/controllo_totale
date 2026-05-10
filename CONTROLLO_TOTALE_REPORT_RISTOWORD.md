# CONTROLLO TOTALE — Report progetto (riferimento per integrazione / confronto RistoWord)

**Generato:** documento di lavoro da tenere sulla Scrivania.  
**Nota:** non sostituisce il codice sorgente; va aggiornato se il repository cambia in modo significativo.

**Percorso repository (locale tipico):** `~/Desktop/CONTROLLO_TOTALE` o dove hai clonato il progetto.

---

## 1. Cos’è

- **Nome prodotto:** Controllo Totale (CT) — gestionale per ristorazione, orientato **kitchen-first**, multi-reparto (sala, cucina, bar, pizzeria, cassa, magazzino, supervisor, ecc.).
- **Modello:** **SaaS multi-tenant**: ogni **ristorante** (`restaurantId`) ha dati isolati; non è “una cartella per ogni utente”, ma **per ogni locale**.
- **Stack principale:** **Node.js (Express 5)**, sessioni, API REST, frontend **statico** in `backend/public/` (HTML/CSS/JS), **WebSocket** dove previsto, opzionale **MySQL** per persistenza oltre ai file JSON per tenant.

---

## 2. Struttura repository (alto livello)

```
CONTROLLO_TOTALE/
├── package.json              # workspace root, npm start → backend
├── backend/
│   ├── package.json
│   ├── .env / .env.example   # configurazione (non committare segreti)
│   ├── src/                  # server Express, API, servizi
│   ├── public/               # UI web (dashboard, sala, cucina, cassa, …)
│   ├── data/                 # dati runtime (tenant, legacy); spesso .gitignored in prod
│   └── db/                   # schema SQL (es. schema.sql) per MySQL
```

- **Entry server:** `backend/src/server.js` → carica `app.js`.
- **Config percorsi:** `backend/src/config/paths.js` — `data/tenants/{tenantId}/…`.

---

## 3. Multi-tenant (isolamento per ristorante)

- Directory tenant: **`data/tenants/{restaurantId}/`** con file JSON (ordini, menu, pagamenti, inventario, staff-shifts, fornitori, archivio, ecc.).
- **Onboarding** nuovo locale: creazione cartella + seed file (`backend/src/service/onboarding.service.js`, lista `TENANT_FILES`).
- **Contesto tenant:** middleware `tenantContext` — le API leggono/scrivono in base alla sessione utente (`restaurantId`).
- **MySQL** (se `USE_MYSQL_DATABASE=true`): righe con `restaurant_id`; stessa logica di isolamento.

---

## 4. Backend — aree API (file in `backend/src/routes/`)

| Area | File route (indicativo) |
|------|-------------------------|
| Auth / sessione | `auth.routes.js` |
| Ordini | `orders.routes.js` |
| Menu | `menu.routes.js` |
| Pagamenti / cassa / turni POS | `payments.routes.js` |
| Chiusure / Z | `closures.routes.js` |
| Storni | `storni.routes.js` |
| Report | `reports.routes.js` |
| Inventario / movimenti / trasferimenti | `inventory.routes.js`, `stock-movements.routes` |
| Fornitori | `suppliers.routes.js` |
| QR tavoli | `qr.routes.js` |
| Prenotazioni | `bookings.routes.js` |
| Catering | `catering.routes.js` |
| Menu del giorno | `daily-menu.routes.js` |
| Ricette | `recipes.routes.js` |
| Staff / turni HR | `staff.routes.js`, `leave.routes.js`, `attendance.routes` |
| Clienti | `customers.routes.js` |
| HACCP | `haccp.routes.js` |
| Stampanti / code stampa | `print-jobs.routes.js`, `print-routes.routes.js` |
| AI | `ai.routes.js` |
| Licenze / owner / setup | `license.routes.js`, `owner.routes.js`, `setup.routes.js`, `owner-console.routes.js` |
| Stripe / checkout | `stripe.routes.js`, `checkout.routes.js`, webhook |
| **Archivio** (incassi storici, comande, fatture) | `archive.routes.js` → `/api/archive` |
| Sessioni staff (login reparto) | `sessions.routes.js` |
| Dispositivi | `devices.routes.js` |
| Dev / emergenza | `dev-access.routes.js` |

**Montaggio route:** `backend/src/app.js` (ordine middleware: licenza, setup, auth, ruoli).

---

## 5. Frontend — pagine principali (`backend/public/`)

| Percorso URL (esempi) | Contenuto |
|----------------------|-----------|
| `/`, `/dashboard/` | Dashboard operativa |
| `/sala/sala.html`, `sala-fullscreen` | Sala |
| `/cucina/cucina.html`, `food-cost.html` | Cucina, food cost |
| `/pizzeria/`, `/bar/` | Reparti |
| `/cassa/cassa.html`, `chiusura.html` | Cassa, chiusura |
| `/magazzino/magazzino.html` | Magazzino |
| `/fornitori/fornitori.html` | Schedario fornitori + fatture passive |
| `/supervisor/supervisor.html` | Supervisor |
| `/supervisor/staff/staff.html`, `/staff/me/`, `/staff-hr/` | Staff / HR |
| `/menu-admin/menu-admin.html` | Admin menu piatti |
| `/daily-menu/daily-menu.html` | Menu del giorno |
| `/catering/catering.html` | Catering |
| `/prenotazioni/prenotazioni.html` | Prenotazioni |
| `/asporto/asporto.html` | Asporto |
| `/qr/`, `/qr-tables/` | Ordini QR / gestione QR |
| `/hardware/hardware.html` | Stampa / dispositivi |
| `/archivio/archivio.html`, `/archivio/comande.html` | **Archivio finanziario e comande servite** |
| `/login/`, `/change-password/`, `/owner-console/`, `/owner-activate/` | Accesso e configurazione owner |

**Shared:** `public/shared/` — `api.js` (RW_API), `auth-guard.js`, CSS comuni, `print-layout.css` dove previsto.

---

## 6. Dati e file tipici per tenant (JSON)

Esempi (non esaustivo): `orders.json`, `payments.json`, `menu.json`, `inventory.json`, `closures.json`, `cassa-shifts.json`, `pos-shifts.json`, `staff.json`, `suppliers.json`, `bookings.json`, `catering-events.json`, `haccp-checks.json`, `sessions.json`, `archive-store.json`, `settings.json`, ecc.

Upload allegati archivio acquisti: sotto `data/tenants/{id}/uploads/purchase-invoices/`.

---

## 7. Autenticazione e ruoli

- Sessione Express (cookie); ruoli tipo: `owner`, `supervisor`, `sala`, `cucina`, `cassa`, `magazzino`, …
- Pagine protette: `requirePageAuth` in middleware (`requirePageAuth.middleware.js`) — pattern URL in lista.
- API: `requireAuth` + `requireRole(...)` per endpoint sensibili.

---

## 8. Dipendenze backend (npm)

Vedi `backend/package.json`: **express**, **express-session**, **mysql2**, **bcrypt**, **ws**, **stripe**, **nodemailer**, **openai**, **xlsx**, **helmet**, **rate-limit**, ecc.

**Node:** `>=18` (root `package.json`).

---

## 9. Variabili ambiente (panorama)

File guida: **`backend/.env.example`**.

- Obbligatorio in produzione tipica: `SESSION_SECRET`, URL pubblico (`PUBLIC_APP_URL` / `BASE_URL`).
- **MySQL:** `USE_MYSQL_DATABASE`, `DATABASE_URL` o variabili `MYSQL*`.
- **Stripe:** chiavi, webhook, price ID (anche alias legacy Ristoword menzionati nel commento `.env.example`).
- **QR ordini:** `QR_ORDER_SECRET` allineato a `public/qr/index.html`.
- **OpenAI:** `OPENAI_API_KEY` per `/api/ai/…`.

Non committare `.env` reale.

---

## 10. Note utili per confronto / integrazione con RistoWord

1. **Fonte di verità ordini/incassi:** in CT sono legati a tenant + file o MySQL; integrare con un altro gestionale richiede **mapping modelli** e un solo flusso operativo o un **bridge** API.
2. **RistoWord** nel `.env.example` compare solo come riferimento **Stripe/price legacy** — non implica codice RistoWord in questo repo.
3. **Stampa:** molte UI usano `window.print()` + `public/shared/print-layout.css` e/o job server `/api/print-jobs`.
4. **Fatture cassa:** storico locale `localStorage` chiave `rw_invoices` in cassa + sync verso archivio server (`/api/archive/cassa-invoices`).

---

## 11. Comandi utili

```bash
# dalla root del monorepo
npm install
npm start

# backend direttamente
cd backend && npm start
```

Script utili in `backend/package.json`: `migrate:mysql`, `db:bootstrap`, `smoke:hosting`, ecc.

---

## 12. File “ancora” del progetto (per orientarsi)

| File | Ruolo |
|------|--------|
| `backend/src/app.js` | App Express, static, mount API |
| `backend/src/server.js` | Avvio server |
| `backend/src/middleware/tenantContext.middleware.js` | Tenant da sessione |
| `backend/src/config/paths.js` | Percorsi `data/tenants` |
| `backend/db/schema.sql` | Schema MySQL orientativo |

---

*Fine report — Controllo Totale.*
