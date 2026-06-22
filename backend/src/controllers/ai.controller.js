const aiAssistantService = require("../service/ai-assistant.service");
const aiOpenaiService = require("../service/ai-openai.service");
const { runDepartmentQuery } = require("../modules/ai/ai.orchestrator");

// ================================
//   AI USAGE TRACKING (lightweight)
// ================================

function getTodayISODate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function detectSourceFromRequest(req) {
  try {
    const hdr = (req.headers && (req.headers["x-rw-source"] || req.headers["x-rw-module"])) || "";
    if (typeof hdr === "string" && hdr.trim()) {
      const h = hdr.toLowerCase();
      if (h.includes("cassa")) return "cassa";
      if (h.includes("cucina") || h.includes("kitchen")) return "cucina";
    }
    const ref = (req.headers && req.headers.referer) || "";
    if (typeof ref === "string" && ref) {
      const r = ref.toLowerCase();
      if (r.includes("/cassa/") || r.includes("cassa")) return "cassa";
      if (r.includes("/cucina/") || r.includes("kitchen")) return "cucina";
    }
  } catch (_) {
    // ignore detection errors
  }
  return "other";
}

function getUsageState() {
  if (!global.__rw_aiUsage) {
    global.__rw_aiUsage = {
      date: getTodayISODate(),
      total: 0,
      bySource: {
        cassa: 0,
        cucina: 0,
        other: 0,
      },
    };
  }
  const today = getTodayISODate();
  if (global.__rw_aiUsage.date !== today) {
    global.__rw_aiUsage = {
      date: today,
      total: 0,
      bySource: {
        cassa: 0,
        cucina: 0,
        other: 0,
      },
    };
  }
  return global.__rw_aiUsage;
}

function trackAiUsage(req) {
  const state = getUsageState();
  const source = detectSourceFromRequest(req);
  state.total += 1;
  if (!state.bySource[source]) {
    state.bySource[source] = 0;
  }
  state.bySource[source] += 1;

  // Soft console log for ops visibility
  // Example: [AI USAGE] 2026-03-17 → total: 124 (cassa: 80, cucina: 40, other: 4)
  // eslint-disable-next-line no-console
  console.log(
    `[AI USAGE] ${state.date} → total: ${state.total} (cassa: ${state.bySource.cassa || 0}, cucina: ${
      state.bySource.cucina || 0
    }, other: ${state.bySource.other || 0})`
  );
}

// POST /api/ai/query – production OpenAI backend (structured JSON)
exports.postQuery = async (req, res) => {
  const question = String((req.body && req.body.question) || "").trim();
  if (!question) {
    return res.status(400).json({
      ok: false,
      answer: "Parametro 'question' obbligatorio.",
      intent: "generic",
      confidence: "low",
      data: { summary: "", items: [], totals: {}, warnings: [] },
      sources: [],
      nextActions: [],
    });
  }
  try {
    trackAiUsage(req);
    const result = await aiOpenaiService.queryWithOpenAI(question);
    return res.json(result);
  } catch (err) {
    console.error("[AI] query error:", err.message);
    return res.status(500).json(aiOpenaiService.FALLBACK_RESPONSE);
  }
};

