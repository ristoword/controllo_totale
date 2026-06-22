"use strict";

const { v4: uuidv4 } = require("uuid");
const { useMysqlPersistence } = require("../config/mysqlPersistence");

const MODULE_KEY = "purchase-orders";

const VALID_STATUSES = ["bozza", "inviato", "parziale", "ricevuto", "annullato"];

function normalize(po) {
  return {
    id: po.id || uuidv4(),
    supplierId: po.supplierId || null,
    supplierName: po.supplierName || "",
    status: VALID_STATUSES.includes(po.status) ? po.status : "bozza",
    items: Array.isArray(po.items) ? po.items : [],
    notes: po.notes || "",
    total: Number(po.total) || 0,
    createdAt: po.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sentAt: po.sentAt || null,
    receivedAt: po.receivedAt || null,
    receivedItems: Array.isArray(po.receivedItems) ? po.receivedItems : [],
  };
}

async function getStorage() {
  if (useMysqlPersistence()) {
    const tm = require("./mysql/tenant-module.mysql");
    return {
      async load() { return (await tm.getJson(MODULE_KEY, [])) || []; },
      async save(data) { await tm.setJson(MODULE_KEY, data); },
    };
  }
  const { safeReadJson, safeWriteJson } = require("../utils/safeFileIO");
  const tenantContext = require("../context/tenantContext");
  const paths = require("../config/paths");
  const path = require("path");
  const filePath = () => {
    const rid = tenantContext.getRestaurantId() || "default";
    return path.join(paths.DATA, "tenants", rid, "purchase-orders.json");
  };
  return {
    async load() { return safeReadJson(filePath(), []); },
    async save(data) { safeWriteJson(filePath(), data); },
  };
}

async function list(filters = {}) {
  const storage = await getStorage();
  let orders = await storage.load();
  if (filters.status) orders = orders.filter((o) => o.status === filters.status);
  if (filters.supplierId) orders = orders.filter((o) => o.supplierId === filters.supplierId);
  return orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function getById(id) {
  const storage = await getStorage();
  const orders = await storage.load();
  return orders.find((o) => o.id === id) || null;
}

async function create(data) {
  const storage = await getStorage();
  const orders = await storage.load();
  const po = normalize({ ...data, id: uuidv4(), createdAt: new Date().toISOString() });
  orders.push(po);
  await storage.save(orders);
  return po;
}

async function update(id, patch) {
  const storage = await getStorage();
  const orders = await storage.load();
  const idx = orders.findIndex((o) => o.id === id);
  if (idx === -1) return null;
  const updated = normalize({ ...orders[idx], ...patch, id });
  orders[idx] = updated;
  await storage.save(orders);
  return updated;
}

async function updateStatus(id, status) {
  if (!VALID_STATUSES.includes(status)) return null;
  const extra = {};
  if (status === "inviato") extra.sentAt = new Date().toISOString();
  if (status === "ricevuto") extra.receivedAt = new Date().toISOString();
  return update(id, { status, ...extra });
}

async function receive(id, receivedItems) {
  const storage = await getStorage();
  const orders = await storage.load();
  const idx = orders.findIndex((o) => o.id === id);
  if (idx === -1) return null;

  const po = orders[idx];
  const merged = Array.isArray(po.receivedItems) ? [...po.receivedItems] : [];
  for (const ri of receivedItems || []) {
    const existing = merged.find((m) => m.name === ri.name);
    if (existing) {
      existing.receivedQty = (Number(existing.receivedQty) || 0) + (Number(ri.receivedQty) || 0);
    } else {
      merged.push({ ...ri });
    }
  }

  const allReceived = po.items.every((item) => {
    const recv = merged.find((m) => m.name === item.name);
    return recv && Number(recv.receivedQty) >= Number(item.quantity);
  });

  const status = allReceived ? "ricevuto" : "parziale";
  const updated = normalize({
    ...po,
    receivedItems: merged,
    status,
    receivedAt: allReceived ? new Date().toISOString() : po.receivedAt,
  });
  orders[idx] = updated;
  await storage.save(orders);
  return updated;
}

async function archive(id) {
  return updateStatus(id, "annullato");
}

async function remove(id) {
  const storage = await getStorage();
  const orders = await storage.load();
  const idx = orders.findIndex((o) => o.id === id);
  if (idx === -1) return false;
  orders.splice(idx, 1);
  await storage.save(orders);
  return true;
}

async function report(filters = {}) {
  const orders = await list(filters);
  const totalOrders = orders.length;
  const totalValue = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const byStatus = {};
  for (const o of orders) {
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
  }
  const bySupplier = {};
  for (const o of orders) {
    const key = o.supplierName || o.supplierId || "unknown";
    if (!bySupplier[key]) bySupplier[key] = { count: 0, total: 0 };
    bySupplier[key].count += 1;
    bySupplier[key].total += Number(o.total) || 0;
  }
  return { totalOrders, totalValue, byStatus, bySupplier };
}

module.exports = {
  VALID_STATUSES,
  list,
  getById,
  create,
  update,
  updateStatus,
  receive,
  archive,
  remove,
  report,
};
