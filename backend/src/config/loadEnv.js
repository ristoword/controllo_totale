// Carica backend/.env in modo affidabile (cwd, monorepo, path con spazi).
// Senza pacchetto `dotenv`: in deploy (Docker/Railway) se `npm ci` non popola i moduli,
// il primo require non deve far crashare l'app prima ancora di express.
const path = require("path");
const fs = require("fs");

/** Evita doppio caricamento quando server.js e env.js chiamano loadEnv(). */
let loadEnvDone = false;
let loadEnvResultPath = null;

/**
 * Parser .env minimale: non sovrascrive chiavi già presenti in process.env (come dotenv).
 */
function applyEnvFromFile(absPath) {
  if (!fs.existsSync(absPath)) return false;
  let raw;
  try {
    raw = fs.readFileSync(absPath, "utf8");
  } catch {
    return false;
  }
  const lines = raw.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    let body = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
    const eq = body.indexOf("=");
    if (eq <= 0) continue;
    const key = body.slice(0, eq).trim();
    if (!key) continue;
    let val = body.slice(eq + 1).trim();
    if (val.startsWith('"') && !val.endsWith('"')) {
      while (i + 1 < lines.length && !val.endsWith('"')) {
        i++;
        val += "\n" + lines[i];
      }
    }
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
      val = val.replace(/\\n/g, "\n").replace(/\\"/g, '"');
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
  return true;
}

/**
 * Risolve la cartella `backend/` (dove deve stare `.env`).
 * Questo file è in `backend/src/config/loadEnv.js`.
 */
function getBackendRoot() {
  return path.resolve(path.join(__dirname, "..", ".."));
}

/**
 * Prova più percorsi e carica il primo `.env` esistente.
 * @returns {string|null} path caricato o null
 */
function loadEnv() {
  if (loadEnvDone) return loadEnvResultPath;
  loadEnvDone = true;

  const backendRoot = getBackendRoot();
  const candidates = [
    path.join(backendRoot, ".env"),
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), "backend", ".env"),
    path.join(process.cwd(), "..", ".env"),
  ];

  const tried = [];
  for (const p of candidates) {
    const abs = path.resolve(p);
    if (tried.includes(abs)) continue;
    tried.push(abs);
    try {
      if (fs.existsSync(abs)) {
        const ok = applyEnvFromFile(abs);
        if (ok) {
          if (process.env.NODE_ENV !== "production") {
            // eslint-disable-next-line no-console
            console.info("[ENV] Caricato:", abs);
          }
          loadEnvResultPath = abs;
          return loadEnvResultPath;
        }
      }
    } catch (_) {
      /* continua */
    }
  }

  applyEnvFromFile(path.join(process.cwd(), ".env"));
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn(
      "[ENV] Nessun file .env trovato nei percorsi noti. Cerca backend/.env con SUPER_ADMIN_USERNAME e SUPER_ADMIN_PASSWORD."
    );
  }
  loadEnvResultPath = null;
  return loadEnvResultPath;
}

module.exports = { loadEnv, getBackendRoot };
