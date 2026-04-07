/**
 * Schedario fornitori: anagrafica, tipologie prodotto, ordini, fatture, archivio.
 * Persistenza tramite load/save dello stato completo { suppliers: [...] }.
 */

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function parseISODate(s) {
  if (!s || typeof s !== "string") return null;
  const d = s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const t = Date.parse(d + "T12:00:00");
  return Number.isFinite(t) ? t : null;
}

function effectiveInvoiceStatus(inv) {
  const amount = Number(inv.amount) || 0;
  const paid = Number(inv.paidAmount) || 0;
  if (amount > 0 && paid >= amount) return "paid";
  const due = parseISODate(inv.dueDate);
  if (due != null && paid < amount) {
    const today = parseISODate(todayISODate());
    if (today != null && due < today) return "overdue";
  }
  return inv.status === "paid" ? "paid" : "open";
}

function normalizeSupplier(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  const orders = Array.isArray(s.orders) ? s.orders.map(normalizeOrder) : [];
  const invoices = Array.isArray(s.invoices) ? s.invoices.map(normalizeInvoice) : [];
  return {
    id: s.id,
    companyName: String(s.companyName || "").trim(),
    legalName: String(s.legalName || "").trim(),
    vatId: String(s.vatId || "").trim(),
    fiscalCode: String(s.fiscalCode || "").trim(),
    address: String(s.address || "").trim(),
    city: String(s.city || "").trim(),
    cap: String(s.cap || "").trim(),
    province: String(s.province || "").trim(),
    country: String(s.country || "IT").trim(),
    phone: String(s.phone || "").trim(),
    email: String(s.email || "").trim(),
    pec: String(s.pec || "").trim(),
    sdi: String(s.sdi || "").trim(),
    iban: String(s.iban || "").trim(),
    bankName: String(s.bankName || "").trim(),
    paymentTerms: String(s.paymentTerms || "").trim(),
    notes: String(s.notes || "").trim(),
    productTypes: Array.isArray(s.productTypes)
      ? s.productTypes.map((x) => String(x || "").trim()).filter(Boolean)
      : [],
    defaultDiscountType: ["none", "percent", "amount"].includes(s.defaultDiscountType)
      ? s.defaultDiscountType
      : "none",
    defaultDiscountValue: Number(s.defaultDiscountValue) || 0,
    orders,
    invoices,
    archived: Boolean(s.archived),
    createdAt: s.createdAt || new Date().toISOString(),
    updatedAt: s.updatedAt || new Date().toISOString(),
  };
}

function normalizeOrder(o) {
  const x = o && typeof o === "object" ? o : {};
  return {
    id: String(x.id || "").trim() || `ord-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    orderDate: String(x.orderDate || "").slice(0, 10),
    reference: String(x.reference || "").trim(),
    itemsSummary: String(x.itemsSummary || "").trim(),
    totalAmount: Number(x.totalAmount) || 0,
    status: String(x.status || "completed").trim() || "completed",
    notes: String(x.notes || "").trim(),
    createdAt: x.createdAt || new Date().toISOString(),
  };
}

function normalizeInvoice(x) {
  const inv = x && typeof x === "object" ? x : {};
  const base = {
    id: String(inv.id || "").trim() || `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    number: String(inv.number || "").trim(),
    issueDate: String(inv.issueDate || "").slice(0, 10),
    dueDate: String(inv.dueDate || "").slice(0, 10),
    paidDate: String(inv.paidDate || "").slice(0, 10),
    amount: Number(inv.amount) || 0,
    paidAmount: Number(inv.paidAmount) || 0,
    status: ["paid", "open", "overdue"].includes(inv.status) ? inv.status : "open",
    discountType: ["none", "percent", "amount"].includes(inv.discountType) ? inv.discountType : "none",
    discountValue: Number(inv.discountValue) || 0,
    notes: String(inv.notes || "").trim(),
    createdAt: inv.createdAt || new Date().toISOString(),
    updatedAt: inv.updatedAt || new Date().toISOString(),
  };
  base.status = effectiveInvoiceStatus(base);
  return base;
}

function normalizeState(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  const list = Array.isArray(data.suppliers) ? data.suppliers : [];
  return {
    version: Number(data.version) || 1,
    suppliers: list.map(normalizeSupplier),
  };
}

