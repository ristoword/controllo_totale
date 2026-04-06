# Staff Access System – Implementation Plan

## Overview

Sistema di accesso staff (login centralizzato dalla **cassa** + login diretto **manager** da cucina, sala, bar, supervisor). Le sessioni operative sono persistite tramite API **`/api/sessions`** (non esiste un endpoint separato `/api/staff-access`).

Questo documento descrive il **comportamento effettivo** nel codice in `CONTROLLO_TOTALE`; la versione precedente (file dedicati `staff-access.routes` e `staff-access.json`) è stata **sostituita** dall’integrazione con `sessions`.

---

## 1. Requirements Summary

| # | Feature | Description |
|---|---------|-------------|
| 1 | Central staff login/logout | Dalla **cassa** per lo staff operativo |
| 2 | Direct login from modules | Manager reparto: cucina, sala, bar, supervisor |
| 3 | Store staff access data | Sessioni con `userId`, reparto, `authorizedBy`, sorgente (`cassa` / `module`) |
| 4 | Future-proof architecture | Base per turni, presenze, ore (estensioni future) |

**Out of scope (per ora):** pianificazione turni completa.

---

## 2. File effettivi (backend)

| File | Ruolo |
|------|--------|
| `backend/src/routes/sessions.routes.js` | `POST /login`, `POST /logout`, `GET /active`, `GET /active/:department` |
| `backend/src/controllers/sessions.controller.js` | Logica sessioni staff |
| `backend/src/repositories/sessions.repository.js` | Router JSON / MySQL |
| `backend/src/app.js` | `app.use("/api/sessions", requireAuth, requireRole(...), sessionsRouter)` |

Registrazione in `app.js` (sezione `// SESSIONS (Staff access)`).

---

## 3. File effettivi (frontend condiviso)

| File | Ruolo |
|------|--------|
| `backend/public/shared/staff-access.js` | `RW_StaffAccess`: login manager (`/api/auth/login` + `/api/sessions/login`), staff cassa (`/api/sessions/login` con `source: "cassa"`), logout, lista attivi |
| `backend/public/shared/staff-access.css` | Stili chip/modal staff |

---

## 4. Moduli UI che includono lo shared module

Inclusi (non esaustivo): `cassa/cassa.html`, `cucina/cucina.html`, `sala/sala.html`, `bar/bar.html`, `supervisor/supervisor.html`, `supervisor/staff/staff.html`.

---

## 5. Modello dati (sessione operativa)

Campi tipici restituiti da `POST /api/sessions/login` e letti dal frontend (vedi `sessions.controller` / repository):

- Identificativo sessione, utente, nome, reparto (`department`)
- `authorizedBy`: valorizzato per login da **cassa**; assente o vuoto per login da **modulo** (manager)
- `source`: es. `"cassa"` | `"module"` (come inviato dal client in `staff-access.js`)

---

## 6. Endpoint API (riferimento)

| Metodo | Path | Descrizione |
|--------|------|-------------|
| POST | `/api/auth/login` | Autenticazione utente (manager / cassa) |
| POST | `/api/sessions/login` | Registra sessione staff dopo login |
| POST | `/api/sessions/logout` | Chiude sessione (`sessionId` o `userId`) |
| GET | `/api/sessions/active` | Sessioni attive |
| GET | `/api/sessions/active/:department` | Sessioni attive per reparto |
| GET | `/api/staff` | Elenco staff (per selezione in cassa) |

---

## 7. Flussi (riepilogo)

### Staff dalla cassa

1. Utente loggato sulla cassa apre il modal staff.
2. Scelta dipendente da `/api/staff` e autorizzatore.
3. `POST /api/sessions/login` con `source: "cassa"` e `authorizedBy`.

### Manager da modulo

1. `POST /api/auth/login` con credenziali ruolo manager.
2. `POST /api/sessions/login` con `source: "module"` e `authorizedBy: null`.

### Logout

`POST /api/sessions/logout` con corpo che identifica la sessione.

---

## 8. Dipendenze

Nessun pacchetto aggiuntivo; si usano Express, sessioni e repository esistenti.

---

## 9. Order of Implementation (storico / manutenzione)

L’implementazione effettiva segue il router **`sessions`** e il frontend **`shared/staff-access.js`**. Per modifiche future:

1. Aggiornare `sessions` repository/controller se servono nuovi campi.
2. Aggiornare `staff-access.js` per i testi e i payload.
3. Eventuale estensione `auth` / ruoli manager in `auth.repository` o equivalente.

---

*Aggiornato: allineamento a `/api/sessions` e file reali nel repo Controllo Totale.*
