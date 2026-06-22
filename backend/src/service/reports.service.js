const ordersRepository = require("../repositories/orders.repository");
const paymentsRepository = require("../repositories/payments.repository");
const reportsRepository = require("../repositories/reports.repository");
const closuresRepository = require("../repositories/closures.repository");
const orderFoodCostsRepository = require("../repositories/order-food-costs.repository");
const recipesRepository = require("../repositories/recipes.repository");
const paymentsService = require("./payments.service");
const inventoryService = require("./inventory.service");

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function isSameDay(dateValue, targetDate) {
  const d = normalizeDate(dateValue);
  const t = normalizeDate(targetDate);
  if (!d || !t) return false;

  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  );
}

function getOrderTotal(order = {}) {
  const items = Array.isArray(order.items) ? order.items : [];
  return items.reduce((acc, item) => {
    const price = toNumber(item.price, 0);
    const qty = toNumber(item.qty, 1);
    return acc + price * qty;
  }, 0);
}

function getPaymentDate(payment) {
  return payment.closedAt || payment.createdAt || null;
}

function summarizeOrders(orders = []) {
  const summary = {
    totalOrders: orders.length,
    openOrders: 0,
    servedOrders: 0,
    closedOrders: 0,
    totalCoversEstimated: 0,
    totalOrderValueEstimated: 0,
    tablesWorked: 0,
    topItems: []
  };

  const tableSet = new Set();
  const itemMap = new Map();

  for (const order of orders) {
    const status = String(order.status || "").toLowerCase();
    const table = order.table != null ? String(order.table) : "-";
    const covers = toNumber(order.covers, 0);
    const items = Array.isArray(order.items) ? order.items : [];

    summary.totalCoversEstimated += covers;
    summary.totalOrderValueEstimated += getOrderTotal(order);

    if (table) tableSet.add(table);

    if (status === "chiuso") summary.closedOrders += 1;
    else if (status === "servito") summary.servedOrders += 1;
    else summary.openOrders += 1;

    for (const item of items) {
      const name = String(item.name || "Senza nome").trim();
      const qty = toNumber(item.qty, 1);
      const revenue = toNumber(item.price, 0) * qty;

      if (!itemMap.has(name)) {
        itemMap.set(name, {
          name,
          qty: 0,
          revenue: 0
        });
      }

      const current = itemMap.get(name);
      current.qty += qty;
      current.revenue += revenue;
    }
  }

  summary.tablesWorked = tableSet.size;
  summary.topItems = [...itemMap.values()]
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  return summary;
}

function summarizePayments(payments = []) {
  const summary = {
    totalPayments: payments.length,
    gross: 0,
    discountAmount: 0,
    vatAmount: 0,
    net: 0,
    covers: 0,
    averageReceipt: 0,
    byMethod: {}
  };

  for (const payment of payments) {
    const subtotal = toNumber(payment.subtotal, 0);
    const discountAmount = toNumber(payment.discountAmount, 0);
    const vatAmount = toNumber(payment.vatAmount, 0);
    const total = toNumber(payment.total, 0);
    const covers = toNumber(payment.covers, 0);
    const method = String(payment.paymentMethod || "unknown").trim().toLowerCase();

    summary.gross += subtotal;
    summary.discountAmount += discountAmount;
    summary.vatAmount += vatAmount;
    summary.net += total;
    summary.covers += covers;

    if (!summary.byMethod[method]) {
      summary.byMethod[method] = {
        count: 0,
        total: 0
      };
    }

    summary.byMethod[method].count += 1;
    summary.byMethod[method].total += total;
  }

  summary.averageReceipt =
    summary.totalPayments > 0 ? summary.net / summary.totalPayments : 0;

  return summary;
}

async function buildDailyReport(targetDate = new Date()) {
  const { orders: dailyOrders, payments: dailyPayments } = await reportsRepository.getDailyData(targetDate);

  const ordersSummary = summarizeOrders(dailyOrders);
  const paymentsSummary = summarizePayments(dailyPayments);

  return {
    date: new Date(targetDate).toISOString(),
    orders: ordersSummary,
    payments: paymentsSummary,
    kpi: {
      openOrders: ordersSummary.openOrders,
      servedOrders: ordersSummary.servedOrders,
      closedOrders: ordersSummary.closedOrders,
      tablesWorked: ordersSummary.tablesWorked,
      estimatedOrderValue: ordersSummary.totalOrderValueEstimated,
      grossRevenue: paymentsSummary.gross,
      netRevenue: paymentsSummary.net,
      discounts: paymentsSummary.discountAmount,
      vat: paymentsSummary.vatAmount,
      covers: paymentsSummary.covers,
      averageReceipt: paymentsSummary.averageReceipt
    }
  };
}

