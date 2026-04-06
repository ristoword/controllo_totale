# Database dedicato — Controllo Totale

## Regola

**Un deploy = un database MySQL dedicato**, creato per quel sito (vuoto prima del bootstrap).  
**Non** riusare il database di altri progetti, ambienti legacy o installazioni Ristoword: rischi sovrascritture, sessioni mescolate e dati incoerenti.

## Cosa fare per un sito nuovo

1. **Crea un nuovo database** sul provider (Railway, PlanetScale, VPS, ecc.), con un nome esplicito, ad es. `controllo_totale_prod` o `ct_sito_cliente`.
2. **Imposta le variabili** solo per questo deploy (`DATABASE_URL` o `MYSQLHOST` + `MYSQLDATABASE` + …) puntando **solo** a quel database.
3. **Bootstrap** una tantum: da `backend/` esegui `npm run db:bootstrap` (o applica `backend/db/schema.sql`) sul DB vuoto.
4. **Attiva** `USE_MYSQL_DATABASE=true` solo dopo che lo schema è applicato e hai verificato la connessione.

## Default nel codice

Se non imposti `MYSQLDATABASE` / `MYSQL_DATABASE`, il fallback è il nome **`controllo_totale`** (vedi `backend/src/config/mysqlDefaults.js`). È un nome neutro per sviluppo locale; in produzione conviene **sempre** impostare esplicitamente il nome del DB sul provider.

## Cosa non fare

- Non puntare `DATABASE_URL` al database di un altro prodotto “per prova”.
- Non condividere lo stesso schema tra due siti diversi senza una strategia multi-tenant esplicita (questo repo assume un DB per deploy o tenant gestito via `restaurant_id` nello **stesso** DB dedicato al servizio).

## JSON senza MySQL

Con `USE_MYSQL_DATABASE=false` i dati restano in file sotto `backend/data/` (e `data/tenants/...`). Anche lì: **directory dati dedicate** al deploy, non cartelle condivise con altri progetti.