// POST /api/ai/:department/query – new structured AI Operating System entrypoint
exports.postDepartmentQuery = async (req, res) => {
  console.log("[AI ROUTE] POST /api/ai/:department/query hit");
  const department = String(req.params.department || "").toLowerCase();
  const body = req.body || {};
  const mode = body.mode || "read";
  const question = String(body.question || "").trim();
  const quickIntent = body.quickIntent || null;

  let responded = false;
  const timeoutMs = 25000;
  const timeoutId = setTimeout(() => {
    if (responded) return;
    responded = true;
    console.error("[AI ERROR] Department query timeout, sending fallback response", {
      department,
    });
    res.json({
      ok: false,
      answer: "AI temporaneamente non disponibile.",
      intent: department || "generic",
      confidence: "low",
      data: {
        summary: "",
        items: [],
        totals: {},
        warnings: ["AI temporaneamente non disponibile"],
      },
      sources: [],
    });
  }, timeoutMs);

  try {
    trackAiUsage(req);
    console.log("[AI CONTROLLER] postDepartmentQuery start", {
      department,
      mode,
      hasQuestion: !!question,
      quickIntent,
    });
    const result = await runDepartmentQuery({
      department,
      mode,
      question,
      quickIntent,
    });
    if (!responded) {
      responded = true;
      clearTimeout(timeoutId);
      console.log("[AI CONTROLLER] postDepartmentQuery success", {
        department,
        mode,
        title: result?.title,
      });
      return res.json(result);
    }
  } catch (err) {
    console.error("[AI ERROR] department query error:", err.message);
    if (!responded) {
      responded = true;
      clearTimeout(timeoutId);
      return res.status(500).json({
        mode: "read",
        department,
        title: "Errore AI",
        summary: "Si è verificato un errore durante l'elaborazione AI.",
        insights: [],
        actions: [],
        warnings: [err.message || "Errore interno AI"],
        dataPoints: {},
        notes: [],
      });
    }
  }
};

// GET /api/ai/status – operational AI Supervisor status
exports.getOperationalStatus = async (req, res) => {
  try {
    const status = await aiAssistantService.getOperationalStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({
      error: "operational_status_error",
      message: err.message || "Errore durante il calcolo dello stato operativo.",
    });
  }
};

// GET /api/ai/predictive-kitchen – Predictive Kitchen engine
exports.getPredictiveKitchen = async (req, res) => {
  try {
    const result = await aiAssistantService.getPredictiveKitchen();
    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: "predictive_kitchen_error",
      message:
        err.message || "Errore durante l'analisi predittiva cucina.",
    });
  }
};

// GET /api/ai/daily-brain – Daily restaurant operations summary
exports.getDailyBrain = async (req, res) => {
  try {
    const result = await aiAssistantService.getDailyBrain();
    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: "daily_brain_error",
      message: err.message || "Errore durante l'analisi operativa giornaliera.",
    });
  }
};

// GET /api/ai
exports.getGeneralSuggestion = async (req, res) => {
  const question = String(req.query.q || "").trim();
  const result = await aiAssistantService.getResponseForQuestion(question);
  res.json(result);
};