/**
 * Dashboard summary: aggregates daily report, current shift, ready orders, alerts.
 * Used by dashboard frontend for live operational control.
 */
async function buildDashboardSummary(targetDate = new Date()) {
  const date = normalizeDate(targetDate) || new Date();
  const dateStr = date.toISOString().slice(0, 10);

  const [dailyReport, cashStatus, dayClosed] = await Promise.all([
    buildDailyReport(date),
    paymentsService.getCurrentShift(),
    closuresRepository.isDayClosed(dateStr),
  ]);

  const allOrders = await ordersRepository.getAllOrders();
  const dailyOrders = allOrders.filter((o) =>
    isSameDay(o.updatedAt || o.createdAt, date)
  );

  const readyOrdersCount = dailyOrders.filter(
    (o) => String(o.status || "").toLowerCase() === "pronto"
  ).length;

  const ordersInPreparationCount = dailyOrders.filter((o) => {
    const s = String(o.status || "").toLowerCase();
    return ["in_attesa", "in_preparazione"].includes(s);
  }).length;

  const openTablesSet = new Set();
  dailyOrders.forEach((o) => {
    const s = String(o.status || "").toLowerCase();
    if (!["chiuso", "annullato"].includes(s)) {
      openTablesSet.add(String(o.table != null ? o.table : "-"));
    }
  });
  const openTablesCount = openTablesSet.size;

  const lateOrdersCount = dailyOrders.filter((o) => {
    const status = String(o.status || "").toLowerCase();
    if (["pronto", "servito", "chiuso", "annullato"].includes(status)) return false;
    const ts = o.updatedAt || o.createdAt;
    if (!ts) return false;
    const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    return mins >= 15;
  }).length;

  const inventoryLowStockCount = await inventoryService.getLowStockCount();
  const totalFoodCostToday = await orderFoodCostsRepository.getTotalFoodCostForDate(date);

  const topItems = dailyReport.orders?.topItems || [];
  const topProfitableItems = [];
  for (const item of topItems.slice(0, 5)) {
    const name = item.name || "";
    const revenue = toNumber(item.revenue, 0);
    const qty = toNumber(item.qty, 1);
    const recipe = await recipesRepository.getByMenuItemName(name);
    const foodCost = recipe ? await inventoryService.calculateRecipeIngredientCost(recipe, qty) : 0;
    topProfitableItems.push({
      name,
      revenue,
      foodCost,
      margin: revenue - foodCost,
      qty,
    });
  }

  const alerts = [];
  if (dayClosed) alerts.push({ id: "day_closed", type: "info", message: "Giornata chiusa con Z" });
  if (!cashStatus.hasOpenShift && !dayClosed) alerts.push({ id: "cash_closed", type: "warn", message: "Cassa chiusa" });
  if (lateOrdersCount > 0) alerts.push({ id: "orders_late", type: "warn", message: `${lateOrdersCount} ordine/i in ritardo` });
  if (readyOrdersCount > 0) alerts.push({ id: "ready_pickup", type: "info", message: `${readyOrdersCount} ordine/i pronti da ritirare` });
  if (inventoryLowStockCount > 0) alerts.push({ id: "inventory_low", type: "warn", message: `${inventoryLowStockCount} ingrediente/i sotto scorta minima` });

  return {
    date: date.toISOString(),
    dayClosed,
    kpi: {
      ...dailyReport.kpi,
      readyOrdersCount,
      ordersInPreparationCount,
      openTablesCount,
      lateOrdersCount,
      inventoryLowStockCount,
      totalFoodCostToday,
    },
    paymentsByMethod: dailyReport.payments?.byMethod || {},
    topProfitableItems,
    cash: {
      hasOpenShift: cashStatus.hasOpenShift,
      shift: cashStatus.shift || null,
    },
    alerts,
  };
}

/**
 * Report per commercialista: totali giornalieri, breakdown metodi pagamento,
 * conteggio transazioni, chiusure con operatore.
 */
