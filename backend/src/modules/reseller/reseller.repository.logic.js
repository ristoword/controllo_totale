const crypto = require("crypto");
const bcrypt = require("bcrypt");

const BCRYPT_ROUNDS = 10;

function nowIso() {
  return new Date().toISOString();
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(String(input || ""), "utf8").digest("hex");
}

/**
 * @param {{
 *   readAccounts: () => Promise<{ accounts: unknown[] }>,
 *   writeAccounts: (data: { accounts: unknown[] }) => Promise<void>,
 *   readSessions: () => Promise<{ sessions: unknown[] }>,
 *   writeSessions: (data: { sessions: unknown[] }) => Promise<void>,
 * }} storage
 */
function createResellerApi(storage) {
  async function createAccount({ username, password, partnerCode, displayName }) {
    const u = String(username || "").trim().toLowerCase();
    if (!u || u.length < 3) return { ok: false, error: "Username deve avere almeno 3 caratteri" };
    const p = String(password || "").trim();
    if (p.length < 6) return { ok: false, error: "Password deve avere almeno 6 caratteri" };
    const code = String(partnerCode || "").trim();
    if (!code) return { ok: false, error: "partnerCode obbligatorio" };

    const raw = await storage.readAccounts();
    const list = Array.isArray(raw.accounts) ? raw.accounts : [];
    if (list.find((a) => a.username === u)) {
      return { ok: false, error: "Username già esistente" };
    }

    const hash = await bcrypt.hash(p, BCRYPT_ROUNDS);
    const account = {
      id: crypto.randomUUID ? crypto.randomUUID() : sha256Hex(nowIso() + Math.random()),
      username: u,
      passwordHash: hash,
      partnerCode: code,
      displayName: String(displayName || code),
      active: true,
      createdAt: nowIso(),
    };
    list.push(account);
    await storage.writeAccounts({ accounts: list });
    return { ok: true, account: { id: account.id, username: u, partnerCode: code } };
  }

  async function verifyLogin({ username, password }) {
    const u = String(username || "").trim().toLowerCase();
    const p = String(password || "").trim();
    if (!u || !p) return { ok: false, message: "Credenziali obbligatorie" };

    const raw = await storage.readAccounts();
    const list = Array.isArray(raw.accounts) ? raw.accounts : [];
    const account = list.find((a) => a.username === u && a.active);
    if (!account) return { ok: false, message: "Credenziali non valide" };

    const match = await bcrypt.compare(p, account.passwordHash);
    if (!match) return { ok: false, message: "Credenziali non valide" };

    return {
      ok: true,
      account: {
        id: account.id,
        username: u,
        partnerCode: account.partnerCode,
        displayName: account.displayName,
      },
    };
  }

  async function createSessionToken({ accountId, username, partnerCode }) {
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256Hex(token);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const raw = await storage.readSessions();
    const list = Array.isArray(raw.sessions) ? raw.sessions : [];
    list.push({ tokenHash, accountId, username, partnerCode, createdAt: nowIso(), lastSeenAt: nowIso(), expiresAt });
    await storage.writeSessions({ sessions: list.slice(-500) });
    return { token, expiresAt };
  }

  async function verifySessionToken(token) {
    const t = String(token || "").trim();
    if (!t) return null;
    const tokenHash = sha256Hex(t);
    const raw = await storage.readSessions();
    const list = Array.isArray(raw.sessions) ? raw.sessions : [];
    const hit = list.find((s) => s && s.tokenHash === tokenHash);
    if (!hit) return null;
    if (hit.expiresAt && new Date(hit.expiresAt).getTime() < Date.now()) return null;
    return hit;
  }

  async function touchSession(token) {
    const t = String(token || "").trim();
    if (!t) return;
    const tokenHash = sha256Hex(t);
    const raw = await storage.readSessions();
    const list = Array.isArray(raw.sessions) ? raw.sessions : [];
    const idx = list.findIndex((s) => s?.tokenHash === tokenHash);
    if (idx === -1) return;
    list[idx].lastSeenAt = nowIso();
    await storage.writeSessions({ sessions: list });
  }

  async function deleteSessionToken(token) {
    const t = String(token || "").trim();
    if (!t) return false;
    const tokenHash = sha256Hex(t);
    const raw = await storage.readSessions();
    const list = Array.isArray(raw.sessions) ? raw.sessions : [];
    const nextList = list.filter((s) => s?.tokenHash !== tokenHash);
    await storage.writeSessions({ sessions: nextList });
    return nextList.length !== list.length;
  }

  async function getAccountByPartnerCode(partnerCode) {
    const raw = await storage.readAccounts();
    const list = Array.isArray(raw.accounts) ? raw.accounts : [];
    return list.find((a) => a.partnerCode === partnerCode) || null;
  }

  async function listAccounts() {
    const raw = await storage.readAccounts();
    const list = Array.isArray(raw.accounts) ? raw.accounts : [];
    return list.map((a) => ({
      id: a.id,
      username: a.username,
      partnerCode: a.partnerCode,
      displayName: a.displayName,
      active: a.active,
      createdAt: a.createdAt,
    }));
  }

  async function seedFromEnv() {
    const username = (process.env.RESELLER_SEED_USERNAME || "").trim();
    const password = (process.env.RESELLER_SEED_PASSWORD || "").trim();
    const partnerCode = (process.env.RESELLER_SEED_PARTNER_CODE || "").trim();
    const displayName = (process.env.RESELLER_SEED_DISPLAY_NAME || partnerCode).trim();

    if (!username || !password || !partnerCode) return;

    const raw = await storage.readAccounts();
    const list = Array.isArray(raw.accounts) ? raw.accounts : [];
    if (list.find((a) => a.username === username.toLowerCase())) return;

    const result = await createAccount({ username, password, partnerCode, displayName });
    if (result.ok) {
      console.log(`[Reseller] Account seed creato: ${username} (partner: ${partnerCode})`);
    }
  }

  return {
    createAccount,
    verifyLogin,
    createSessionToken,
    verifySessionToken,
    touchSession,
    deleteSessionToken,
    getAccountByPartnerCode,
    listAccounts,
    seedFromEnv,
  };
}

module.exports = { createResellerApi };