function nextSupplierId(suppliers) {
  const ids = suppliers.map((s) => Number(s.id)).filter((n) => Number.isFinite(n) && n > 0);
  return ids.length ? Math.max(...ids) + 1 : 1;
}

function findSupplierIndex(suppliers, id) {
  return suppliers.findIndex((s) => String(s.id) === String(id));
}

/**
 * @param {{ load: () => Promise<unknown>, save: (state: object) => Promise<void> }} store
 */
function createSuppliersApi(store) {
  async function readState() {
    const raw = await store.load();
    return normalizeState(raw);
  }

  async function writeState(state) {
    const normalized = normalizeState(state);
    await store.save(normalized);
    return normalized;
  }

  async function list(opts = {}) {
    const mode = opts.archived === "only" || opts.archived === "all" ? opts.archived : "exclude";
    const { suppliers } = await readState();
    const filtered =
      mode === "only"
        ? suppliers.filter((s) => s.archived)
        : mode === "all"
          ? suppliers
          : suppliers.filter((s) => !s.archived);
    return filtered.map((s) => {
      const n = normalizeSupplier(s);
      return {
        ...n,
        invoices: (n.invoices || []).map((inv) => ({
          ...inv,
          status: effectiveInvoiceStatus(inv),
        })),
      };
    });
  }

  async function getById(id) {
    const { suppliers } = await readState();
    const s = suppliers.find((x) => String(x.id) === String(id));
    if (!s) return null;
    const copy = normalizeSupplier(s);
    copy.invoices = copy.invoices.map((inv) => ({ ...inv, status: effectiveInvoiceStatus(inv) }));
    return copy;
  }

  async function create(data) {
    const state = await readState();
    const id = nextSupplierId(state.suppliers);
    const now = new Date().toISOString();
    const row = normalizeSupplier({
      ...data,
      id,
      orders: [],
      invoices: [],
      archived: false,
      createdAt: now,
      updatedAt: now,
    });
    if (!row.companyName) {
      const err = new Error("Ragione sociale obbligatoria");
      err.code = "VALIDATION";
      throw err;
    }
    state.suppliers.push(row);
    await writeState(state);
    return row;
  }

  async function update(id, updates) {
    const state = await readState();
    const idx = findSupplierIndex(state.suppliers, id);
    if (idx === -1) return null;
    const cur = state.suppliers[idx];
    const merged = normalizeSupplier({
      ...cur,
      ...updates,
      id: cur.id,
      orders: updates.orders != null ? updates.orders : cur.orders,
      invoices: updates.invoices != null ? updates.invoices : cur.invoices,
      createdAt: cur.createdAt,
      updatedAt: new Date().toISOString(),
    });
    state.suppliers[idx] = merged;
    await writeState(state);
    return merged;
  }

  async function archive(id) {
    return update(id, { archived: true });
  }

  async function restore(id) {
    return update(id, { archived: false });
  }

  async function addOrder(supplierId, payload) {
    const state = await readState();
    const idx = findSupplierIndex(state.suppliers, supplierId);
    if (idx === -1) return null;
    const s = state.suppliers[idx];
    const order = normalizeOrder(payload);
    s.orders = [...(s.orders || []), order];
    s.updatedAt = new Date().toISOString();
    state.suppliers[idx] = normalizeSupplier(s);
    await writeState(state);
    return order;
  }

  async function patchOrder(supplierId, orderId, payload) {
    const state = await readState();
    const idx = findSupplierIndex(state.suppliers, supplierId);
    if (idx === -1) return null;
    const s = state.suppliers[idx];
    const oi = (s.orders || []).findIndex((o) => String(o.id) === String(orderId));
    if (oi === -1) return null;
    const merged = normalizeOrder({ ...s.orders[oi], ...payload, id: s.orders[oi].id });
    s.orders[oi] = merged;
    s.updatedAt = new Date().toISOString();
    state.suppliers[idx] = normalizeSupplier(s);
    await writeState(state);
    return merged;
  }

  async function removeOrder(supplierId, orderId) {
    const state = await readState();
    const idx = findSupplierIndex(state.suppliers, supplierId);
    if (idx === -1) return false;
    const s = state.suppliers[idx];
    const before = (s.orders || []).length;
    s.orders = (s.orders || []).filter((o) => String(o.id) !== String(orderId));
    if (s.orders.length === before) return false;
    s.updatedAt = new Date().toISOString();
    state.suppliers[idx] = normalizeSupplier(s);
    await writeState(state);
    return true;
  }

  async function addInvoice(supplierId, payload) {
    const state = await readState();
    const idx = findSupplierIndex(state.suppliers, supplierId);
    if (idx === -1) return null;
    const s = state.suppliers[idx];
    const inv = normalizeInvoice(payload);
    inv.updatedAt = new Date().toISOString();
    s.invoices = [...(s.invoices || []), inv];
    s.updatedAt = new Date().toISOString();
    state.suppliers[idx] = normalizeSupplier(s);
    await writeState(state);
    return inv;
  }

  async function patchInvoice(supplierId, invoiceId, payload) {
    const state = await readState();
    const idx = findSupplierIndex(state.suppliers, supplierId);
    if (idx === -1) return null;
    const s = state.suppliers[idx];
    const ii = (s.invoices || []).findIndex((i) => String(i.id) === String(invoiceId));
    if (ii === -1) return null;
    const merged = normalizeInvoice({ ...s.invoices[ii], ...payload, id: s.invoices[ii].id });
    merged.updatedAt = new Date().toISOString();
    s.invoices[ii] = merged;
    s.updatedAt = new Date().toISOString();
    state.suppliers[idx] = normalizeSupplier(s);
    await writeState(state);
    return merged;
  }

  async function removeInvoice(supplierId, invoiceId) {
    const state = await readState();
    const idx = findSupplierIndex(state.suppliers, supplierId);
    if (idx === -1) return false;
    const s = state.suppliers[idx];
    const before = (s.invoices || []).length;
    s.invoices = (s.invoices || []).filter((i) => String(i.id) !== String(invoiceId));
    if (s.invoices.length === before) return false;
    s.updatedAt = new Date().toISOString();
    state.suppliers[idx] = normalizeSupplier(s);
    await writeState(state);
    return true;
  }

  /**
   * Totale pagamenti nel periodo (data pagamento; se manca, data fattura per righe pagate).
   */
  async function paymentSummary(supplierId, fromDate, toDate) {
    const s = await getById(supplierId);
    if (!s) return null;
    const from = fromDate ? String(fromDate).slice(0, 10) : null;
    const to = toDate ? String(toDate).slice(0, 10) : null;
    const fromT = from ? parseISODate(from) : null;
    const toT = to ? parseISODate(to) : null;

    let totalPaid = 0;
    let countPaid = 0;
    let countOpen = 0;
    let countOverdue = 0;
    const lines = [];

    for (const inv of s.invoices || []) {
      const st = effectiveInvoiceStatus(inv);
      if (st === "open") countOpen += 1;
      else if (st === "overdue") countOverdue += 1;
      else if (st === "paid") countPaid += 1;

      const paid = Number(inv.paidAmount) || 0;
      if (paid <= 0) continue;
      const payDay = inv.paidDate && String(inv.paidDate).slice(0, 10);
      const fallbackDay = inv.issueDate && String(inv.issueDate).slice(0, 10);
      const refDate = payDay || (st === "paid" ? fallbackDay : "");
      if (!refDate) continue;
      const refT = parseISODate(refDate);
      if (refT == null) continue;
      if (fromT != null && refT < fromT) continue;
      if (toT != null && refT > toT) continue;
      totalPaid += paid;
      lines.push({
        invoiceId: inv.id,
        number: inv.number,
        paidAmount: paid,
        date: refDate,
      });
    }

    return {
      supplierId: s.id,
      companyName: s.companyName,
      from: from || null,
      to: to || null,
      totalPaid,
      countPaid,
      countOpen,
      countOverdue,
      invoiceLines: lines,
    };
  }

  return {
    list,
    getById,
    create,
    update,
    archive,
    restore,
    addOrder,
    patchOrder,
    removeOrder,
    addInvoice,
    patchInvoice,
    removeInvoice,
    paymentSummary,
  };
}

module.exports = {
  createSuppliersApi,
  effectiveInvoiceStatus,
};