async function buildAccountantReport(dateFrom, dateTo) {
  const from = normalizeDate(dateFrom) || new Date();
  const to = normalizeDate(dateTo) || new Date();
  if (!from || !to || from > to) {
    return { error: "Date non valide", dateFrom: from, dateTo: to };
  }

  const allPayments = await paymentsRepository.listPayments({});
  const allOrders = await ordersRepository.getAllOrders();
  const closures = await closuresRepository.listClosures({
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: to.toISOString().slice(0, 10),
  });

  const days = [];
  let d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);

  while (d <= end) {
    const dayStr = d.toISOString().slice(0, 10);
    const dailyPayments = allPayments.filter((p) =>
      isSameDay(getPaymentDate(p), d)
    );
    const dailyOrders = allOrders.filter((o) =>
      isSameDay(o.updatedAt || o.createdAt, d)
    );
    const closedOrders = dailyOrders.filter(
      (o) => String(o.status || "").toLowerCase() === "chiuso"
    );

    const paySummary = summarizePayments(dailyPayments);
    const closure = closures.find((c) => String(c.date || "").slice(0, 10) === dayStr);

    days.push({
      date: dayStr,
      totals: {
        gross: paySummary.gross,
        net: paySummary.net,
        discounts: paySummary.discountAmount,
        vat: paySummary.vatAmount,
        covers: paySummary.covers,
      },
      paymentMethodsBreakdown: paySummary.byMethod,
      transactionCount: paySummary.totalPayments,
      closedOrdersCount: closedOrders.length,
      closure: closure
        ? {
            closedAt: closure.closedAt,
            closedBy: closure.closedBy,
            grandTotal: closure.grandTotal,
            notes: closure.notes,
          }
        : null,
    });

    d.setDate(d.getDate() + 1);
  }

  const grandTotals = days.reduce(
    (acc, day) => {
      acc.gross += day.totals.gross;
      acc.net += day.totals.net;
      acc.discounts += day.totals.discounts;
      acc.vat += day.totals.vat;
      acc.covers += day.totals.covers;
      acc.transactionCount += day.transactionCount;
      acc.closedOrdersCount += day.closedOrdersCount;
      acc.closedDaysCount += day.closure ? 1 : 0;
      return acc;
    },
    {
      gross: 0,
      net: 0,
      discounts: 0,
      vat: 0,
      covers: 0,
      transactionCount: 0,
      closedOrdersCount: 0,
      closedDaysCount: 0,
    }
  );

  const byMethodAggregated = {};
  for (const day of days) {
    for (const [method, data] of Object.entries(day.paymentMethodsBreakdown || {})) {
      if (!byMethodAggregated[method]) {
        byMethodAggregated[method] = { count: 0, total: 0 };
      }
      byMethodAggregated[method].count += data.count;
      byMethodAggregated[method].total += data.total;
    }
  }

  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: to.toISOString().slice(0, 10),
    generatedAt: new Date().toISOString(),
    grandTotals,
    paymentMethodsBreakdown: byMethodAggregated,
    days,
    closuresSummary: days
      .filter((d) => d.closure)
      .map((d) => ({
        date: d.date,
        closedBy: d.closure.closedBy,
        closedAt: d.closure.closedAt,
        grandTotal: d.closure.grandTotal,
      })),
  };
}

/**
 * Top dishes by quantity sold (and revenue). Uses real order data for the date.
 */
async function getTopDishes(targetDate = new Date(), limit = 10) {
  const date = normalizeDate(targetDate) || new Date();
  const dateStr = date.toISOString().slice(0, 10);
  const allOrders = await ordersRepository.getAllOrders();
  const dailyOrders = allOrders.filter((o) =>
    isSameDay(o.updatedAt || o.createdAt, date)
  );
  const closedOrServed = dailyOrders.filter((o) => {
    const s = String(o.status || "").toLowerCase();
    return s === "chiuso" || s === "servito";
  });
  const itemMap = new Map();
  for (const order of closedOrServed) {
    for (const item of order.items || []) {
      const name = String(item.name || "Senza nome").trim();
      const qty = toNumber(item.qty, 1);
      const revenue = toNumber(item.price, 0) * qty;
      if (!itemMap.has(name)) {
        itemMap.set(name, { name, qty: 0, revenue: 0 });
      }
      const row = itemMap.get(name);
      row.qty += qty;
      row.revenue += revenue;
    }
  }
  const list = [...itemMap.values()].sort((a, b) => b.qty - a.qty).slice(0, limit);
  return { date: dateStr, topDishes: list };
}

/**
 * Per-dish margins: revenue, cost of goods sold, gross margin, food cost %.
 * Uses recipe + inventory cost for COGS.
 */
