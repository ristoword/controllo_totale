"use strict";

const path = require("path");
const { seedId, orderNum } = require("./context");
const paths = require("../../src/config/paths");
const { safeReadJson } = require("../../src/utils/safeFileIO");

const CANTINA_SEED = safeReadJson(path.join(paths.DATA, "config", "cantina-seed.json"), []);

/** @param {import('./context').buildContext extends Function ? ReturnType<typeof import('./context').buildContext> : any} c */
function menuSignature(c) {
  const base = 100;
  return [
    { id: base + 1, name: "Carpaccio di manzo", category: "Antipasti", price: 14, area: "cucina", active: true, _seed: true },
    { id: base + 2, name: "Bruschetta al pomodoro", category: "Antipasti", price: 8, area: "cucina", active: true, _seed: true },
    { id: base + 3, name: "Spaghetti alle vongole", category: "Primi", price: 16, area: "cucina", active: true, _seed: true },
    { id: base + 4, name: "Risotto ai funghi", category: "Primi", price: 15, area: "cucina", active: true, _seed: true },
    { id: base + 5, name: "Tagliata di manzo", category: "Secondi", price: 24, area: "cucina", active: true, _seed: true },
    { id: base + 6, name: "Branzino al forno", category: "Secondi", price: 22, area: "cucina", active: true, _seed: true },
  ];
}