// GET /api/ai/kitchen/insights
exports.getKitchenInsights = async (req, res) => {
  try {
    const ordersRepository = require("../repositories/orders.repository");
    const recipesRepository = require("../repositories/recipes.repository");
    const inventoryRepository = require("../repositories/inventory.repository");
    const reportsService = require("../service/reports.service");

    const now = new Date();
    const allOrders = await ordersRepository.getAllOrders();
    const todayOrders = allOrders.filter((o) => {
      const d = new Date(o.updatedAt || o.createdAt);
      return d.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
    });

    const activeOrders = todayOrders.filter((o) => {
      const s = String(o.status || "").toLowerCase();
      return !["chiuso", "annullato", "pagato"].includes(s);
    });

    const preparingCount = activeOrders.filter(
      (o) => String(o.status || "").toLowerCase() === "in_preparazione"
    ).length;
    const waitingCount = activeOrders.filter((o) =>
      ["in_attesa", "attesa"].includes(String(o.status || "").toLowerCase())
    ).length;
    const readyCount = activeOrders.filter(
      (o) => String(o.status || "").toLowerCase() === "pronto"
    ).length;

    const lateOrders = activeOrders.filter((o) => {
      const ts = o.updatedAt || o.createdAt;
      if (!ts) return false;
      return (Date.now() - new Date(ts).getTime()) / 60000 >= 15;
    });

    const topDishes = await reportsService.getTopDishes(now, 5);
    const fcAlerts = await reportsService.getFoodCostAlerts(35);
    const recipes = await recipesRepository.getAll();
    const inventory = await inventoryRepository.getAll();
    const lowStock = (inventory || []).filter((i) => {
      const stock = Number(i.stock ?? i.quantity) || 0;
      const min = Number(i.minStock ?? i.min_stock) || 0;
      return min > 0 && stock < min;
    });

    let predictiveData = {};
    try { predictiveData = await aiAssistantService.getPredictiveKitchen(); } catch (_) {}

    res.json({
      timestamp: now.toISOString(),
      operations: {
        activeOrders: activeOrders.length,
        preparing: preparingCount,
        waiting: waitingCount,
        ready: readyCount,
        lateOrders: lateOrders.length,
        lateOrderDetails: lateOrders.slice(0, 5).map((o) => ({
          id: o.id,
          table: o.table,
          minutesLate: Math.floor((Date.now() - new Date(o.updatedAt || o.createdAt).getTime()) / 60000),
        })),
      },
      performance: {
        topDishes: topDishes.topDishes || [],
        totalRecipes: recipes.length,
        foodCostAlerts: (fcAlerts.alerts || []).length,
        foodCostAlertDetails: (fcAlerts.alerts || []).slice(0, 5),
      },
      inventory: {
        lowStockCount: lowStock.length,
        lowStockItems: lowStock.slice(0, 10).map((i) => ({
          name: i.name,
          stock: Number(i.stock ?? i.quantity) || 0,
          minStock: Number(i.minStock ?? i.min_stock) || 0,
        })),
      },
      predictions: predictiveData,
    });
  } catch (err) {
    res.status(500).json({
      error: "kitchen_insights_error",
      message: err.message || "Errore nel calcolo kitchen insights",
    });
  }
};

