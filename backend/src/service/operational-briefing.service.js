const aiAssistantService = require("./ai-assistant.service");
const bookingsRepository = require("../repositories/bookings.repository");
const staffRepository = require("../repositories/staff.repository");
const inventoryRepository = require("../repositories/inventory.repository");
const ordersService = require("./orders.service");
const attendanceRepository = require("../repositories/attendance.repository");
const tenantContext = require("../context/tenantContext");

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isToday(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

function staffDisplayName(s) {
  if (!s) return "—";
  if (s.name) return s.name;
  const parts = [s.personal?.name, s.personal?.surname].filter(Boolean);
  return parts.length ? parts.join(" ") : s.username || "—";
}

function staffRoleLabel(s) {
  if (!s) return "";
  return s.role || s.work?.role || s.department || s.work?.department || "";
}

function resolveStaffOnDuty(staff, attendance) {
  const day = attendanceRepository.dateOnly(new Date().toISOString());
  const byUserId = new Map();
  const byId = new Map();
  for (const s of staff || []) {
    if (s.id) byId.set(String(s.id), s);
    if (s.userId) byUserId.set(String(s.userId), s);
  }

  const items = [];
  const seen = new Set();

  const openShifts = (attendance || []).filter(
    (r) => !r.clockOutAt && attendanceRepository.dateOnly(r.clockInAt || r.date) === day
  );

  for (const shift of openShifts) {
    const uid = String(shift.userId || "");
    const member = byUserId.get(uid) || byId.get(uid);
    const name = shift.userName || staffDisplayName(member) || uid || "—";
    const role = staffRoleLabel(member);
    const key = uid || name;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ name, role });
  }

  for (const s of (staff || []).filter((m) => m.active !== false && m.onShift === true)) {
    const name = staffDisplayName(s);
    const key = String(s.id || name);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ name, role: staffRoleLabel(s) });
  }

  return items;
}

function countPlannedShifts(staff, day) {
  let n = 0;
  for (const s of staff || []) {
    const assigned = Array.isArray(s.shifts?.assigned) ? s.shifts.assigned : [];
    for (const sh of assigned) {
      const d = String(sh.date || sh.day || sh.start || "").slice(0, 10);
      if (d === day) n += 1;
    }
  }
  return n;
}

function isCompletedStatus(status) {
  const s = String(status || "").toLowerCase().trim();
  return ["chiuso", "closed", "pagato", "paid", "archived"].includes(s);
}

function isItemDone(it) {
  const s = String(it?.status || it?.state || "").toLowerCase().trim();
  return ["servito", "served", "annullato", "cancelled"].includes(s);
}

function extractPrepItems(activeOrders) {
  const items = [];
  for (const o of activeOrders || []) {
    const table = o.table || o.tableNumber || o.tableId || "—";
    for (const it of o.items || []) {
      if (isItemDone(it)) continue;
      items.push({
        name: it.name || "—",
        qty: Number(it.qty) || 1,
        table: String(table),
        area: String(o.area || "sala").toLowerCase(),
        orderId: o.id,
      });
    }
  }
  return items.slice(0, 40);
}

function groupOrdersByArea(activeOrders) {
  const map = {};
  for (const o of activeOrders || []) {
    const area = String(o.area || "sala").toLowerCase();
    map[area] = (map[area] || 0) + 1;
  }
  return Object.entries(map)
    .map(([area, count]) => ({ area, count }))
    .sort((a, b) => b.count - a.count);
}

function buildTaskItems(lowStock, lateCount) {
  const items = lowStock.slice(0, 8).map((i) => ({
    type: "stock",
    text: `${i.name} — ${i.qty}/${i.threshold}`,
  }));
  if (lateCount > 0) {
    items.unshift({ type: "late", text: `${lateCount} ordini in ritardo` });
  }
  return items;
}

