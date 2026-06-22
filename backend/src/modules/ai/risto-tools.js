const inventoryRepository = require("../../repositories/inventory.repository");
const cantinaRepository = require("../../repositories/cantina.repository");
const operationalBriefingService = require("../../service/operational-briefing.service");
const aiAssistantService = require("../../service/ai-assistant.service");

const RISTO_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_stock",
      description: "Cerca prodotti in magazzino per nome",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_stock",
      description: "Carico o scarico magazzino (delta positivo=carico, negativo=scarico)",
      parameters: {
        type: "object",
        properties: {
          productName: { type: "string" },
          delta: { type: "number" },
        },
        required: ["productName", "delta"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_wine",
      description: "Aggiunge un vino in cantina",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          producer: { type: "string" },
          color: { type: "string" },
          salePrice: { type: "number" },
          stock: { type: "number" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_wine_stock",
      description: "Aggiorna giacenza bottiglie cantina",
      parameters: {
        type: "object",
        properties: {
          wineName: { type: "string" },
          delta: { type: "number" },
        },
        required: ["wineName", "delta"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_operational_briefing",
      description: "Briefing operativo completo della giornata",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_daily_summary",
      description: "Riepilogo sintetico ordini, incasso, scorte",
      parameters: { type: "object", properties: {} },
    },
  },
];

async function executeRistoTool(name, args) {
  switch (name) {
    case "search_stock": {
      const q = String(args.query || "").toLowerCase();
      const all = await inventoryRepository.getAll();
      const hits = (all || []).filter((i) => String(i.name || "").toLowerCase().includes(q));
      return { ok: true, items: hits.slice(0, 15) };
    }
    case "update_stock": {
      const q = String(args.productName || "").toLowerCase();
      const delta = Number(args.delta) || 0;
      const all = await inventoryRepository.getAll();
      const item = (all || []).find((i) => String(i.name || "").toLowerCase().includes(q));
      if (!item) return { ok: false, error: "Prodotto non trovato" };
      const updated = await inventoryRepository.adjustQuantity(item.id, delta);
      return { ok: true, item: updated };
    }
    case "add_wine": {
      const wine = await cantinaRepository.create({
        name: args.name,
        producer: args.producer || "",
        color: args.color || "rosso",
        salePrice: args.salePrice || 0,
        stock: args.stock || 0,
      });
      return { ok: true, wine };
    }
    case "update_wine_stock": {
      const q = String(args.wineName || "").toLowerCase();
      const delta = Number(args.delta) || 0;
      const wines = await cantinaRepository.list();
      const wine = wines.find((w) => String(w.name || "").toLowerCase().includes(q));
      if (!wine) return { ok: false, error: "Vino non trovato" };
      const updated = await cantinaRepository.adjustStock(wine.id, delta);
      return { ok: true, wine: updated };
    }
    case "get_operational_briefing": {
      const data = await operationalBriefingService.buildBriefing();
      return { ok: true, ...data };
    }
    case "get_daily_summary": {
      const [status, brain] = await Promise.all([
        aiAssistantService.getOperationalStatus(),
        aiAssistantService.getDailyBrain(),
      ]);
      return { ok: true, status, brain };
    }
    default:
      return { ok: false, error: `Tool sconosciuto: ${name}` };
  }
}

module.exports = { RISTO_TOOLS, executeRistoTool };
