const ordersRepository = require("../repositories/orders.repository");
const paymentsRepository = require("../repositories/payments.repository");
const shiftsRepository = require("../repositories/shifts.repository");
const suppliersRepository = require("../repositories/suppliers.repository");
const archiveRepository = require("../repositories/archive.repository");

function toNumber(v, fb = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

function dayKeyFromTs(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function parseDay(s) {
  if (!s || typeof s !== "string") return null;
  const d = new Date(s.slice(0, 10) + "T12:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

function eachDay(fromStr, toStr, fn) {
  const a = parseDay(fromStr);
  const b = parseDay(toStr);
  if (!a || !b) return;
  const cur = new Date(a);
  const end = new Date(b);
  while (cur <= end) {
    fn(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
}

function isServedLike(order) {
  const s = String(order.status || "").toLowerCase();
  return s === "servito" || s === "chiuso";
}

/** Incassi e metriche per giorno (chiave YYYY-MM-DD) */
async function buildDailyMap(fromStr, toStr) {
  const payments = await paymentsRepository.listPayments({});
  const shifts = await shiftsRepository.getByDateRange(fromStr, toStr, {});
  const suppliers = await suppliersRepository.list();
  const store = await archiveRepository.readStore();
  const purchaseItems = store.purchaseIncoming || [];

  const map = {};

  function ensure(day) {
    if (!map[day]) {
      map[day] = {
        date: day,
        netRevenue: 0,
        gross: 0,
        paymentsCount: 0,
        coversClients: 0,
        staffDistinct: new Set(),
        expenseSuppliers: 0,
        expensePurchase: 0,
        expenseTotal: 0,
        staffOnDuty: 0,
      };
    }
    if (!map[day].staffDistinct) map[day].staffDistinct = new Set();
    return map[day];
  }

  for (const p of payments) {
    const day = dayKeyFromTs(p.closedAt || p.createdAt);
    if (!day || day < fromStr || day > toStr) continue;
    const row = ensure(day);
    row.netRevenue += toNumber(p.total, 0);
    row.gross += toNumber(p.subtotal, 0);
    row.paymentsCount += 1;
    row.coversClients += toNumber(p.covers, 0);
  }

  for (const sh of shifts) {
    const day = String(sh.date || "").slice(0, 10);
    if (!day || day < fromStr || day > toStr) continue;
    if (sh.staffId) ensure(day).staffDistinct.add(String(sh.staffId));
  }

  for (const sup of suppliers || []) {
    for (const inv of sup.invoices || []) {
      const day = String(inv.issueDate || "").slice(0, 10);
      if (!day || day < fromStr || day > toStr) continue;
      const row = ensure(day);
      const amt = toNumber(inv.amount, 0);
      row.expenseSuppliers += amt;
    }
  }

  for (const pi of purchaseItems) {
    const day = String(pi.issueDate || "").slice(0, 10);
    if (!day || day < fromStr || day > toStr) continue;
    const row = ensure(day);
    const amt = toNumber(pi.total, toNumber(pi.amount, 0));
    row.expensePurchase += amt;
  }

  eachDay(fromStr, toStr, (day) => {
    const row = ensure(day);
    row.expenseTotal = row.expenseSuppliers + row.expensePurchase;
    row.staffOnDuty = row.staffDistinct.size;
    delete row.staffDistinct;
  });

  return map;
}

function rollupDays(dailyMap, mode) {
  const buckets = {};
  for (const row of Object.values(dailyMap)) {
    const d = row.date;
    let key;
    if (mode === "year") key = d.slice(0, 4);
    else if (mode === "month") key = d.slice(0, 7);
    else key = d;

    if (!buckets[key]) {
      buckets[key] = {
        key,
        netRevenue: 0,
        gross: 0,
        paymentsCount: 0,
        coversClients: 0,
        staffOnDutyMax: 0,
        expenseTotal: 0,
        days: 0,
      };
    }
    const b = buckets[key];
    b.netRevenue += row.netRevenue;
    b.gross += row.gross;
    b.paymentsCount += row.paymentsCount;
    b.coversClients += row.coversClients;
    b.staffOnDutyMax = Math.max(b.staffOnDutyMax, row.staffOnDuty || 0);
    b.expenseTotal += row.expenseTotal;
    b.days += 1;
  }

  return Object.values(buckets).sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Confronto stesso giorno del mese tra due anni (incasso netto).
 * Usa il minimo dei giorni del mese nei due anni (es. febbraio bisesto).
 */
function compareMonthByYears(yearA, yearB, month1to12) {
  const m = String(month1to12).padStart(2, "0");
  const dim = Math.min(
    new Date(Number(yearA), month1to12, 0).getDate(),
    new Date(Number(yearB), month1to12, 0).getDate()
  );
  const rows = [];
  for (let dom = 1; dom <= dim; dom++) {
    const dd = String(dom).padStart(2, "0");
    rows.push({
      dayOfMonth: dom,
      dateA: `${yearA}-${m}-${dd}`,
      dateB: `${yearB}-${m}-${dd}`,
    });
  }
  return rows;
}

async function getFinancialSeries({ from, to, groupBy }) {
  const dailyMap = await buildDailyMap(from, to);
  const daily = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

  if (groupBy === "day" || !groupBy) {
    return { groupBy: "day", series: daily };
  }
  if (groupBy === "month" || groupBy === "year") {
    return { groupBy, series: rollupDays(dailyMap, groupBy) };
  }
  return { groupBy: "day", series: daily };
}

async function getCompareMonth({ yearA, yearB, month }) {
  const m = Number(month);
  const yA = String(yearA);
  const yB = String(yearB);
  const fromA = `${yA}-${String(m).padStart(2, "0")}-01`;
  const toA = `${yA}-${String(m).padStart(2, "0")}-${String(new Date(Number(yA), m, 0).getDate()).padStart(2, "0")}`;
  const fromB = `${yB}-${String(m).padStart(2, "0")}-01`;
  const toB = `${yB}-${String(m).padStart(2, "0")}-${String(new Date(Number(yB), m, 0).getDate()).padStart(2, "0")}`;

  const mapA = await buildDailyMap(fromA, toA);
  const mapB = await buildDailyMap(fromB, toB);
  const skeleton = compareMonthByYears(yA, yB, m);

  const rows = skeleton.map(({ dayOfMonth, dateA, dateB }) => {
    const a = mapA[dateA] || null;
    const b = mapB[dateB] || null;
    return {
      dayOfMonth,
      dateA,
      dateB,
      netRevenueA: a ? a.netRevenue : 0,
      netRevenueB: b ? b.netRevenue : 0,
      coversA: a ? a.coversClients : 0,
      coversB: b ? b.coversClients : 0,
      staffA: a ? a.staffOnDuty : 0,
      staffB: b ? b.staffOnDuty : 0,
    };
  });

  return { month: m, yearA: yA, yearB: yB, rows };
}

async function listServedOrders({ from, to, limit = 500, offset = 0 }) {
  const store = await archiveRepository.readStore();
  const excluded = new Set((store.excludedOrderIds || []).map(String));
  const all = await ordersRepository.getAllOrders();

  let list = all.filter((o) => {
    if (excluded.has(String(o.id))) return false;
    if (!isServedLike(o)) return false;
    const day = dayKeyFromTs(o.updatedAt || o.createdAt);
    if (!day) return false;
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  });

  list.sort((a, b) => {
    const ta = new Date(b.updatedAt || b.createdAt || 0).getTime();
    const tb = new Date(a.updatedAt || a.createdAt || 0).getTime();
    return ta - tb;
  });

  const total = list.length;
  list = list.slice(offset, offset + limit);

  return {
    total,
    orders: list.map((o) => ({
      id: o.id,
      table: o.table,
      area: o.area,
      status: o.status,
      covers: o.covers,
      waiter: o.waiter,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      itemsPreview: Array.isArray(o.items)
        ? o.items.slice(0, 8).map((it) => ({ name: it.name, qty: it.qty, price: it.price }))
        : [],
    })),
  };
}

async function hideOrderFromArchive(orderId) {
  const store = await archiveRepository.readStore();
  const id = String(orderId);
  if (!store.excludedOrderIds.includes(id)) store.excludedOrderIds.push(id);
  await archiveRepository.writeStore(store);
  return { ok: true };
}

async function unhideOrderFromArchive(orderId) {
  const store = await archiveRepository.readStore();
  const id = String(orderId);
  store.excludedOrderIds = (store.excludedOrderIds || []).filter((x) => String(x) !== id);
  await archiveRepository.writeStore(store);
  return { ok: true };
}

async function addCassaInvoice(payload) {
  const store = await archiveRepository.readStore();
  const inv = {
    id: archiveRepository.createId("cinv"),
    number: String(payload.number || ""),
    date: String(payload.date || "").slice(0, 10),
    table: payload.table != null ? payload.table : null,
    clientName: String(payload.clientName || ""),
    total: toNumber(payload.total, 0),
    syncedAt: new Date().toISOString(),
  };
  store.cassaOutgoingInvoices = store.cassaOutgoingInvoices || [];
  store.cassaOutgoingInvoices.push(inv);
  await archiveRepository.writeStore(store);
  return inv;
}

async function listCassaInvoices() {
  const store = await archiveRepository.readStore();
  return [...(store.cassaOutgoingInvoices || [])].sort(
    (a, b) => String(b.date).localeCompare(String(a.date)) || String(b.number).localeCompare(String(a.number))
  );
}

async function syncCassaInvoicesBulk(list) {
  const store = await archiveRepository.readStore();
  const incoming = Array.isArray(list) ? list : [];
  const byKey = new Map();
  for (const x of store.cassaOutgoingInvoices || []) {
    byKey.set(`${x.number}|${x.date}`, x);
  }
  for (const raw of incoming) {
    const k = `${String(raw.number || "")}|${String(raw.date || "").slice(0, 10)}`;
    if (!raw.number && !raw.date) continue;
    if (byKey.has(k)) continue;
    byKey.set(
      k,
      {
        id: archiveRepository.createId("cinv"),
        number: String(raw.number || ""),
        date: String(raw.date || "").slice(0, 10),
        table: raw.table != null ? raw.table : null,
        clientName: String(raw.clientName || ""),
        total: toNumber(raw.total, 0),
        syncedAt: new Date().toISOString(),
      }
    );
  }
  store.cassaOutgoingInvoices = [...byKey.values()];
  await archiveRepository.writeStore(store);
  return { merged: store.cassaOutgoingInvoices.length };
}

async function addPurchaseIncoming(body, fileBuffer, fileExt) {
  const store = await archiveRepository.readStore();
  const id = archiveRepository.createId("pin");
  let attachmentPath = null;
  if (fileBuffer && Buffer.isBuffer(fileBuffer) && fileBuffer.length) {
    attachmentPath = await archiveRepository.saveAttachmentBuffer(id, fileBuffer, fileExt);
  }
  const row = {
    id,
    supplierName: String(body.supplierName || "").trim(),
    invoiceNumber: String(body.invoiceNumber || "").trim(),
    issueDate: String(body.issueDate || "").slice(0, 10),
    amount: toNumber(body.amount, 0),
    vatAmount: toNumber(body.vatAmount, 0),
    total: toNumber(body.total, toNumber(body.amount, 0) + toNumber(body.vatAmount, 0)),
    notes: String(body.notes || "").trim(),
    attachmentPath,
    createdAt: new Date().toISOString(),
  };
  store.purchaseIncoming.push(row);
  await archiveRepository.writeStore(store);
  return row;
}

async function listPurchaseIncoming() {
  const store = await archiveRepository.readStore();
  return [...(store.purchaseIncoming || [])].sort((a, b) =>
    String(b.issueDate).localeCompare(String(a.issueDate))
  );
}

async function removePurchaseIncoming(id) {
  const store = await archiveRepository.readStore();
  const before = store.purchaseIncoming.length;
  store.purchaseIncoming = store.purchaseIncoming.filter((x) => String(x.id) !== String(id));
  await archiveRepository.writeStore(store);
  return { ok: store.purchaseIncoming.length < before };
}

module.exports = {
  buildDailyMap,
  getFinancialSeries,
  getCompareMonth,
  listServedOrders,
  hideOrderFromArchive,
  unhideOrderFromArchive,
  addCassaInvoice,
  listCassaInvoices,
  syncCassaInvoicesBulk,
  addPurchaseIncoming,
  listPurchaseIncoming,
  removePurchaseIncoming,
};
