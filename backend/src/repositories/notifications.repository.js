"use strict";

const { v4: uuidv4 } = require("uuid");
const { useMysqlPersistence } = require("../config/mysqlPersistence");

const MODULE_KEY = "notifications";

function normalize(n) {
  return {
    id: n.id || uuidv4(),
    type: n.type || "info",
    title: n.title || "",
    message: n.message || "",
    read: !!n.read,
    userId: n.userId || null,
    module: n.module || null,
    actionUrl: n.actionUrl || null,
    createdAt: n.createdAt || new Date().toISOString(),
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
    return path.join(paths.DATA, "tenants", rid, "notifications.json");
  };
  return {
    async load() { return safeReadJson(filePath(), []); },
    async save(data) { safeWriteJson(filePath(), data); },
  };
}

async function list(filters = {}) {
  const storage = await getStorage();
  let items = await storage.load();
  if (filters.userId) items = items.filter((n) => n.userId === filters.userId || !n.userId);
  if (filters.unreadOnly) items = items.filter((n) => !n.read);
  return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 100);
}

async function create(data) {
  const storage = await getStorage();
  const items = await storage.load();
  const notif = normalize({ ...data, id: uuidv4(), createdAt: new Date().toISOString() });
  items.push(notif);
  if (items.length > 500) items.splice(0, items.length - 500);
  await storage.save(items);
  return notif;
}

async function markRead(id) {
  const storage = await getStorage();
  const items = await storage.load();
  const idx = items.findIndex((n) => n.id === id);
  if (idx === -1) return null;
  items[idx].read = true;
  await storage.save(items);
  return items[idx];
}

async function markAllRead(userId) {
  const storage = await getStorage();
  const items = await storage.load();
  let count = 0;
  for (const n of items) {
    if (!n.read && (!userId || n.userId === userId || !n.userId)) {
      n.read = true;
      count += 1;
    }
  }
  if (count > 0) await storage.save(items);
  return count;
}

async function remove(id) {
  const storage = await getStorage();
  const items = await storage.load();
  const idx = items.findIndex((n) => n.id === id);
  if (idx === -1) return false;
  items.splice(idx, 1);
  await storage.save(items);
  return true;
}

module.exports = { list, create, markRead, markAllRead, remove };