const MODULE_SIGNATURES = [
  { key: "menu", file: "menu.json", kind: "menu", build: menuSignature },
  {
    key: "inventory", file: "inventory.json", kind: "array",
    build: (c) => [{ id: 1, name: "Farina 00", unit: "kg", quantity: 25, cost: 1.2, threshold: 5, category: "dispensa", _seed: true }],
  },
  {
    key: "suppliers", file: "suppliers.json", kind: "suppliers",
    build: (c) => ({
      version: 1,
      suppliers: [{
        id: 1, companyName: `Fornitore Demo ${c.restaurantName}`, vatId: "IT00000000000",
        email: `fornitore@${c.slug}.local`, phone: "+39 02 0000000", orders: [], invoices: [], archived: false, _seed: true,
      }],
    }),
  },
  {
    key: "recipes", file: "recipes.json", kind: "recipes",
    build: (c) => ({
      recipes: [{
        id: seedId(c.tenantId, "recipe"), name: "Risotto demo", category: "Primi", yieldPortions: 1,
        ingredients: [{ name: "Riso", quantity: 0.08, unit: "kg" }], _seed: true,
      }],
    }),
  },
  {
    key: "daily-menu", file: "daily-menu.json", kind: "dishes",
    build: (c) => ({
      menuActive: true, updatedAt: c.now,
      dishes: [{ id: 1, name: "Piatto del giorno", category: "primo", price: 14, active: true, _seed: true }],
    }),
  },
  {
    key: "bookings", file: "bookings.json", kind: "array",
    build: (c) => [{
      id: seedId(c.tenantId, "booking"), name: "Rossi", phone: "+39 333 1112222", people: 4,
      date: c.today, time: "20:30", status: "nuova", notes: "Tavolo finestra (demo)", _seed: true,
    }],
  },
  {
    key: "customers", file: "customers.json", kind: "array",
    build: (c) => [{
      id: c.customerId, name: "Anna", surname: "Demo", phone: "+39 340 0000001",
      email: `cliente@${c.slug}.local`, category: "habitue", visits: 1, totalSpent: 48, lastVisit: c.today, _seed: true,
    }],
  },
  {
    key: "cantina", file: "cantina.json", kind: "array",
    build: (c) =>
      (Array.isArray(CANTINA_SEED) && CANTINA_SEED.length
        ? CANTINA_SEED
        : [{
            producer: "Demo", name: "Vermentino di Sardegna", vintage: 2024,
            color: "bianco", country: "Italia", region: "Sardegna", grape: "Vermentino", alcohol: 13,
            purchasePrice: 6.5, salePrice: 22, stock: 12, pairings: "Pesce, antipasti",
          }]
      ).map((w, i) => ({
        ...w,
        id: seedId(c.tenantId, `wine-${i}`),
        active: w.active !== false,
        _seed: true,
      })),
  },
  {
    key: "catering-events", file: "catering-events.json", kind: "events",
    build: (c) => [{
      id: seedId(c.tenantId, "catering"), title: "Evento demo", clientName: "Cliente Demo",
      eventDate: c.today, guestCount: 40, menuType: "custom", sections: [], status: "draft", _seed: true,
    }],
  },
  {
    key: "catering-presets", file: "catering-presets.json", kind: "array",
    build: (c) => [{
      id: seedId(c.tenantId, "preset"), name: "Menu finger food", guestRange: "30-50",
      pricePerGuest: 35, courses: ["Antipasti", "Dolce"], _seed: true,
    }],
  },
  {
    key: "devices", file: "devices.json", kind: "devices",
    build: (c) => ({
      devices: [{
        id: c.deviceId, name: "Stampante cucina", type: "kitchen_printer", department: "cucina",
        connectionType: "network", isActive: true, _seed: true,
      }],
    }),
  },
  {
    key: "print-routes", file: "print-routes.json", kind: "routes",
    build: (c) => ({
      routes: [{
        id: seedId(c.tenantId, "route"), eventType: "order_ticket_kitchen", department: "cucina",
        deviceId: c.deviceId, isActive: true, _seed: true,
      }],
    }),
  },
  {
    key: "print-jobs", file: "print-jobs.json", kind: "array",
    build: (c) => [{
      id: seedId(c.tenantId, "printjob"), routeId: seedId(c.tenantId, "route"), status: "done",
      createdAt: c.now, payload: { demo: true }, _seed: true,
    }],
  },
  {
    key: "haccp-checks", file: "haccp-checks.json", kind: "array",
    build: (c) => [{
      id: seedId(c.tenantId, "haccp"), type: "fridge", value: 3.5, unit: "°C",
      date: c.today, time: "09:00", operator: c.staffUserId, _seed: true,
    }],
  },
  {
    key: "staff", file: "staff.json", kind: "array",
    build: (c) => [{
      id: c.staffUserId, name: "Mario", surname: "Demo", role: "cameriere", department: "sala",
      roleType: "operational", active: true,
      personal: { name: "Mario", surname: "Demo", email: `${c.username}@demo.local`, hireDate: c.today },
      work: { department: "sala", role: "cameriere", weeklyHours: 40 }, _seed: true,
    }],
  },
  {
    key: "attendance", file: "attendance.json", kind: "records",
    build: (c) => ({
      records: [{
        id: seedId(c.tenantId, "attendance"), userId: c.staffUserId, restaurantId: c.tenantId,
        date: c.today, clockInAt: `${c.today}T08:00:00.000Z`, clockOutAt: `${c.today}T16:00:00.000Z`,
        workedMinutes: 480, status: "closed", notes: "Timbratura demo", _seed: true,
      }],
    }),
  },
  {
    key: "leave-requests", file: "leave-requests.json", kind: "requests",
    build: (c) => ({
      requests: [{
        id: seedId(c.tenantId, "leave"), userId: c.staffUserId, username: c.username,
        name: "Mario", surname: "Demo", type: "ferie",
        startDate: c.today, endDate: c.today, days: 1, status: "pending", reason: "Richiesta demo", _seed: true,
      }],
    }),
  },
  {
    key: "staff-shifts", file: "staff-shifts.json", kind: "array",
    build: (c) => [{
      id: seedId(c.tenantId, "shift"), staffId: c.staffUserId, date: c.today,
      start: "09:00", end: "17:00", department: "sala", type: "work", status: "scheduled", _seed: true,
    }],
  },
  {
    key: "staff-requests", file: "staff-requests.json", kind: "array",
    build: (c) => [{
      id: seedId(c.tenantId, "staffreq"), staffId: c.staffUserId, type: "uniform",
      status: "pending", message: "Richiesta divisa demo", createdAt: c.now, _seed: true,
    }],
  },
  {
    key: "qr-tables", file: "qr-tables.json", kind: "tables",
    build: (c) => ({
      tables: [{ id: 1, label: "Tavolo 1", createdAt: c.now, updatedAt: c.now, _seed: true }],
    }),
  },
  {
    key: "sala_tables", file: "sala-tables.json", kind: "tables",
    build: (c) => ({
      tables: [{
        id: seedId(c.tenantId, "table"), nome: "T1", posti: 4, x: 80, y: 80,
        forma: "quadrato", stato: "libero", _seed: true,
      }],
    }),
  },
  {
    key: "pos-shifts", file: "pos-shifts.json", kind: "shifts",
    build: (c) => ({
      shifts: [{
        id: seedId(c.tenantId, "posshift"), opened_at: c.now, closed_at: c.now,
        operator: "Demo", opening_float: 100, cash_total: 50, card_total: 0, other_total: 0, status: "closed", _seed: true,
      }],
    }),
  },
  {
    key: "stock-movements", file: "stock-movements.json", kind: "array",
    build: (c) => [{
      id: seedId(c.tenantId, "stockmv"), type: "deduction", itemName: "Farina 00",
      quantity: 1, unit: "kg", before: 25, after: 24, note: "Movimento demo", createdAt: c.now, _seed: true,
    }],
  },
  {
    key: "inventory-transfers", file: "inventory-transfers.json", kind: "array",
    build: (c) => [{
      id: seedId(c.tenantId, "transfer"), productName: "Farina 00", quantity: 2, unit: "kg",
      fromWarehouse: "magazzino", toWarehouse: "cucina", status: "completed", createdAt: c.now, _seed: true,
    }],
  },
  {
    key: "order-food-costs", file: "order-food-costs.json", kind: "array",
    build: (c) => [{
      id: seedId(c.tenantId, "foodcost"), orderId: c.orderId, dishName: "Risotto ai funghi",
      foodCost: 4.2, salePrice: 15, marginPercent: 72, _seed: true,
    }],
  },
  {
    key: "sessions", file: "sessions.json", kind: "array",
    build: () => [],
  },
  {
    key: "orders", file: "orders.json", kind: "array",
    build: (c) => [{
      id: c.orderId, table: 1, covers: 2, area: "sala", waiter: "Mario Demo", status: "chiuso",
      createdAt: c.now, updatedAt: c.now,
      items: [{ name: "Risotto ai funghi", qty: 2, area: "cucina", category: "Primi", price: 15 }], _seed: true,
    }],
  },
  {
    key: "payments", file: "payments.json", kind: "array",
    build: (c) => [{
      id: c.paymentId, table: "1", orderIds: [String(c.orderId)], subtotal: 30, discountAmount: 0,
      discountType: "none", vatPercent: 10, vatAmount: 3, total: 33, paymentMethod: "cash",
      amountReceived: 40, changeAmount: 7, covers: 2, operator: "demo", status: "closed",
      createdAt: c.now, updatedAt: c.now, closedAt: c.now, _seed: true,
    }],
  },
  {
    key: "closures", file: "closures.json", kind: "array",
    build: (c) => [{
      id: c.closureId, date: c.today, cashTotal: 33, cardTotal: 0, otherTotal: 0, grandTotal: 33,
      paymentsCount: 1, closedOrdersCount: 1, closedAt: c.now, closedBy: "demo", notes: "Chiusura demo", createdAt: c.now, _seed: true,
    }],
  },
  {
    key: "reports", file: "reports.json", kind: "reports",
    build: (c) => ({
      reports: [{
        id: seedId(c.tenantId, "report"), type: "daily", date: c.today, title: "Report demo",
        revenue: 33, covers: 2, note: "Report giornaliero demo", createdAt: c.now, _seed: true,
      }],
    }),
  },
  {
    key: "storni", file: "storni.json", kind: "entries",
    build: (c) => ({
      entries: [{
        id: seedId(c.tenantId, "storno"), date: c.today, amount: 5, reason: "Storno demo",
        operator: "demo", tableRef: "1", createdAt: c.now, _seed: true,
      }],
    }),
  },
  {
    key: "cassa-shifts", file: "cassa-shifts.json", kind: "shifts",
    build: (c) => ({
      shifts: [{
        id: orderNum(c.tenantId) % 10000,
        opened_at: c.now, closed_at: c.now, opening_float: 100, cash_total: 33,
        card_total: 0, other_total: 0, status: "closed", operator: "demo", _seed: true,
      }],
    }),
  },
  {
    key: "settings", file: "settings.json", kind: "object",
    build: (c) => ({
      numTables: 12, currency: "EUR", language: "it", timezone: "Europe/Rome",
      restaurantName: c.restaurantName, _seed: true,
    }),
  },
];

module.exports = { MODULE_SIGNATURES, menuSignature };
