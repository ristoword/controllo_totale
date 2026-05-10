/**
 * Archivio: esclusioni comande, fatture cassa sincronizzate, fatture acquisto in entrata.
 * Persistenza JSON per tenant (compatibile con stack MySQL per ordini/pagamenti).
 */
const path = require("path");
const fs = require("fs");
const fsp = require("fs/promises");
const crypto = require("crypto");
const paths = require("../config/paths");
const tenantContext = require("../context/tenantContext");
const { safeReadJson, atomicWriteJson } = require("../utils/safeFileIO");

function getStorePath() {
  return paths.tenant(tenantContext.getRestaurantId(), "archive-store.json");
}

function getUploadsDir() {
  const tid = tenantContext.getRestaurantId();
  const id = paths.sanitizeTenantId(tid) || "default";
  return path.join(paths.DATA, "tenants", id, "uploads", "purchase-invoices");
}

function defaultStore() {
  return {
    excludedOrderIds: [],
    cassaOutgoingInvoices: [],
    purchaseIncoming: [],
  };
}

async function readStore() {
  const merged = { ...defaultStore(), ...safeReadJson(getStorePath(), {}) };
  if (!Array.isArray(merged.excludedOrderIds)) merged.excludedOrderIds = [];
  if (!Array.isArray(merged.cassaOutgoingInvoices)) merged.cassaOutgoingInvoices = [];
  if (!Array.isArray(merged.purchaseIncoming)) merged.purchaseIncoming = [];
  return merged;
}

async function writeStore(data) {
  atomicWriteJson(getStorePath(), { ...defaultStore(), ...data });
}

function createId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

async function saveAttachmentBuffer(id, buffer, ext) {
  const dir = getUploadsDir();
  await fsp.mkdir(dir, { recursive: true });
  const safeExt = String(ext || "bin").replace(/[^a-z0-9]/gi, "").slice(0, 8) || "bin";
  const fileName = `${id}.${safeExt}`;
  const full = path.join(dir, fileName);
  await fsp.writeFile(full, buffer);
  return `uploads/purchase-invoices/${fileName}`;
}

async function readAttachmentRelative(relPath) {
  if (!relPath || typeof relPath !== "string") return null;
  const tid = tenantContext.getRestaurantId();
  const id = paths.sanitizeTenantId(tid) || "default";
  const base = path.join(paths.DATA, "tenants", id);
  const full = path.join(base, relPath.replace(/^\//, ""));
  if (!full.startsWith(base) || !fs.existsSync(full)) return null;
  return fsp.readFile(full);
}

module.exports = {
  readStore,
  writeStore,
  createId,
  saveAttachmentBuffer,
  readAttachmentRelative,
  getUploadsDir,
};
