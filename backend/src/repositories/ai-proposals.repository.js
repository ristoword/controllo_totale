"use strict";

const { v4: uuidv4 } = require("uuid");
const { useMysqlPersistence } = require("../config/mysqlPersistence");

const MODULE_KEY = "ai-proposals";
const VALID_STATUSES = ["pending", "reviewed", "approved", "applied", "rejected", "scheduled"];

function normalize(p) {
  return {
    id: p.id || uuidv4(),
    type: p.type || "general",
    title: p.title || "",
    description: p.description || "",
    impact: p.impact || "medium",
    status: VALID_STATUSES.includes(p.status) ? p.status : "pending",
    data: p.data || {},
    createdAt: p.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reviewedAt: p.reviewedAt || null,
    appliedAt: p.appliedAt || null,
    scheduledFor: p.scheduledFor || null,
    reviewNotes: p.reviewNotes || "",
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
    return path.join(paths.DATA, "tenants", rid, "ai-proposals.json");
  };
  return {
    async load() { return safeReadJson(filePath(), []); },
    async save(data) { safeWriteJson(filePath(), data); },
  };
}

async function list(filters = {}) {
  const storage = await getStorage();
  let items = await storage.load();
  if (filters.status) items = items.filter((p) => p.status === filters.status);
  if (filters.type) items = items.filter((p) => p.type === filters.type);
  return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function getById(id) {
  const storage = await getStorage();
  const items = await storage.load();
  return items.find((p) => p.id === id) || null;
}

async function create(data) {
  const storage = await getStorage();
  const items = await storage.load();
  const proposal = normalize({ ...data, id: uuidv4(), createdAt: new Date().toISOString() });
  items.push(proposal);
  await storage.save(items);
  return proposal;
}

async function update(id, patch) {
  const storage = await getStorage();
  const items = await storage.load();
  const idx = items.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  const updated = normalize({ ...items[idx], ...patch, id });
  items[idx] = updated;
  await storage.save(items);
  return updated;
}

async function review(id, status, notes) {
  if (!["approved", "rejected"].includes(status)) return null;
  return update(id, { status, reviewNotes: notes || "", reviewedAt: new Date().toISOString() });
}

async function apply(id) {
  return update(id, { status: "applied", appliedAt: new Date().toISOString() });
}

async function schedule(id, scheduledFor) {
  return update(id, { status: "scheduled", scheduledFor });
}

async function remove(id) {
  const storage = await getStorage();
  const items = await storage.load();
  const idx = items.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  items.splice(idx, 1);
  await storage.save(items);
  return true;
}

module.exports = { VALID_STATUSES, list, getById, create, update, review, apply, schedule, remove };
