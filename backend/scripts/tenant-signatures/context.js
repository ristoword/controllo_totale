"use strict";

const crypto = require("crypto");

function seedId(tenantId, suffix) {
  const slug = String(tenantId || "tenant").replace(/[^a-zA-Z0-9-]/g, "-");
  return `seed-${slug}-${suffix}`;
}

function orderNum(tenantId) {
  let h = 0;
  for (const c of String(tenantId)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 900000 + (h % 99999);
}

function buildContext(tenantId, restaurantName) {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const staffUserId = seedId(tenantId, "staff");
  const deviceId = seedId(tenantId, "device");
  const customerId = seedId(tenantId, "customer");
  const orderId = orderNum(tenantId);
  const paymentId = seedId(tenantId, "payment");
  const closureId = seedId(tenantId, "closure");
  const slug = String(tenantId).replace(/[^a-z0-9]/gi, "");

  return {
    tenantId,
    restaurantName: restaurantName || tenantId,
    now,
    today,
    staffUserId,
    deviceId,
    customerId,
    orderId,
    paymentId,
    closureId,
    slug,
    username: `demo.${slug}`,
  };
}

function isEmptyArray(v) {
  return !Array.isArray(v) || v.length === 0;
}

function isEmptyObject(v) {
  return !v || typeof v !== "object" || Object.keys(v).length === 0;
}

function countPayload(payload, kind) {
  if (payload == null) return 0;
  if (kind === "array") return Array.isArray(payload) ? payload.length : 0;
  if (kind === "menu") return Array.isArray(payload) ? payload.length : 0;
  if (kind === "records") return Array.isArray(payload?.records) ? payload.records.length : 0;
  if (kind === "requests") return Array.isArray(payload?.requests) ? payload.requests.length : 0;
  if (kind === "suppliers") return Array.isArray(payload?.suppliers) ? payload.suppliers.length : 0;
  if (kind === "recipes") return Array.isArray(payload?.recipes) ? payload.recipes.length : 0;
  if (kind === "dishes") return Array.isArray(payload?.dishes) ? payload.dishes.length : 0;
  if (kind === "devices") return Array.isArray(payload?.devices) ? payload.devices.length : 0;
  if (kind === "routes") return Array.isArray(payload?.routes) ? payload.routes.length : 0;
  if (kind === "tables") return Array.isArray(payload?.tables) ? payload.tables.length : 0;
  if (kind === "shifts") return Array.isArray(payload?.shifts) ? payload.shifts.length : 0;
  if (kind === "reports") return Array.isArray(payload?.reports) ? payload.reports.length : 0;
  if (kind === "entries") return Array.isArray(payload?.entries) ? payload.entries.length : 0;
  if (kind === "events") return Array.isArray(payload) ? payload.length : (Array.isArray(payload?.events) ? payload.events.length : 0);
  return isEmptyObject(payload) ? 0 : 1;
}

module.exports = {
  buildContext,
  seedId,
  orderNum,
  isEmptyArray,
  countPayload,
};
