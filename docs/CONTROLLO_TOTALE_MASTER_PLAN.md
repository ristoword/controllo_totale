# Controllo Totale — Master plan operativo

Roadmap e stato funzionale di **Controllo Totale**. Le voci “Implementato” si riferiscono al codice in questo repository; “Roadmap” richiede sviluppo incrementale.

---

## 1. Architettura generale

- **Core:** Node + Express, sessioni, tenant (`restaurant_id`), persistenza JSON o **MySQL** (`USE_MYSQL_DATABASE`).
- **Obiettivo commerciale:** vendita come installazione per locale e come **SaaS** centralizzato (vedi `ARCHITECTURE_SAAS_SCALING.md`).

---

## 2. Sala

| Requisito | Stato |
|-----------|--------|
| Flusso attuale (mappa, popup, corsi, invio ordini, cameriere, coperti) | **Core** |
| **Unico schermo:** mappa al centro, menu/personale/orologio in alto | **Implementato:** `public/sala/sala-fullscreen.html` |
| Click tavolo → stesso comportamento Sala | **Iframe** → `sala.html` (sessione condivisa, same-origin) |

Roadmap: eliminare iframe e fondere layout in un solo bundle JS/CSS per performance e UX touch.

---

## 3. Cucina

| Requisito | Stato |
|-----------|--------|
| Comande KDS, corsi, colori, Pronto/Servito ultima portata | **Base** (allineato a Ristoword) |
| Tab **Menu** al posto di **Ricette** (accesso diretto gestione menu) | **Implementato:** pulsante Menu → `/menu-admin/menu-admin.html` |
| **Crea piatti** ↔ **Menu** comunicanti | **Roadmap:** unificare modello dati `menu_items` + `recipes` + costi; oggi collegati via API menu/ricette esistenti |
| Magazzino scarico a piatto servito (ricetta con dosi + merce caricata) | **Parziale:** inventory su ordine finalizzato nel core; estendere con vincoli ricetta obbligatoria |
| Ricezione merce: **data** + **fornitore** | **Roadmap:** tabelle in `DATABASE_EXTENSIONS.sql`; UI ricezione già presente in Cucina da arricchire |

---

## 4. Bar / Pizzeria / Cassa / Supervisor / Asporto / Catering

| Modulo | Stato |
|--------|--------|
| Struttura moduli reparto (Bar, Pizzeria, Cassa, …) | **Base** |
| Cassa: report vendita vs costo “sempre a vista” | **Roadmap:** dashboard margini in tempo reale (dati food cost + incassi) |
| Supervisor | Invariato |
| Asporto / Catering | Pagine presenti; estendere flussi dedicati |

---

## 5. Magazzino

- Estendere anagrafica lotti con **giorno ricezione** e **fornitore** (schema SQL in `DATABASE_EXTENSIONS.sql`).
- Allineare scarico automatico a **ricetta** con quantità normalizzate.

---

## 6. Staff HR (“il miglior database possibile”)

Entità previste (implementazione DB + API + UI incrementale):

- Anagrafica dipendente completa  
- Presenze / timbrature  
- Ore lavorate, straordinari  
- Ferie (godute, residue, pagate)  
- Permessi, malattia, riposi  
- Stipendi, premi, buoni, pagamenti  
- Calendario e alert

**Scheletro UI:** `public/staff-hr/index.html`

---

## 7. Non obiettivi

- Demo “giocattolo” senza persistenza: evitare; usare MySQL in staging/produzione per dati reali.

---

*Ultimo aggiornamento: fork Controllo Totale.*
