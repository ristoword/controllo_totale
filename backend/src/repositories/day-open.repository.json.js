/**
 * Stato "giornata aperta" per tenant (file JSON in data/tenants/{id}/day_open.json).
 * Coerente con closures.repository.json (stesso getDataDir).
 */

const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");
const paths = require("../config/paths");
const tenantContext = require("../context/tenantContext");
const closuresRepository = require("./closures.repository");

function getDataDir() {
  const restaurantId = tenantContext.getRestaurantId();
  if (!restaurantId) return paths.DATA;
  return path.join(paths.DATA, "tenants", restaurantId);
}

function getDayOpenPath() {
  return path.join(getDataDir(), "day_open.json");
}

async function readState() {
  const p = getDayOpenPath();
  await fsp.mkdir(path.dirname(p), { recursive: true });
  if (!fs.existsSync(p)) return null;
  const raw = await fsp.readFile(p, "utf8");
  if (!raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.date) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeState(state) {
  const p = getDayOpenPath();
  await fsp.mkdir(path.dirname(p), { recursive: true });
  await fsp.writeFile(p, JSON.stringify(state, null, 2), "utf8");
}

/**
 * Apre la giornata lavorativa (solo se dateStr è "oggi" UTC e la giornata non è chiusa in Z).
 * @returns {{ date, openedAt, openedBy } | null}
 */
async function ensureOpenForToday(dateStr, openedBy) {
  const d = String(dateStr || "").slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  if (d !== today) {
    const s = await readState();
    if (s && s.date === d) {
      return { date: s.date, openedAt: s.openedAt, openedBy: s.openedBy || "" };
    }
    return { date: d, openedAt: null, openedBy: null };
  }
  if (await closuresRepository.isDayClosed(d)) {
    return null;
  }
  let state = await readState();
  if (state && state.date === d) {
    return { date: state.date, openedAt: state.openedAt, openedBy: state.openedBy || "" };
  }
  const now = new Date().toISOString();
  state = { date: d, openedAt: now, openedBy: openedBy || "system" };
  await writeState(state);
  return state;
}

/** Dopo chiusura Z: azzera lo stato se riferito alla stessa data. */
async function clearIfDateMatches(dateStr) {
  const d = String(dateStr || "").slice(0, 10);
  const state = await readState();
  if (!state || state.date !== d) return;
  await writeState({});
}

module.exports = {
  ensureOpenForToday,
  clearIfDateMatches,
};
