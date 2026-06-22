const aiAssistantService = require("./ai-assistant.service");
const bookingsRepository = require("../repositories/bookings.repository");
const staffRepository = require("../repositories/staff.repository");
const inventoryRepository = require("../repositories/inventory.repository");
const ordersService = require("./orders.service");

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function isToday(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

async function buildBriefing() {
  const { start, end } = todayRange();
  const [status, bookings, staff, inventory, activeOrders] = await Promise.all([
    aiAssistantService.getOperationalStatus(),
    bookingsRepository.getAll().catch(() => []),
    staffRepository.getAll().catch(() => []),
    inventoryRepository.getAll().catch(() => []),
    ordersService.listActiveOrders().catch(() => []),
  ]);

  const todayBookings = (bookings || []).filter((b) => isToday(b.date || b.datetime || b.createdAt));
  const coversBooked = todayBookings.reduce((s, b) => s + (Number(b.covers || b.guests || 0) || 0), 0);
  const staffActive = (staff || []).filter((s) => s.active !== false && s.onShift === true);
  const lowStock = (inventory || []).filter((i) => {
    const qty = Number(i.quantity ?? i.central ?? i.stock ?? 0);
    const min = Number(i.threshold ?? i.min_stock ?? 0);
    return min > 0 && qty <= min;
  });

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
      onShift: staffActive.length,
      total: (staff || []).filter((s) => s.active !== false).length,
      names: staffActive.slice(0, 10).map((s) => s.name || s.username || "—"),
    },
    kitchen: {
      openOrders: status.orders?.open || 0,
      preparing: status.orders?.preparing || 0,
      late: status.orders?.late || 0,
      activeOrders: (activeOrders || []).length,
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
    `Staff in servizio: ${b.staff.onShift} su ${b.staff.total}.`,
    `Cucina: ${b.kitchen.openOrders} ordini aperti, ${b.kitchen.preparing} in preparazione, ${b.kitchen.late} in ritardo.`,
    `Incasso odierno: euro ${Number(b.sales.revenueToday || 0).toFixed(2)}, coperti ${b.sales.covers}.`,
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
