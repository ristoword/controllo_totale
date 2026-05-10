// backend/src/modules/ai/ai.orchestrator.js
// Central AI orchestrator: prepares context and prompts per department, calls OpenAI, normalizes output.

const { normalizeDepartment, normalizeMode, buildBaseResponse } = require("./ai.schemas");
const { CORE_SYSTEM_PROMPT, buildDepartmentPrompt } = require("./ai.prompts");
const aiOpenaiService = require("../../service/ai-openai.service");
const aiContextService = require("../../service/ai-context.service");
const aiTools = require("./ai.tools");

function buildUserPrompt({ department, mode, question, quickIntent, context }) {
  const header = {
    department,
    mode,
    quickIntent: quickIntent || null,
  };

  return `
HEADER:
${JSON.stringify(header, null, 2)}

CONTESTO OPERATIVO (JSON, usare solo questi dati):
${JSON.stringify(context, null, 2)}

DOMANDA DELL'UTENTE:
${question || "(nessuna domanda testuale, usa quickIntent)"}

ISTRUZIONI RISPOSTA:
- Restituisci UN SOLO oggetto JSON con questa struttura:
{
  "mode": "read|suggest|act",
  "department": "kitchen|supervisor|warehouse|cash|creative",
  "title": "breve titolo",
  "summary": "1-3 frasi riassuntive",
  "insights": ["punti elenco operativi"],
  "actions": [
    {
      "id": "string_id_azione",
      "label": "etichetta pulsante",
      "description": "spiegazione breve dell'azione",
      "dangerous": false
    }
  ],
  "warnings": ["messaggi importanti per il ristoratore"],
  "dataPoints": { "chiave": "valore" },
  "notes": ["eventuali note testuali aggiuntive"]
}

- Se non puoi rispondere con confidenza, scrivi chiaramente perché nei warnings.
`;
}