// POST /api/ai/kitchen/menu-generator
exports.menuGenerator = async (req, res) => {
  try {
    const recipesRepository = require("../repositories/recipes.repository");
    const inventoryRepository = require("../repositories/inventory.repository");
    const menuRepository = require("../repositories/menu.repository");
    const reportsService = require("../service/reports.service");

    const { season, style, maxItems } = req.body || {};
    const max = Math.min(20, Math.max(3, Number(maxItems) || 8));

    const [recipes, inventory, menu, topDishes] = await Promise.all([
      recipesRepository.getAll(),
      inventoryRepository.getAll(),
      menuRepository.getAll(),
      reportsService.getTopDishes(new Date(), 10),
    ]);

    const inStockIngredients = new Set(
      (inventory || [])
        .filter((i) => (Number(i.stock ?? i.quantity) || 0) > 0)
        .map((i) => String(i.name || "").toLowerCase())
    );

    const feasibleRecipes = (recipes || []).filter((r) => {
      const ingredients = Array.isArray(r.ingredients) ? r.ingredients : [];
      if (ingredients.length === 0) return true;
      return ingredients.every((ing) =>
        inStockIngredients.has(String(ing.name || "").toLowerCase())
      );
    });

    const topNames = new Set(
      ((topDishes.topDishes || []).map((d) => String(d.name || "").toLowerCase()))
    );

    const scored = feasibleRecipes.map((r) => {
      let score = 0;
      if (topNames.has(String(r.name || r.menuItemName || "").toLowerCase())) score += 3;
      const fc = Number(r.targetFoodCost || 30);
      if (fc <= 25) score += 2;
      else if (fc <= 35) score += 1;
      return { recipe: r, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const selected = scored.slice(0, max);

    const categories = ["antipasto", "primo", "secondo", "contorno", "dolce"];
    const suggestions = selected.map((s, i) => {
      const r = s.recipe;
      const existingMenu = (menu || []).find(
        (m) => String(m.name || "").toLowerCase() === String(r.menuItemName || r.name || "").toLowerCase()
      );
      return {
        name: r.menuItemName || r.name,
        recipeId: r.id,
        category: existingMenu?.category || categories[i % categories.length],
        suggestedPrice: existingMenu?.price || r.sellingPrice || 0,
        foodCostPercent: r.targetFoodCost || 30,
        feasibilityScore: s.score,
        inCurrentMenu: !!existingMenu,
      };
    });

    res.json({
      suggestions,
      meta: {
        totalRecipes: recipes.length,
        feasibleRecipes: feasibleRecipes.length,
        season: season || "auto",
        style: style || "balanced",
      },
    });
  } catch (err) {
    res.status(500).json({
      error: "menu_generator_error",
      message: err.message || "Errore nella generazione menu AI",
    });
  }
};

// POST /api/ai/kitchen/pricing
exports.pricingAI = async (req, res) => {
  try {
    const reportsService = require("../service/reports.service");
    const recipesRepository = require("../repositories/recipes.repository");
    const menuRepository = require("../repositories/menu.repository");

    const { targetMargin } = req.body || {};
    const target = Number(targetMargin) || 65;

    const [dishMargins, recipes, menu] = await Promise.all([
      reportsService.getDishMargins(new Date()),
      recipesRepository.getAll(),
      menuRepository.getAll(),
    ]);

    const suggestions = (dishMargins.dishes || []).map((d) => {
      const currentPrice = d.revenue / Math.max(1, d.qty);
      const cogs = d.costOfGoodsSold / Math.max(1, d.qty);
      const currentMargin = currentPrice > 0 ? ((currentPrice - cogs) / currentPrice) * 100 : 0;
      const suggestedPrice = cogs > 0 ? cogs / (1 - target / 100) : currentPrice;
      const delta = suggestedPrice - currentPrice;

      const recipe = recipes.find(
        (r) => String(r.menuItemName || r.name || "").toLowerCase() === String(d.name || "").toLowerCase()
      );

      return {
        name: d.name,
        currentPrice: Math.round(currentPrice * 100) / 100,
        suggestedPrice: Math.round(suggestedPrice * 100) / 100,
        priceDelta: Math.round(delta * 100) / 100,
        currentMarginPercent: Math.round(currentMargin * 100) / 100,
        targetMarginPercent: target,
        unitCogs: Math.round(cogs * 100) / 100,
        qtySold: d.qty,
        recipeId: recipe?.id || null,
        action: delta > 0.5 ? "increase" : delta < -0.5 ? "decrease" : "keep",
      };
    });

    const needsAction = suggestions.filter((s) => s.action !== "keep");

    res.json({
      suggestions: suggestions.sort((a, b) => Math.abs(b.priceDelta) - Math.abs(a.priceDelta)),
      summary: {
        totalDishes: suggestions.length,
        needsIncrease: needsAction.filter((s) => s.action === "increase").length,
        needsDecrease: needsAction.filter((s) => s.action === "decrease").length,
        optimal: suggestions.filter((s) => s.action === "keep").length,
        averageMarginPercent: dishMargins.summary?.averageMarginPercent || 0,
        targetMarginPercent: target,
      },
    });
  } catch (err) {
    res.status(500).json({
      error: "pricing_ai_error",
      message: err.message || "Errore nell'analisi prezzi AI",
    });
  }
};

// GET /api/ai/usage – debug-only daily usage counters (no auth)
exports.getUsage = async (req, res) => {
  const state = getUsageState();
  res.json({
    date: state.date,
    total: state.total,
    bySource: {
      cassa: state.bySource.cassa || 0,
      cucina: state.bySource.cucina || 0,
      other: state.bySource.other || 0,
    },
  });
};

async function getResponseWithContext(type, body = {}) {
  const gathered = await aiAssistantService.gatherContextForType(type);
  const context = { ...gathered, ...body };
  return aiAssistantService.getAssistantResponse(type, context);
}

// POST /api/ai/kitchen
exports.getKitchenSuggestion = async (req, res) => {
  const command = String((req.body && req.body.command) || "").trim();
  if (!command) {
    return res.status(400).json({
      success: false,
      error: "Comando mancante. Invia { command: string }."
    });
  }
  try {
    const result = await aiAssistantService.getResponseForQuestion(command);
    const responseText = result?.message ?? result?.response ?? String(result);
    const payload = {
      success: true,
      response: responseText
    };
    if (result?.type === "menu" && result?.menu) {
      payload.type = "menu";
      payload.menu = result.menu;
      payload.message = result.message;
    }
    return res.json(payload);
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || "Errore durante l'elaborazione del comando."
    });
  }
};

// POST /api/ai/sales
exports.getSalesSuggestion = async (req, res) => {
  const result = await getResponseWithContext("sales", req.body || {});
  res.json(result);
};

// POST /api/ai/production
exports.getProductionSuggestion = async (req, res) => {
  const result = await getResponseWithContext("production", req.body || {});
  res.json(result);
};

// POST /api/ai/inventory – Magazzino multi-livello (Centrale + reparti)
exports.getInventorySuggestion = async (req, res) => {
  try {
    const result = await aiAssistantService.getInventoryWarehouseSuggestion();
    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: "inventory_suggestion_error",
      message: err.message || "Errore durante l'analisi magazzino.",
    });
  }
};

