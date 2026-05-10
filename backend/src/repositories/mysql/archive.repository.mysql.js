// backend/src/repositories/mysql/archive.repository.mysql.js
// MySQL persistence for archive metadata using tenant-module JSON blob strategy.
// File attachments (PDFs) are always stored on disk - only metadata is in MySQL.

const { getJson, setJson } = require("./tenant-module.mysql");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const fsp = require("fs/promises");
const pathsConfig = require("../../config/paths");
const tenantContext = require("../../context/tenantContext");

const MODULE_KEY = "archive_store";

function defaultStore() {
  return {
    excludedOrderIds: [],
    cassaOutgoingInvoices: [],
    purchaseIncoming: [],
  };
}

async function readStore() {
  const data = await getJson(MODULE_KEY, defaultStore());
  const merged = { ...defaultStore(), ...data };
  if (!Array.isArray(merged.excludedOrderIds)) merged.excludedOrderIds = [];
  if (!Array.isArray(merged.cassaOutgoingInvoices)) merged.cassaOutgoingInvoices = [];
  if (!Array.isArray(merged.purchaseIncoming)) merged.purchaseIncoming = [];
  return merged;
}

async function writeStore(data) {
  await setJson(MODULE_KEY, { ...defaultStore(), ...data });
}

function createId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function getUploadsDir() {
  const tid = tenantContext.getRestaurantId();
  const id = pathsConfig.sanitizeTenantId(tid) || "default";
  return path.join(pathsConfig.DATA, "tenants", id, "uploads", "purchase-invoices");
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
  const id = pathsConfig.sanitizeTenantId(tid) || "default";
  const full = path.join(pathsConfig.DATA, "tenants", id, relPath);
  try {
    const buf = await fsp.readFile(full);
    return buf;
  } catch {
    return null;
  }
}

module.exports = {
  readStore,
  writeStore,
  createId,
  saveAttachmentBuffer,
  readAttachmentRelative,
  getUploadsDir,
};