async function buildDepartmentContext(department) {
  console.log("[AI CONTEXT] buildDepartmentContext start", { department });
  const base = await aiContextService.buildContextForQuery().catch((err) => {
    console.error("[AI ERROR] buildContextForQuery failed in orchestrator:", err?.message);
    return {};
  });

  switch (department) {
    case "kitchen": {
      const [activeOrders, lowStock, dailyMenu, topDishes] = await Promise.all([
        aiTools.getActiveOrdersWithItems().catch(() => []),
        aiTools.getLowStockItems().catch(() => []),
        aiTools.getDailyMenu().catch(() => ({})),
        aiTools.getTopDishes().catch(() => []),
      ]);
      return {
        ...base,
        kitchen: {
          activeOrders,
          activeOrdersCount: activeOrders.length,
          lowStockKitchen: lowStock,
          dailyMenu,
          topDishes,
        },
      };
    }
    case "supervisor": {
      const [sales, topDishes, salesHistory] = await Promise.all([
        aiTools.getTodaySalesSummary().catch(() => ({})),
        aiTools.getTopDishes().catch(() => []),
        aiTools.getRecentSalesHistory(7).catch(() => []),
      ]);
      return { ...base, supervisor: { sales, topDishes, salesHistory } };
    }
    case "warehouse": {
      const [inventory, lowStock, suppliers] = await Promise.all([
        aiTools.getInventorySnapshot().catch(() => []),
        aiTools.getLowStockItems().catch(() => []),
        aiTools.getSuppliers().catch(() => []),
      ]);
      return {
        ...base,
        warehouse: {
          inventory,
          lowStock,
          suppliers,
          lowStockCount: lowStock.length,
        },
      };
    }
    case "cash": {
      const [sales, closures] = await Promise.all([
        aiTools.getTodaySalesSummary().catch(() => ({})),
        aiTools.getRecentClosures(7).catch(() => []),
      ]);
      return { ...base, cash: { sales, recentClosures: closures } };
    }
    case "creative": {
      const [inventory, recipes, menuItems, dailyMenu] = await Promise.all([
        aiTools.getInventorySnapshot().catch(() => []),
        aiTools.getRecipes().catch(() => []),
        aiTools.getMenuItems().catch(() => []),
        aiTools.getDailyMenu().catch(() => ({})),
      ]);
      return {
        ...base,
        creative: {
          inventory,
          recipes,
          menuItems,
          dailyMenu,
        },
      };
    }
    case "sala": {
      const [activeOrders, sales, bookingsToday, menuGrouped] = await Promise.all([
        aiTools.getActiveOrdersWithItems().catch(() => []),
        aiTools.getTodaySalesSummary().catch(() => ({})),
        aiTools.getBookingsToday().catch(() => []),
        aiTools.getActiveMenuGrouped().catch(() => ({})),
      ]);
      return {
        ...base,
        sala: {
          activeOrders,
          activeOrdersCount: activeOrders.length,
          openTables: [...new Set(activeOrders.map((o) => o.table))].length,
          bookingsToday,
          sales,
          menuGrouped,
        },
      };
    }
    case "bar": {
      const [allOrders, lowStock, menuItems] = await Promise.all([
        aiTools.getActiveOrdersWithItems().catch(() => []),
        aiTools.getLowStockItems().catch(() => []),
        aiTools.getMenuItems().catch(() => []),
      ]);
      const barOrders = allOrders.filter((o) =>
        (o.items || []).some((i) => (i.area || "").toLowerCase() === "bar")
      );
      const barMenu = menuItems.filter((i) => (i.area || "").toLowerCase() === "bar");
      return {
        ...base,
        bar: {
          activeBarOrders: barOrders,
          activeBarOrdersCount: barOrders.length,
          lowStock,
          barMenu,
        },
      };
    }
    case "pizzeria": {
      const [allOrders, lowStock, dailyMenu] = await Promise.all([
        aiTools.getActiveOrdersWithItems().catch(() => []),
        aiTools.getLowStockItems().catch(() => []),
        aiTools.getDailyMenu().catch(() => ({})),
      ]);
      const pizzeriaOrders = allOrders.filter((o) =>
        (o.items || []).some((i) => (i.area || "").toLowerCase() === "pizzeria")
      );
      return {
        ...base,
        pizzeria: {
          activePizzeriaOrders: pizzeriaOrders,
          activePizzeriaOrdersCount: pizzeriaOrders.length,
          lowStock,
          dailyMenu,
        },
      };
    }
    case "prenotazioni": {
      const [bookingsToday, upcomingBookings, sales] = await Promise.all([
        aiTools.getBookingsToday().catch(() => []),
        aiTools.getUpcomingBookings(7).catch(() => []),
        aiTools.getTodaySalesSummary().catch(() => ({})),
      ]);
      return {
        ...base,
        prenotazioni: {
          bookingsToday,
          bookingsTodayCount: bookingsToday.length,
          upcomingBookings,
          sales,
        },
      };
    }
    case "haccp": {
      const [inventory, lowStock, expiring] = await Promise.all([
        aiTools.getInventorySnapshot().catch(() => []),
        aiTools.getLowStockItems().catch(() => []),
        aiTools.getInventorySnapshot().catch(() => []),
      ]);
      const today = new Date();
      const in3days = new Date(today); in3days.setDate(today.getDate() + 3);
      const expiringItems = expiring.filter((i) => {
        if (!i.expiryDate && !i.expiry_date) return false;
        const exp = new Date(i.expiryDate || i.expiry_date);
        return exp <= in3days;
      });
      return { ...base, haccp: { inventory, lowStock, expiringItems } };
    }
    case "turni": {
      const [shifts, staff, sales] = await Promise.all([
        aiTools.getShiftsThisWeek().catch(() => []),
        aiTools.getStaffSummary().catch(() => []),
        aiTools.getTodaySalesSummary().catch(() => ({})),
      ]);
      return {
        ...base,
        turni: {
          shiftsThisWeek: shifts,
          shiftsCount: shifts.length,
          staff,
          staffCount: staff.length,
          sales,
        },
      };
    }
    case "fornitori": {
      const [suppliers, inventory, lowStock] = await Promise.all([
        aiTools.getSuppliers().catch(() => []),
        aiTools.getInventorySnapshot().catch(() => []),
        aiTools.getLowStockItems().catch(() => []),
      ]);
      return {
        ...base,
        fornitori: {
          suppliers,
          suppliersCount: suppliers.length,
          inventory,
          lowStock,
          lowStockCount: lowStock.length,
        },
      };
    }
    case "archivio": {
      const [salesHistory, topDishes, closures] = await Promise.all([
        aiTools.getRecentSalesHistory(14).catch(() => []),
        aiTools.getTopDishes().catch(() => []),
        aiTools.getRecentClosures(14).catch(() => []),
      ]);
      return {
        ...base,
        archivio: {
          salesHistory,
          topDishes,
          recentClosures: closures,
        },
      };
    }
    case "asporto": {
      const [allOrders, sales] = await Promise.all([
        aiTools.getActiveOrdersWithItems().catch(() => []),
        aiTools.getTodaySalesSummary().catch(() => ({})),
      ]);
      const asportoOrders = allOrders.filter((o) =>
        (o.area || "").toLowerCase() === "asporto" ||
        (o.channel || "").toLowerCase() === "asporto"
      );
      return {
        ...base,
        asporto: {
          asportoOrders,
          asportoOrdersCount: asportoOrders.length,
          allActiveOrders: allOrders.length,
          sales,
        },
      };
    }
    case "catering": {
      const [inventory, menuItems, recipes] = await Promise.all([
        aiTools.getInventorySnapshot().catch(() => []),
        aiTools.getMenuItems().catch(() => []),
        aiTools.getRecipes().catch(() => []),
      ]);
      return { ...base, catering: { inventory, menuItems, recipes } };
    }
    default:
      console.log("[AI CONTEXT] buildDepartmentContext done (default)", { department });
      return base;
  }
}