const RISTO_ROLES = ["owner", "supervisor", "cucina", "sala", "bar", "pizzeria", "magazzino", "cassa"];
const { RISTO_TOOLS, executeRistoTool } = require("../modules/ai/risto-tools");
const cantinaAiService = require("../service/cantina-ai.service");

// POST /api/ai/chat – Risto Comandi + AI chat con tool opzionali
exports.postChat = async (req, res) => {
  const body = req.body || {};
  const message = String(body.message || body.question || "").trim();
  const context = String(body.context || "risto").trim();
  const enableTools = !!body.enableTools;
  const locale = String(body.locale || "it");

  if (!message) {
    return res.status(400).json({ ok: false, error: "message obbligatorio" });
  }

  const role = req.session?.user?.role || "";
  const canUseTools = enableTools && (RISTO_ROLES.includes(role) || role === "owner");

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      ok: false,
      reply: "AI non configurata. Imposta OPENAI_API_KEY.",
      actions: [],
    });
  }

  try {
    trackAiUsage(req);
    const OpenAI = require("openai");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    let systemPrompt = `Sei Risto, assistente operativo di Controllo Totale. Rispondi in ${locale === "en" ? "inglese" : "italiano"}. Usa solo dati reali.`;
    if (context === "cantina") {
      const snap = await cantinaAiService.buildSnapshot();
      systemPrompt += "\n" + cantinaAiService.snapshotToPrompt(snap);
    }

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ];

    const actions = [];
    const first = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.4,
      max_tokens: 800,
      messages,
      tools: canUseTools ? RISTO_TOOLS : undefined,
    });

    const choice = first.choices?.[0];
    const toolCalls = choice?.message?.tool_calls || [];

    if (canUseTools && toolCalls.length > 0) {
      messages.push(choice.message);
      for (const tc of toolCalls) {
        const fn = tc.function?.name;
        let args = {};
        try {
          args = JSON.parse(tc.function?.arguments || "{}");
        } catch (_) {}
        const result = await executeRistoTool(fn, args);
        actions.push({ tool: fn, result });
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
      const second = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.4,
        max_tokens: 800,
        messages,
      });
      const reply = second.choices?.[0]?.message?.content?.trim() || "Operazione completata.";
      return res.json({ ok: true, reply, actions, isAction: actions.length > 0 });
    }

    const reply = choice?.message?.content?.trim() || "Nessuna risposta.";
    return res.json({ ok: true, reply, actions: [], isAction: false });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || "Errore AI chat",
      reply: "Errore durante l'elaborazione.",
      actions: [],
    });
  }
};
