const suppliersRepository = require("../repositories/suppliers.repository");

exports.list = async (req, res) => {
  const archived = (req.query.archived || "").toLowerCase();
  const mode = archived === "only" || archived === "all" ? archived : "exclude";
  const data = await suppliersRepository.list({ archived: mode });
  res.json(data);
};

exports.getById = async (req, res) => {
  const item = await suppliersRepository.getById(req.params.id);
  if (!item) {
    return res.status(404).json({ error: "Fornitore non trovato" });
  }
  res.json(item);
};

exports.create = async (req, res) => {
  try {
    const item = await suppliersRepository.create(req.body || {});
    res.status(201).json(item);
  } catch (e) {
    if (e && e.code === "VALIDATION") {
      return res.status(400).json({ error: e.message || "Dati non validi" });
    }
    throw e;
  }
};

exports.update = async (req, res) => {
  const item = await suppliersRepository.update(req.params.id, req.body || {});
  if (!item) {
    return res.status(404).json({ error: "Fornitore non trovato" });
  }
  res.json(item);
};

exports.archive = async (req, res) => {
  const item = await suppliersRepository.archive(req.params.id);
  if (!item) {
    return res.status(404).json({ error: "Fornitore non trovato" });
  }
  res.json(item);
};

exports.restore = async (req, res) => {
  const item = await suppliersRepository.restore(req.params.id);
  if (!item) {
    return res.status(404).json({ error: "Fornitore non trovato" });
  }
  res.json(item);
};

exports.paymentSummary = async (req, res) => {
  const { from, to } = req.query || {};
  const summary = await suppliersRepository.paymentSummary(req.params.id, from, to);
  if (!summary) {
    return res.status(404).json({ error: "Fornitore non trovato" });
  }
  res.json(summary);
};

exports.addOrder = async (req, res) => {
  const order = await suppliersRepository.addOrder(req.params.id, req.body || {});
  if (!order) {
    return res.status(404).json({ error: "Fornitore non trovato" });
  }
  res.status(201).json(order);
};

exports.patchOrder = async (req, res) => {
  const order = await suppliersRepository.patchOrder(req.params.id, req.params.orderId, req.body || {});
  if (!order) {
    return res.status(404).json({ error: "Ordine o fornitore non trovato" });
  }
  res.json(order);
};

exports.removeOrder = async (req, res) => {
  const ok = await suppliersRepository.removeOrder(req.params.id, req.params.orderId);
  if (!ok) {
    return res.status(404).json({ error: "Ordine o fornitore non trovato" });
  }
  res.json({ ok: true });
};

exports.addInvoice = async (req, res) => {
  const inv = await suppliersRepository.addInvoice(req.params.id, req.body || {});
  if (!inv) {
    return res.status(404).json({ error: "Fornitore non trovato" });
  }
  res.status(201).json(inv);
};

exports.patchInvoice = async (req, res) => {
  const inv = await suppliersRepository.patchInvoice(req.params.id, req.params.invoiceId, req.body || {});
  if (!inv) {
    return res.status(404).json({ error: "Fattura o fornitore non trovato" });
  }
  res.json(inv);
};

exports.removeInvoice = async (req, res) => {
  const ok = await suppliersRepository.removeInvoice(req.params.id, req.params.invoiceId);
  if (!ok) {
    return res.status(404).json({ error: "Fattura o fornitore non trovato" });
  }
  res.json({ ok: true });
};
