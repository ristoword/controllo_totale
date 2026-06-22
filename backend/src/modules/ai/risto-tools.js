const inventoryRepository = require("../../repositories/inventory.repository");
const cantinaRepository = require("../../repositories/cantina.repository");
const recipesRepository = require("../../repositories/recipes.repository");
const menuRepository = require("../../repositories/menu.repository");
const suppliersRepository = require("../../repositories/suppliers.repository");
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
  {
    type: "function",
    function: {
      name: "create_recipe",
      description: "Crea una nuova ricetta con ingredienti e food cost",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nome della ricetta (es. Carbonara)" },
          menuItemName: { type: "string", description: "Nome del piatto nel menu" },
          sellingPrice: { type: "number", description: "Prezzo di vendita" },
          portions: { type: "number", description: "Numero porzioni" },
          targetFoodCost: { type: "number", description: "Target food cost % (default 30)" },
          ingredients: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                quantity: { type: "number" },
                unit: { type: "string" },
                unitCost: { type: "number" },
                wastePercent: { type: "number" },
              },
              required: ["name", "quantity"],
            },
          },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_menu_item",
      description: "Aggiunge un piatto al menu con prezzo, categoria e area",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nome del piatto" },
          price: { type: "number", description: "Prezzo di vendita" },
          category: { type: "string", description: "Categoria (antipasto, primo, secondo, contorno, dolce, bevanda)" },
          area: { type: "string", description: "Area reparto (cucina, pizzeria, bar)" },
          description: { type: "string", description: "Descrizione opzionale" },
          recipeId: { type: "string", description: "ID ricetta collegata" },
        },
        required: ["name", "price"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_supplier_order",
      description: "Prepara un ordine fornitore dalla lista scorte basse o da lista prodotti",
      parameters: {
        type: "object",
        properties: {
          supplierName: { type: "string", description: "Nome o parte del nome del fornitore" },
          items: {
            type: "array",
            description: "Prodotti da ordinare (opzionale, se vuoto usa scorte basse)",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                quantity: { type: "number" },
                unit: { type: "string" },
              },
              required: ["name", "quantity"],
            },
          },
          notes: { type: "string", description: "Note per il fornitore" },
        },
        required: ["supplierName"],
      },
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
    case "create_recipe": {
      const ingredients = Array.isArray(args.ingredients)
        ? args.ingredients.map((ing) => ({
            name: String(ing.name || "").trim(),
            quantity: Number(ing.quantity) || 0,
            unit: String(ing.unit || "g").trim(),
            costPerUnit: Number(ing.unitCost) || 0,
            wastagePercent: Number(ing.wastePercent) || 0,
          }))
        : [];
      const recipe = await recipesRepository.create({
        name: args.name,
        menuItemName: args.menuItemName || args.name,
        sellingPrice: args.sellingPrice || 0,
        portions: args.portions || 1,
        targetFoodCost: args.targetFoodCost || 30,
        ingredients,
      });
      return { ok: true, recipe };
    }
    case "add_menu_item": {
      const item = await menuRepository.add({
        name: args.name,
        price: args.price || 0,
        category: args.category || "extra",
        area: args.area || "cucina",
        description: args.description || "",
        recipeId: args.recipeId || null,
        active: true,
      });
      return { ok: true, menuItem: item };
    }
    case "prepare_supplier_order": {
      const q = String(args.supplierName || "").toLowerCase();
      const suppliers = await suppliersRepository.list();
      const supplier = suppliers.find((s) =>
        String(s.name || "").toLowerCase().includes(q)
      );
      if (!supplier) return { ok: false, error: `Fornitore "${args.supplierName}" non trovato` };

      let orderItems = args.items;
      if (!Array.isArray(orderItems) || orderItems.length === 0) {
        const inv = await inventoryRepository.getAll();
        orderItems = (inv || [])
          .filter((i) => {
            const stock = Number(i.stock ?? i.quantity) || 0;
            const min = Number(i.minStock ?? i.min_stock) || 0;
            return min > 0 && stock < min;
          })
          .map((i) => ({
            name: i.name,
            quantity: Math.max(1, (Number(i.minStock ?? i.min_stock) || 5) - (Number(i.stock ?? i.quantity) || 0)),
            unit: i.unit || "pz",
            currentStock: Number(i.stock ?? i.quantity) || 0,
            minStock: Number(i.minStock ?? i.min_stock) || 0,
          }));
      }

      const order = await suppliersRepository.addOrder(supplier.id, {
        date: new Date().toISOString(),
        items: orderItems,
        notes: args.notes || "",
        status: "bozza",
        total: orderItems.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0),
      });
      return {
        ok: true,
        supplier: { id: supplier.id, name: supplier.name },
        order,
        itemCount: orderItems.length,
      };
    }
    default:
      return { ok: false, error: `Tool sconosciuto: ${name}` };
  }
}

module.exports = { RISTO_TOOLS, executeRistoTool };
