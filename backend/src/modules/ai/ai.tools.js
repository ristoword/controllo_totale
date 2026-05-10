// backend/src/modules/ai/ai.tools.js
// High-level data-access helpers for the AI orchestrator.
// IMPORTANT: read-only helpers only. Never mutate core operational data here.

const ordersService          = require("../../service/orders.service");
const reportsService         = require("../../service/reports.service");
const inventoryRepository    = require("../../repositories/inventory.repository");
const menuRepository         = require("../../repositories/menu.repository");
const recipesRepository      = require("../../repositories/recipes.repository");
const dailyMenuRepository    = require("../../repositories/daily-menu.repository");
const bookingsRepository     = require("../../repositories/bookings.repository");
const suppliersRepository    = require("../../repositories/suppliers.repository");
const shiftsRepository       = require("../../repositories/shifts.repository");
const staffRepository        = require("../../repositories/staff.repository");
const closuresRepository     = require("../../repositories/closures.repository");

// ─── Orders ──────────────────────────────────────────────────────────────────

/** Aggregate summary (count by status) */
async function getActiveOrdersSummary() {
  const orders = await ordersService.listActiveOrders();
  const total = orders.length;
  const byStatus = {};
  for (const o of orders) {
    const s = String(o.status || "in_attesa").toLowerCase();
    byStatus[s] = (byStatus[s] || 0) + 1;
  }
  return { total, byStatus };
}

/** Full active orders list with items (for per-area filtering) */
async function getActiveOrdersWithItems() {
  const orders = await ordersService.listActiveOrders();
  return Array.isArray(orders) ? orders : [];
}

// ─── Sales & Reports ──────────────────────────────────────────────────────────

async function getTodaySalesSummary(date = new Date()) {
  const dashboard = await reportsService.buildDashboardSummary(date);
  return dashboard?.kpi || {};
}

/** Last 7 days of daily KPIs for trend analysis (archivio, supervisor) */
async function getRecentSalesHistory(days = 7) {
  const results = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    try {
      const rep = await reportsService.buildDailyReport(d).catch(() => null);
      if (rep) results.push({ date: d.toISOString().slice(0, 10), ...rep });
    } catch (_) {}
  }
  return results.reverse(); // oldest first
}

/** Top dishes today */
async function getTopDishes(date = new Date(), limit = 10) {
  try {
    return await reportsService.getTopDishes(date, limit);
  } catch {
    return [];
  }
}

// ─── Inventory ────────────────────────────────────────────────────────────────

async function getInventorySnapshot() {
  const all = await inventoryRepository.getAll();
  return Array.isArray(all) ? all : [];
}

async function getLowStockItems() {
  const inv = await getInventorySnapshot();
  return inv.filter((item) => {
    const qty = Number(item.quantity ?? item.central ?? item.stock ?? 0);
    const min = Number(item.threshold ?? item.min_stock ?? 0);
    return min > 0 && qty <= min;
  });
}

// ─── Menu ─────────────────────────────────────────────────────────────────────

async function getMenuItems() {
  return await menuRepository.getAll();
}

/** Returns only active menu items grouped by category */
async function getActiveMenuGrouped() {
  const all = await menuRepository.getAll();
  const items = Array.isArray(all) ? all.filter((i) => i.active !== false) : [];
  const grouped = {};
  for (const item of items) {
    const cat = item.category || "altro";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({ name: item.name, price: item.price, area: item.area });
  }
  return grouped;
}

// ─── Recipes ─────────────────────────────────────────────────────────────────

async function getRecipes() {
  return recipesRepository.getAllRecipes
    ? recipesRepository.getAllRecipes()
    : recipesRepository.getAll();
}

// ─── Daily Menu ───────────────────────────────────────────────────────────────

async function getDailyMenu() {
  try {
    const data = await dailyMenuRepository.getActive();
    return data || {};
  } catch {
    return {};
  }
}

// ─── Bookings ─────────────────────────────────────────────────────────────────

async function getBookingsToday(date = new Date()) {
  try {
    const all = await bookingsRepository.getAll();
    const target = date.toISOString().slice(0, 10);
    return all.filter((b) =>
      String(b.date || b.time || "").slice(0, 10) === target
    );
  } catch {
    return [];
  }
}

/** Bookings for the coming 7 days */
async function getUpcomingBookings(days = 7) {
  try {
    const all = await bookingsRepository.getAll();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() + days);
    return all.filter((b) => {
      const d = new Date(String(b.date || b.time || "").slice(0, 10) + "T12:00:00");
      return d >= today && d <= cutoff;
    });
  } catch {
    return [];
  }
}

// ─── Suppliers ────────────────────────────────────────────────────────────────

/** All suppliers with their last delivery and contact info */
async function getSuppliers() {
  try {
    const result = await suppliersRepository.list();
    return Array.isArray(result) ? result : (result?.suppliers ?? []);
  } catch {
    return [];
  }
}

// ─── Staff & Shifts ──────────────────────────────────────────────────────────

/** Active staff list (name, role) */
async function getStaffSummary() {
  try {
    const all = await staffRepository.getAll();
    return Array.isArray(all)
      ? all.filter((s) => s.active !== false).map((s) => ({
          id: s.id,
          name: s.name || s.username,
          role: s.role,
        }))
      : [];
  } catch {
    return [];
  }
}

/** Shifts for the current week (Mon–Sun) */
async function getShiftsThisWeek() {
  try {
    const today = new Date();
    const monday = new Date(today);
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const result = await shiftsRepository.getByDateRange(
      monday.toISOString().slice(0, 10),
      sunday.toISOString().slice(0, 10)
    );
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

// ─── Closures (historical reference) ─────────────────────────────────────────

/** Last N closure summaries for trend/archivio context */
async function getRecentClosures(limit = 14) {
  try {
    const all = await closuresRepository.getAll();
    if (!Array.isArray(all)) return [];
    return all
      .sort((a, b) => new Date(b.closedAt || b.date || 0) - new Date(a.closedAt || a.date || 0))
      .slice(0, limit);
  } catch {
    return [];
  }
}

module.exports = {
  getActiveOrdersSummary,
  getActiveOrdersWithItems,
  getTodaySalesSummary,
  getRecentSalesHistory,
  getTopDishes,
  getInventorySnapshot,
  getLowStockItems,
  getMenuItems,
  getActiveMenuGrouped,
  getRecipes,
  getDailyMenu,
  getBookingsToday,
  getUpcomingBookings,
  getSuppliers,
  getStaffSummary,
  getShiftsThisWeek,
  getRecentClosures,
};
