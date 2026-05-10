// backend/src/server.js
// Route registration is in ./app.js (orders, menu, reports, ai, recipes, etc.)
const crypto = require("crypto");

require("./config/loadEnv").loadEnv();

/**
 * Hosting (Railway, ecc.): senza SESSION_SECRET il processo usciva prima di listen → 502.
 * Generiamo un segreto effimero così il servizio risponde; l’utente deve comunque impostare
 * SESSION_SECRET per sessioni stabili tra i deploy e in caso di più repliche.
 */
function ensureSessionSecret() {
  const raw = process.env.SESSION_SECRET;
  const s = raw != null ? String(raw).trim() : "";
  if (s) return;
  process.env.SESSION_SECRET = crypto.randomBytes(32).toString("hex");
  process.env.CT_SESSION_SECRET_EPHEMERAL = "true";
  const msg =
    "[CONFIG] SESSION_SECRET non impostato: uso segreto temporaneo generato all'avvio. " +
    "Aggiungi SESSION_SECRET nelle variabili d'ambiente (≥32 caratteri casuali); " +
    "altrimenti tutti gli utenti verranno disconnessi a ogni deploy o riavvio.";
  if (process.env.NODE_ENV === "production") {
    // eslint-disable-next-line no-console
    console.warn(msg);
  } else {
    // eslint-disable-next-line no-console
    console.info(msg);
  }
}

ensureSessionSecret();

/**
 * Hardening minimo (blocco 1): solo warning, nessuna modifica alla logica applicativa.
 * SESSION_SECRET resta obbligatorio per express-session (vedi config/session.js).
 */
function printStartupSecurityHints() {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn("[WARN] NODE_ENV non impostato su production");
  }

  const rawSecret = process.env.SESSION_SECRET;
  const sec = rawSecret != null ? String(rawSecret).trim() : "";
  if (!sec || sec.length < 20) {
    // eslint-disable-next-line no-console
    console.warn("[SECURITY] SESSION_SECRET mancante o troppo corto (< 20 caratteri)");
  }

  const base =
    (process.env.PUBLIC_APP_URL && String(process.env.PUBLIC_APP_URL).trim()) ||
    (process.env.BASE_URL && String(process.env.BASE_URL).trim()) ||
    (process.env.APP_URL && String(process.env.APP_URL).trim());
  if (!base) {
    // eslint-disable-next-line no-console
    console.warn("[CONFIG] PUBLIC_APP_URL mancante (definire anche BASE_URL o APP_URL se preferisci)");
  }
}

printStartupSecurityHints();

// Centralized configuration validation (env, secrets, optional integrations).
// This runs before loading the main app/session modules so that configuration
// errors are reported clearly and early.
try {
  const { validateConfig } = require("./config/validateConfig");
  validateConfig();
} catch (err) {
  // Fail fast with a clear, human‑readable message.
  // Never log secret values.
  // eslint-disable-next-line no-console
  console.error(err && err.message ? err.message : err);
  throw err;
}

const http = require("http");
const app = require("./app");
const sessionMiddleware = require("./config/session");
const { initWebSocket } = require("./service/websocket.service");
const logger = require("./utils/logger");
const { startAutoBackup, backupNow } = require("./utils/backup");
const branding = require("./config/branding");

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
initWebSocket(server, sessionMiddleware);

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

server.listen(PORT, "0.0.0.0", () => {
  const mode = process.env.NODE_ENV === "production" ? "production" : "dev";
  const baseUrl =
    (process.env.PUBLIC_APP_URL && String(process.env.PUBLIC_APP_URL).trim()) ||
    (process.env.BASE_URL && String(process.env.BASE_URL).trim()) ||
    (process.env.APP_URL && String(process.env.APP_URL).trim()) ||
    "(non impostato)";
  // eslint-disable-next-line no-console
  console.log(branding.getLogPrefix(), "MODE:", mode);
  // eslint-disable-next-line no-console
  console.log(branding.getLogPrefix(), "PORT:", PORT);
  // eslint-disable-next-line no-console
  console.log(branding.getLogPrefix(), "BASE_URL:", baseUrl);
  // eslint-disable-next-line no-console
  console.log(branding.getLogPrefix(), "SECURITY: basic checks done");
  logger.info("Server started", { port: PORT, websocket: "/ws" });

  // MySQL: ping opzionale (MYSQL_PING_ON_START=true + URL o host remoto). Non blocca né sostituisce JSON.
  setImmediate(() => {
    try {
      const { maybePingMysqlOnStart } = require("./db/mysql-startup-ping");
      maybePingMysqlOnStart().catch(() => {});
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[MySQL] Ping avvio non eseguito:", e && e.message ? e.message : e);
    }
  });

  // BACKUP IMMEDIATO + AUTO
  backupNow();
  startAutoBackup();
});