async function getDishMargins(targetDate = new Date()) {
  const date = normalizeDate(targetDate) || new Date();
  const dateStr = date.toISOString().slice(0, 10);
  const allOrders = await ordersRepository.getAllOrders();
  const dailyOrders = allOrders.filter((o) =>
    isSameDay(o.updatedAt || o.createdAt, date)
  );
  const closedOrServed = dailyOrders.filter((o) => {
    const s = String(o.status || "").toLowerCase();
    return s === "chiuso" || s === "servito";
  });
  const dishMap = new Map();
  for (const order of closedOrServed) {
    for (const item of order.items || []) {
      const name = String(item.name || "Senza nome").trim();
      const qty = toNumber(item.qty, 1);
      const revenue = toNumber(item.price, 0) * qty;
      const recipe = await recipesRepository.findRecipeByMenuItemName(name);
      const cogs = recipe ? await inventoryService.calculateRecipeIngredientCost(recipe, qty) : 0;
      const margin = revenue - cogs;
      const foodCostPercent = revenue > 0 && cogs > 0 ? (cogs / revenue) * 100 : null;
      if (!dishMap.has(name)) {
        dishMap.set(name, { name, revenue: 0, costOfGoodsSold: 0, grossMargin: 0, qty: 0 });
      }
      const row = dishMap.get(name);
      row.revenue += revenue;
      row.costOfGoodsSold += cogs;
      row.grossMargin += margin;
      row.qty += qty;
    }
  }
  const list = [...dishMap.values()].map((r) => ({
    ...r,
    foodCostPercent:
      r.revenue > 0 && r.costOfGoodsSold > 0
        ? Math.round((r.costOfGoodsSold / r.revenue) * 10000) / 100
        : null,
  }));
  const totalRevenue = list.reduce((s, r) => s + r.revenue, 0);
  const totalCogs = list.reduce((s, r) => s + r.costOfGoodsSold, 0);
  const averageMarginPercent =
    totalRevenue > 0 ? Math.round(((totalRevenue - totalCogs) / totalRevenue) * 10000) / 100 : 0;
  return {
    date: dateStr,
    dishes: list.sort((a, b) => b.grossMargin - a.grossMargin),
    summary: { totalRevenue, totalCogs, averageMarginPercent },
  };
}

/**
 * Food cost alerts: recipes where actual food cost % exceeds target or is above threshold.
 */
async function getFoodCostAlerts(thresholdPercent = 35) {
  const recipes = await recipesRepository.getAll();
  const inventoryRepository = require("../repositories/inventory.repository");
  const alerts = [];
  for (const recipe of recipes) {
    const fc = await recipesRepository.getFoodCost(recipe.id, inventoryRepository);
    if (!fc || fc.foodCostPercent == null) continue;
    const target = Number(recipe.targetFoodCost ?? recipe.target_food_cost) || 30;
    if (fc.foodCostPercent > thresholdPercent || fc.foodCostPercent > target) {
      alerts.push({
        recipeId: recipe.id,
        recipeName: recipe.name || recipe.menuItemName,
        foodCostPercent: fc.foodCostPercent,
        targetFoodCostPercent: target,
        costPerPortion: fc.costPerPortion,
        sellingPrice: recipe.sellingPrice ?? recipe.selling_price,
        suggestedPrice: fc.suggestedPrice,
      });
    }
  }
  return { alerts: alerts.sort((a, b) => (b.foodCostPercent || 0) - (a.foodCostPercent || 0)) };
}

/**
 * Revenue trends: today / 7d / 30d with deltas vs previous period + simple forecasts.
 */
