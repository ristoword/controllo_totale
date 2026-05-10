const archiveService = require("../service/archive.service");
const archiveRepository = require("../repositories/archive.repository");

exports.getFinancial = async (req, res) => {
  const from = String(req.query.from || "").slice(0, 10);
  const to = String(req.query.to || "").slice(0, 10);
  const groupBy = String(req.query.groupBy || "day").toLowerCase();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return res.status(400).json({ error: "Parametri from e to richiesti (YYYY-MM-DD)" });
  }
  if (from > to) return res.status(400).json({ error: "from deve essere <= to" });
  const data = await archiveService.getFinancialSeries({ from, to, groupBy });
  res.json(data);
};

exports.getCompareMonth = async (req, res) => {
  const yearA = Number(req.query.yearA);
  const yearB = Number(req.query.yearB);
  const month = Number(req.query.month);
  if (!yearA || !yearB || !month || month < 1 || month > 12) {
    return res.status(400).json({ error: "yearA, yearB, month (1-12) obbligatori" });
  }
  const data = await archiveService.getCompareMonth({ yearA, yearB, month });
  res.json(data);
};

exports.listOrders = async (req, res) => {
  const from = req.query.from ? String(req.query.from).slice(0, 10) : null;
  const to = req.query.to ? String(req.query.to).slice(0, 10) : null;
  const limit = Math.min(2000, Math.max(1, Number(req.query.limit) || 500));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const data = await archiveService.listServedOrders({ from, to, limit, offset });
  res.json(data);
};

exports.hideOrder = async (req, res) => {
  await archiveService.hideOrderFromArchive(req.params.id);
  res.json({ ok: true });
};

exports.unhideOrder = async (req, res) => {
  await archiveService.unhideOrderFromArchive(req.params.id);
  res.json({ ok: true });
};

exports.listCassaInvoices = async (req, res) => {
  const list = await archiveService.listCassaInvoices();
  res.json({ invoices: list });
};

exports.postCassaInvoice = async (req, res) => {
  const inv = await archiveService.addCassaInvoice(req.body || {});
  res.status(201).json(inv);
};

exports.syncCassaInvoices = async (req, res) => {
  const { invoices } = req.body || {};
  const r = await archiveService.syncCassaInvoicesBulk(invoices);
  res.json(r);
};

exports.listPurchase = async (req, res) => {
  const list = await archiveService.listPurchaseIncoming();
  res.json({ items: list });
};

exports.postPurchase = async (req, res) => {
  const body = req.body || {};
  let buf = null;
  let ext = "bin";
  if (body.fileBase64 && typeof body.fileBase64 === "string") {
    const raw = body.fileBase64.includes(",") ? body.fileBase64.split(",")[1] : body.fileBase64;
    try {
      buf = Buffer.from(raw, "base64");
    } catch {
      return res.status(400).json({ error: "fileBase64 non valido" });
    }
    const fn = String(body.fileName || "allegato");
    const m = fn.match(/\.([a-z0-9]+)$/i);
    ext = m ? m[1].toLowerCase().slice(0, 8) : "bin";
  }
  const row = await archiveService.addPurchaseIncoming(body, buf, ext);
  res.status(201).json(row);
};

exports.deletePurchase = async (req, res) => {
  const r = await archiveService.removePurchaseIncoming(req.params.id);
  if (!r.ok) return res.status(404).json({ error: "Non trovato" });
  res.json({ ok: true });
};

exports.downloadPurchaseFile = async (req, res) => {
  const store = await archiveRepository.readStore();
  const item = (store.purchaseIncoming || []).find((x) => String(x.id) === String(req.params.id));
  if (!item || !item.attachmentPath) return res.status(404).end();
  const data = await archiveRepository.readAttachmentRelative(item.attachmentPath);
  if (!data) return res.status(404).end();
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${String(item.invoiceNumber || item.id)}.bin"`);
  res.send(data);
};
