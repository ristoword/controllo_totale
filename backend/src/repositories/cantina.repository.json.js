const crypto = require("crypto");
const path = require("path");
const paths = require("../config/paths");
const tenantContext = require("../context/tenantContext");
const { safeReadJson, atomicWriteJson } = require("../utils/safeFileIO");

const COLORS = new Set(["rosso", "bianco", "rose", "bollicine", "passito", "orange"]);
const SEED_FILE = path.join(paths.DATA, "config", "cantina-seed.json");

function getDataPath() {
  return paths.tenant(tenantContext.getRestaurantId(), "cantina.json");
}

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : `wine_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeWine(input, existing) {
  const base = existing || {};
  const color = String(input.color || base.color || "rosso").toLowerCase();
  return {
    id: base.id || createId(),
    producer: String(input.producer ?? base.producer ?? "").trim(),
    name: String(input.name ?? base.name ?? "").trim(),
    vintage: input.vintage != null ? Number(input.vintage) : base.vintage ?? null,
    color: COLORS.has(color) ? color : "rosso",
    country: String(input.country ?? base.country ?? "").trim(),
    region: String(input.region ?? base.region ?? "").trim(),
    grape: String(input.grape ?? base.grape ?? "").trim(),
    alcohol: input.alcohol != null ? Number(input.alcohol) : base.alcohol ?? null,
    purchasePrice: Number(input.purchasePrice ?? base.purchasePrice ?? 0) || 0,
    salePrice: Number(input.salePrice ?? base.salePrice ?? 0) || 0,
    stock: Math.max(0, Number(input.stock ?? base.stock ?? 0) || 0),
    pairings: String(input.pairings ?? base.pairings ?? "").trim(),
    notes: String(input.notes ?? base.notes ?? "").trim(),
    active: input.active != null ? !!input.active : base.active !== false,
    createdAt: base.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
}

async function readAll() {
  await seedIfEmpty();
  const raw = safeReadJson(getDataPath(), []);
  return Array.isArray(raw) ? raw : [];
}

async function seedIfEmpty() {
  const filePath = getDataPath();
  const existing = safeReadJson(filePath, null);
  if (Array.isArray(existing) && existing.length > 0) return false;

  const seed = safeReadJson(SEED_FILE, []);
  if (!Array.isArray(seed) || seed.length === 0) return false;

  const wines = seed.map((s) => normalizeWine(s));
  atomicWriteJson(filePath, wines);
  return true;
}

async function writeAll(list) {
  atomicWriteJson(getDataPath(), list);
}

async function list({ q, color, country } = {}) {
  let items = await readAll();
  const query = String(q || "").trim().toLowerCase();
  const colorFilter = String(color || "").trim().toLowerCase();
  const countryFilter = String(country || "").trim().toLowerCase();

  if (query) {
    items = items.filter((w) => {
      const hay = [w.name, w.producer, w.region, w.grape, w.pairings].join(" ").toLowerCase();
      return hay.includes(query);
    });
  }
  if (colorFilter) items = items.filter((w) => String(w.color).toLowerCase() === colorFilter);
  if (countryFilter) items = items.filter((w) => String(w.country).toLowerCase().includes(countryFilter));
  return items.sort((a, b) => String(a.producer).localeCompare(String(b.producer)));
}

async function getById(id) {
  const items = await readAll();
  return items.find((w) => w.id === id) || null;
}

async function create(payload) {
  if (!payload?.name) throw new Error("Nome vino obbligatorio");
  const wine = normalizeWine(payload);
  const items = await readAll();
  items.push(wine);
  await writeAll(items);
  return wine;
}

async function update(id, payload) {
  const items = await readAll();
  const idx = items.findIndex((w) => w.id === id);
  if (idx === -1) return null;
  items[idx] = normalizeWine(payload, items[idx]);
  await writeAll(items);
  return items[idx];
}

async function remove(id) {
  const items = await readAll();
  const next = items.filter((w) => w.id !== id);
  if (next.length === items.length) return false;
  await writeAll(next);
  return true;
}

async function adjustStock(id, delta) {
  const items = await readAll();
  const idx = items.findIndex((w) => w.id === id);
  if (idx === -1) return null;
  const d = Number(delta) || 0;
  items[idx].stock = Math.max(0, (Number(items[idx].stock) || 0) + d);
  items[idx].updatedAt = nowIso();
  await writeAll(items);
  return items[idx];
}

module.exports = { list, getById, create, update, remove, adjustStock, seedIfEmpty, COLORS };
