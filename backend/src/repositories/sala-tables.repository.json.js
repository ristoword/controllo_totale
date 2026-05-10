// backend/src/repositories/sala-tables.repository.json.js
// Sala tables – stato, posizione, coperti, forma persistiti per tenant.

const paths = require("../config/paths");
const tenantContext = require("../context/tenantContext");
const { safeReadJson, atomicWriteJson } = require("../utils/safeFileIO");

function getDataPath() {
  return paths.tenant(tenantContext.getRestaurantId(), "sala-tables.json");
}

function readAll() {
  const data = safeReadJson(getDataPath(), { tables: [] });
  return Array.isArray(data.tables) ? data.tables : [];
}

function writeAll(tables) {
  atomicWriteJson(getDataPath(), { tables });
}

function generateId() {
  return `st_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function listTables() {
  return readAll();
}

function getTableById(id) {
  return readAll().find((t) => t.id === id) || null;
}

function createTable(data) {
  const tables = readAll();
  const table = {
    id: generateId(),
    nome: data.nome || `T${tables.length + 1}`,
    posti: Number(data.posti) || 4,
    x: data.x != null ? Number(data.x) : 50,
    y: data.y != null ? Number(data.y) : 50,
    forma: data.forma === "tondo" ? "tondo" : "quadrato",
    stato: "libero",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  tables.push(table);
  writeAll(tables);
  return table;
}

function updateTable(id, patch) {
  const tables = readAll();
  const idx = tables.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const allowed = ["x", "y", "nome", "posti", "forma", "stato"];
  const updated = { ...tables[idx], updatedAt: new Date().toISOString() };
  for (const key of allowed) {
    if (patch[key] !== undefined) updated[key] = patch[key];
  }
  tables[idx] = updated;
  writeAll(tables);
  return tables[idx];
}

function deleteTable(id) {
  const tables = readAll();
  const idx = tables.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  tables.splice(idx, 1);
  writeAll(tables);
  return true;
}

function patchStatus(id, stato) {
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
