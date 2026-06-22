const crypto = require("crypto");
const path = require("path");
const paths = require("../config/paths");
const { safeReadJson } = require("../utils/safeFileIO");

const SEED_FILE = path.join(paths.DATA, "config", "customers-seed.json");
const VALID_CATEGORIES = new Set(["vip", "habitue", "walkin", "nuovo", "normal", "top"]);

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `cli_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function normalizeString(v, fallback = "") {
  if (v == null) return fallback;
  return String(v).trim();
}

function normalizeCategory(cat) {
  const c = String(cat || "nuovo").toLowerCase();
  if (c === "top") return "habitue";
  if (c === "normal") return "walkin";
  return VALID_CATEGORIES.has(c) ? c : "nuovo";
}

function buildCustomer(data = {}) {
  const now = new Date().toISOString();
  return {
    id: data.id || createId(),
    name: normalizeString(data.name, ""),
    surname: normalizeString(data.surname, ""),
    phone: normalizeString(data.phone, ""),
    email: normalizeString(data.email, ""),
    notes: normalizeString(data.notes, ""),
    birthday: normalizeString(data.birthday, ""),
    anniversaries: Array.isArray(data.anniversaries)
      ? data.anniversaries.map((a) => ({
          label: normalizeString(a.label || a, ""),
          date: normalizeString(typeof a === "object" ? a.date : "", ""),
        }))
      : [],
    allergies: Array.isArray(data.allergies) ? data.allergies.map(String) : [],
    intolerances: Array.isArray(data.intolerances) ? data.intolerances.map(String) : [],
    preferences: Array.isArray(data.preferences) ? data.preferences.map(String) : [],
    category: normalizeCategory(data.category),
    visits: Math.max(0, Number(data.visits) || 0),
    totalSpent: Math.max(0, Number(data.totalSpent) || 0),
    lastVisit: normalizeString(data.lastVisit, "").slice(0, 10),
    createdAt: data.createdAt || now,
    updatedAt: now,
  };
}

/**
 * @param {{ loadCustomers: () => Promise<unknown[]>, saveCustomers: (list: unknown[]) => Promise<void> }} storage
 */
function createCustomersApi(storage) {
  async function readAll() {
    await seedIfEmpty();
    const raw = await storage.loadCustomers();
    return Array.isArray(raw) ? raw.map((c) => buildCustomer(c)) : [];
  }

  async function seedIfEmpty() {
    const existing = await storage.loadCustomers();
    if (Array.isArray(existing) && existing.length > 0) return false;
    const seed = safeReadJson(SEED_FILE, []);
    if (!Array.isArray(seed) || seed.length === 0) return false;
    await storage.saveCustomers(seed.map((s) => buildCustomer(s)));
    return true;
  }

  async function writeAll(list) {
    await storage.saveCustomers(list);
  }

  async function getAll() {
    return readAll();
  }

  async function getById(id) {
    const list = await readAll();
    return list.find((c) => c.id === id) || null;
  }

  async function findByPhone(phone) {
    const p = normalizeString(phone).replace(/\D/g, "");
    if (!p) return null;
    const list = await readAll();
    return (
      list.find((c) => {
        const cp = normalizeString(c.phone).replace(/\D/g, "");
        return cp && cp === p;
      }) || null
    );
  }

  async function findByEmail(email) {
    const e = normalizeString(email).toLowerCase();
    if (!e) return null;
    const list = await readAll();
    return (
      list.find((c) => {
        const ce = normalizeString(c.email).toLowerCase();
        return ce && ce === e;
      }) || null
    );
  }

  async function searchByNameOrPhone(query) {
    const q = normalizeString(query).toLowerCase();
    if (!q) return [];
    const list = await readAll();
    return list.filter((c) => {
      const full = `${normalizeString(c.name)} ${normalizeString(c.surname)}`.toLowerCase();
      const phone = normalizeString(c.phone);
      const email = normalizeString(c.email).toLowerCase();
      return full.includes(q) || phone.includes(q) || email.includes(q);
    });
  }

  async function create(data) {
    const list = await readAll();
    const customer = buildCustomer({ ...data });
    list.push(customer);
    await writeAll(list);
    return customer;
  }

  async function update(id, data) {
    const list = await readAll();
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    const existing = list[idx];
    const updated = buildCustomer({ ...existing, ...data, id: existing.id, createdAt: existing.createdAt });
    list[idx] = updated;
    await writeAll(list);
    return updated;
  }

  async function remove(id) {
    const list = await readAll();
    const next = list.filter((c) => c.id !== id);
    if (next.length === list.length) return false;
    await writeAll(next);
    return true;
  }

  return {
    getAll,
    getById,
    findByPhone,
    findByEmail,
    searchByNameOrPhone,
    create,
    update,
    remove,
    seedIfEmpty,
    buildCustomer,
  };
}

module.exports = {
  createCustomersApi,
  buildCustomer,
  normalizeCategory,
  SEED_FILE,
};