async function buildBriefing() {
  const day = todayStr();
  const restaurantId = tenantContext.getRestaurantId();

  const [status, bookings, staff, inventory, activeOrders, todayOrders, attendance] =
    await Promise.all([
      aiAssistantService.getOperationalStatus(),
      bookingsRepository.getAll().catch(() => []),
      staffRepository.getAll().catch(() => []),
      inventoryRepository.getAll().catch(() => []),
      ordersService.listActiveOrders().catch(() => []),
      ordersService.listOrdersByDate(day).catch(() => []),
      restaurantId
        ? attendanceRepository.readAttendance(restaurantId).catch(() => [])
        : Promise.resolve([]),
    ]);

  const todayBookings = (bookings || []).filter((b) => isToday(b.date || b.datetime || b.createdAt));
  const coversBooked = todayBookings.reduce((s, b) => s + (Number(b.covers || b.guests || 0) || 0), 0);
  const staffOnDuty = resolveStaffOnDuty(staff, attendance);
  const plannedShifts = countPlannedShifts(staff, day);
  const lowStock = (inventory || []).filter((i) => {
    const qty = Number(i.quantity ?? i.central ?? i.stock ?? 0);
    const min = Number(i.threshold ?? i.min_stock ?? 0);
    return min > 0 && qty <= min;
  });
  const completedToday = (todayOrders || []).filter((o) => isCompletedStatus(o.status));
  const prepItems = extractPrepItems(activeOrders);
  const ordersByArea = groupOrdersByArea(activeOrders);
  const lateCount = status.orders?.late || 0;
  const taskItems = buildTaskItems(
    lowStock.map((i) => ({
      name: i.name,
      qty: Number(i.quantity ?? i.central ?? i.stock ?? 0),
      threshold: Number(i.threshold ?? i.min_stock ?? 0),
    })),
    lateCount
  );

  const briefing = {
    generatedAt: new Date().toISOString(),
    bookings: {
      count: todayBookings.length,
      covers: coversBooked,
      items: todayBookings.slice(0, 20).map((b) => ({
        time: b.time || b.hour || "—",
        name: b.name || b.customerName || "—",
        covers: Number(b.covers || b.guests || 0) || 0,
        table: b.table || b.tableNumber || "—",
      })),
    },
    staff: {
      onShift: staffOnDuty.length,
      total: (staff || []).filter((s) => s.active !== false).length,
      plannedShifts,
      names: staffOnDuty.map((s) => s.name),
      items: staffOnDuty,
    },
    kitchen: {
      openOrders: status.orders?.open || 0,
      preparing: status.orders?.preparing || 0,
      late: lateCount,
      activeOrders: (activeOrders || []).length,
      prepItems,
    },
    orders: {
      active: (activeOrders || []).length,
      todayTotal: (todayOrders || []).length,
      completedToday: completedToday.length,
      byArea: ordersByArea,
    },
    sales: {
      revenueToday: status.sales?.revenueToday || 0,
      covers: status.sales?.covers || 0,
      averageTicket: status.sales?.averageTicket || 0,
    },
    inventory: {
      lowStockCount: lowStock.length,
      lowStock: lowStock.slice(0, 10).map((i) => ({
        name: i.name,
        qty: Number(i.quantity ?? i.central ?? i.stock ?? 0),
        threshold: Number(i.threshold ?? i.min_stock ?? 0),
      })),
    },
    tasks: {
      count: taskItems.length,
      lowStockCount: lowStock.length,
      items: taskItems,
    },
    hotel: {
      enabled: false,
      occupied: 0,
      total: 0,
      arrivals: 0,
      departures: 0,
      housekeeping: 0,
    },
    suggestion: status.suggestion || "Situazione operativa stabile.",
  };

  return {
    briefing,
    narrative: buildBriefingNarrative(briefing),
  };
}

function buildBriefingNarrative(b) {
  const lines = [
    "Briefing operativo di oggi.",
    `Prenotazioni: ${b.bookings.count}, coperti previsti ${b.bookings.covers}.`,
    `Staff in servizio: ${b.staff.onShift} su ${b.staff.total}, turni pianificati ${b.staff.plannedShifts}.`,
    `Comande attive: ${b.orders.active}, ordini oggi ${b.orders.todayTotal}.`,
    `Cucina: ${b.kitchen.openOrders} ordini aperti, ${b.kitchen.preparing} in preparazione, ${b.kitchen.late} in ritardo.`,
    `Incasso odierno: euro ${Number(b.sales.revenueToday || 0).toFixed(2)}, ${b.orders.completedToday} ordini completati.`,
    `Magazzino: ${b.inventory.lowStockCount} prodotti sotto scorta.`,
    b.suggestion,
  ];
  return lines.join(" ");
}

async function narrateBriefing({ locale = "it", enhance = true } = {}) {
  const { briefing, narrative } = await buildBriefing();
  if (!enhance || !process.env.OPENAI_API_KEY) {
    return { briefing, narrative, source: "template" };
  }

  try {
    const OpenAI = require("openai");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const lang = locale === "en" ? "English" : locale === "nl" ? "Dutch" : "Italian";
    const res = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.4,
      max_tokens: 600,
      messages: [
        {
          role: "system",
          content: `You are a restaurant operations briefing assistant. Write a concise spoken briefing in ${lang}. Use ONLY the data provided. No invented numbers.`,
        },
        { role: "user", content: JSON.stringify(briefing) },
      ],
    });
    const aiText = res.choices?.[0]?.message?.content?.trim();
    return { briefing, narrative: aiText || narrative, source: aiText ? "ai" : "template" };
  } catch {
    return { briefing, narrative, source: "template" };
  }
}

module.exports = { buildBriefing, buildBriefingNarrative, narrateBriefing };