async function runDepartmentQuery({ department, mode, question, quickIntent }) {
  const dep = normalizeDepartment(department);
  const m = normalizeMode(mode);

  console.log("[AI ORCHESTRATOR] runDepartmentQuery start", {
    department: dep,
    mode: m,
    quickIntent: quickIntent || null,
  });

  const baseResp = buildBaseResponse({ mode: m, department: dep });

  let context = {};
  try {
    context = await buildDepartmentContext(dep);
  } catch (err) {
    baseResp.warnings.push("Errore nel caricamento del contesto operativo.");
  }

  const systemPrompt =
    CORE_SYSTEM_PROMPT + "\n" + buildDepartmentPrompt(dep);

  const userPrompt = buildUserPrompt({
    department: dep,
    mode: m,
    question,
    quickIntent,
    context,
  });

  // Usa il servizio OpenAI esistente che restituisce già JSON valido, poi lo mappiamo sullo schema richiesto.
  let raw = null;
  try {
    console.log("[AI ORCHESTRATOR] calling aiOpenaiService.queryWithOpenAI");
    raw = await aiOpenaiService.queryWithOpenAI(userPrompt, systemPrompt);
    console.log("[AI ORCHESTRATOR] aiOpenaiService.queryWithOpenAI completed");
  } catch (err) {
    console.error(
      "[AI ERROR] queryWithOpenAI failed in orchestrator:",
      err?.message
    );
    baseResp.warnings.push(
      `Errore AI: ${err?.message || "servizio AI non disponibile"}`
    );
  }

  if (!raw || typeof raw !== "object") {
    console.log("[AI RESPONSE] returning fallback baseResp for department", dep);
    return {
      ...baseResp,
      title: "AI non disponibile",
      summary: "Il servizio AI non è momentaneamente disponibile.",
    };
  }

  // Prova a mappare i campi se il modello ha già seguito lo schema richiesto.
  const response = {
    ...baseResp,
    mode: normalizeMode(raw.mode || m),
    department: normalizeDepartment(raw.department || dep),
    title: raw.title || baseResp.title,
    summary: raw.summary || raw.answer || baseResp.summary,
    insights: Array.isArray(raw.insights) ? raw.insights : baseResp.insights,
    actions: Array.isArray(raw.actions) ? raw.actions : baseResp.actions,
    warnings: Array.isArray(raw.warnings)
      ? raw.warnings
      : baseResp.warnings,
    dataPoints:
      raw.dataPoints && typeof raw.dataPoints === "object"
        ? raw.dataPoints
        : baseResp.dataPoints,
    notes: Array.isArray(raw.notes) ? raw.notes : baseResp.notes,
  };

  console.log("[AI RESPONSE] orchestrator normalized response", {
    department: response.department,
    mode: response.mode,
    title: response.title,
  });

  return response;
}

module.exports = {
  runDepartmentQuery,
};

