"use strict";

const purchaseOrdersRepo = require("../repositories/purchase-orders.repository");

exports.list = async (req, res) => {
  const { status, supplierId } = req.query;
  const orders = await purchaseOrdersRepo.list({ status, supplierId });
  res.json(orders);
};

exports.getById = async (req, res) => {
  const po = await purchaseOrdersRepo.getById(req.params.id);
  if (!po) return res.status(404).json({ error: "Ordine non trovato" });
  res.json(po);
};

exports.create = async (req, res) => {
  const po = await purchaseOrdersRepo.create(req.body);
  res.status(201).json(po);
};

exports.update = async (req, res) => {
  const po = await purchaseOrdersRepo.update(req.params.id, req.body);
  if (!po) return res.status(404).json({ error: "Ordine non trovato" });
  res.json(po);
};

exports.updateStatus = async (req, res) => {
  const { status } = req.body;
  if (!purchaseOrdersRepo.VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: "Stato non valido", valid: purchaseOrdersRepo.VALID_STATUSES });
  }
  const po = await purchaseOrdersRepo.updateStatus(req.params.id, status);
  if (!po) return res.status(404).json({ error: "Ordine non trovato" });
  res.json(po);
};

exports.receive = async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Specificare items ricevuti" });
  }
  const po = await purchaseOrdersRepo.receive(req.params.id, items);
  if (!po) return res.status(404).json({ error: "Ordine non trovato" });

  if (po.status === "ricevuto" || po.status === "parziale") {
    try {
      const inventoryRepository = require("../repositories/inventory.repository");
      for (const ri of items) {
        if (!ri.name || !ri.receivedQty) continue;
        const inv = await inventoryRepository.getAll();
        const match = (inv || []).find(
          (i) => String(i.name || "").toLowerCase() === String(ri.name || "").toLowerCase()
        );
        if (match) {
          await inventoryRepository.adjustQuantity(match.id, Number(ri.receivedQty) || 0);
        }
      }
    } catch (_) {}
  }

  res.json(po);
};

exports.archive = async (req, res) => {
  const po = await purchaseOrdersRepo.archive(req.params.id);
  if (!po) return res.status(404).json({ error: "Ordine non trovato" });
  res.json(po);
};

exports.remove = async (req, res) => {
  const ok = await purchaseOrdersRepo.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: "Ordine non trovato" });
  res.json({ success: true });
};

exports.report = async (req, res) => {
  const data = await purchaseOrdersRepo.report(req.query);
  res.json(data);
};

exports.email = async (req, res) => {
  const po = await purchaseOrdersRepo.getById(req.params.id);
  if (!po) return res.status(404).json({ error: "Ordine non trovato" });

  const itemsList = (po.items || [])
    .map((i) => `- ${i.name}: ${i.quantity} ${i.unit || "pz"}`)
    .join("\n");

  const body = [
    `Ordine Acquisto #${po.id.slice(0, 8)}`,
    `Data: ${new Date(po.createdAt).toLocaleDateString("it-IT")}`,
    `Fornitore: ${po.supplierName}`,
    "",
    "Prodotti:",
    itemsList,
    "",
    po.notes ? `Note: ${po.notes}` : "",
    "",
    `Totale stimato: € ${(po.total || 0).toFixed(2)}`,
  ].join("\n");

  res.json({
    to: req.body.email || "",
    subject: `Ordine #${po.id.slice(0, 8)} — ${po.supplierName}`,
    body,
    po,
  });
};