async function buildTrends() {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const allPayments = await paymentsRepository.listPayments({});
  const allOrders = await ordersRepository.getAllOrders();

  function dayRevenue(dateStr) {
    return allPayments
      .filter((p) => {
        const d = getPaymentDate(p);
        return d && new Date(d).toISOString().slice(0, 10) === dateStr;
      })
      .reduce((s, p) => s + toNumber(p.total, 0), 0);
  }

  function dayCovers(dateStr) {
    return allPayments
      .filter((p) => {
        const d = getPaymentDate(p);
        return d && new Date(d).toISOString().slice(0, 10) === dateStr;
      })
      .reduce((s, p) => s + toNumber(p.covers, 0), 0);
  }

  function dayOrderCount(dateStr) {
    return allOrders.filter((o) => {
      const d = o.updatedAt || o.createdAt;
      return d && new Date(d).toISOString().slice(0, 10) === dateStr;
    }).length;
  }

  function rangeRevenue(days) {
    let total = 0;
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      total += dayRevenue(d.toISOString().slice(0, 10));
    }
    return total;
  }

  function prevRangeRevenue(days) {
    let total = 0;
    for (let i = days; i < days * 2; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      total += dayRevenue(d.toISOString().slice(0, 10));
    }
    return total;
  }

  function delta(current, previous) {
    if (!previous || previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 10000) / 100;
  }

  function buildDayHistory(days) {
    const history = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      history.push({
        date: ds,
        revenue: dayRevenue(ds),
        covers: dayCovers(ds),
        orders: dayOrderCount(ds),
      });
    }
    return history;
  }

  function simpleForecast(history, futureDays) {
    const revs = history.map((h) => h.revenue);
    const daysWithData = revs.filter((r) => r > 0).length;
    if (revs.length === 0) return { revenue: 0, dailyAvg: 0, confidence: "low", confidenceNum: 0 };
    const avg = revs.reduce((a, b) => a + b, 0) / revs.length;
    const variance = revs.reduce((a, r) => a + Math.pow(r - avg, 2), 0) / revs.length;
    const stddev = Math.sqrt(variance);
    const confNum = avg > 0 ? Math.max(0.3, Math.min(0.95, 1 - stddev / avg)) : 0;
    const confidence = daysWithData >= 20 ? "high" : daysWithData >= 7 ? "medium" : "low";
    return {
      revenue: Math.round(avg * futureDays * 100) / 100,
      dailyAvg: Math.round(avg * 100) / 100,
      confidence,
      confidenceNum: Math.round(confNum * 100) / 100,
    };
  }

  const todayRev = dayRevenue(todayStr);
  const yesterdayStr = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  const yesterdayRev = dayRevenue(yesterdayStr);

  const week = rangeRevenue(7);
  const prevWeek = prevRangeRevenue(7);
  const month = rangeRevenue(30);
  const prevMonth = prevRangeRevenue(30);

  const history7d = buildDayHistory(7);
  const history30d = buildDayHistory(30);

  const todayCovers = dayCovers(todayStr);
  const todayOrders = dayOrderCount(todayStr);

  const totalCogs = await orderFoodCostsRepository.getTotalFoodCostForDate(now);
  const margin = todayRev - totalCogs;
  const marginPercent = todayRev > 0 ? Math.round((margin / todayRev) * 10000) / 100 : 0;

  return {
    today: {
      revenue: todayRev,
      covers: todayCovers,
      orders: todayOrders,
      cogs: totalCogs,
      margin,
      marginPercent,
      deltaVsYesterday: delta(todayRev, yesterdayRev),
    },
    week: {
      revenue: week,
      deltaVsPrevWeek: delta(week, prevWeek),
    },
    month: {
      revenue: month,
      deltaVsPrevMonth: delta(month, prevMonth),
    },
    forecast7d: simpleForecast(history7d, 7),
    forecast30d: simpleForecast(history30d, 30),
    history7d,
    history30d,
    generatedAt: now.toISOString(),
  };
}

/**
 * Unified cross-module snapshot: orders, payments, stock, staff, revenue in one view.
 */
async function buildUnifiedReport(dateFrom, dateTo) {
  const from = normalizeDate(dateFrom) || new Date();
  const to = normalizeDate(dateTo) || new Date();

  const [accountant, topDishes, dishMargins, fcAlerts] = await Promise.all([
    buildAccountantReport(from, to),
    getTopDishes(to),
    getDishMargins(to),
    getFoodCostAlerts(35),
  ]);

  let inventoryValue = 0;
  let lowStockCount = 0;
  try {
    inventoryValue = await inventoryService.getTotalInventoryValue();
    lowStockCount = await inventoryService.getLowStockCount();
  } catch (_) {}

  return {
    period: {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    },
    financial: accountant.grandTotals || {},
    paymentMethods: accountant.paymentMethodsBreakdown || {},
    topDishes: topDishes.topDishes || [],
    dishMargins: dishMargins.summary || {},
    foodCostAlerts: (fcAlerts.alerts || []).length,
    inventory: {
      totalValue: inventoryValue,
      lowStockItems: lowStockCount,
    },
    days: accountant.days || [],
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  buildDailyReport,
  buildDashboardSummary,
  buildAccountantReport,
  buildTrends,
  buildUnifiedReport,
  summarizeOrders,
  summarizePayments,
  getTopDishes,
  getDishMargins,
  getFoodCostAlerts,
};