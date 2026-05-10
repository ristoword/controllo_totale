// backend/src/repositories/mysql/sala-tables.repository.mysql.js
// MySQL persistence for sala-tables using tenant-module JSON blob strategy.

const crypto = require("crypto");
const { getJson, setJson } = require("./tenant-module.mysql");

const MODULE_KEY = "sala_tables";

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `st_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function buildTable(data = {}) {
  const now = new Date().toISOString();
  return {
    id: data.id || createId(),
    nome: String(data.nome || "T?").trim(),
    posti: Number(data.posti) || 4,
    x: data.x != null ? parseFloat(Number(data.x).toFixed(2)) : 50,
    y: data.y != null ? parseFloat(Number(data.y).toFixed(2)) : 50,
    forma: data.forma === "tondo" ? "tondo" : "quadrato",
    stato: ["libero", "aperto", "conto", "sporco"].includes(data.stato) ? data.stato : "libero",
    createdAt: data.createdAt || now,
    updatedAt: now,
  };
}

async function readAll() {
  const data = await getJson(MODULE_KEY, { tables: [] });
  return Array.isArray(data.tables) ? data.tables : [];
}

async function writeAll(tables) {
  await setJson(MODULE_KEY, { tables });
}

async function listTables() {
  return readAll();
}

async function getTableById(id) {
  const tables = await readAll();
  return tables.find((t) => t.id === id) || null;
}

async function createTable(data) {
  const tables = await readAll();
  const table = buildTable(data);
  tables.push(table);
  await writeAll(tables);
  return table;
}

async function updateTable(id, patch) {
  const tables = await readAll();
  const idx = tables.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const allowed = ["x", "y", "nome", "posti", "forma", "stato"];
  const updated = { ...tables[idx], updatedAt: new Date().toISOString() };
  for (const key of allowed) {
    if (patch[key] !== undefined) updated[key] = patch[key];
  }
  tables[idx] = updated;
  await writeAll(tables);
  return tables[idx];
}

async function deleteTable(id) {
  const tables = await readAll();
  const idx = tables.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  tables.splice(idx, 1);
  await writeAll(tables);
  return true;
}

async function patchStatus(id, stato) {
  const allowed = ["libero", "aperto", "conto", "sporco"];
  const s = allowed.includes(stato) ? stato : "libero";
  return updateTable(id, { stato: s });
}

module.exports = {
  listTables,
  getTableById,
  createTable,
  updateTable,
  deleteTable,
  patchStatus,
};
