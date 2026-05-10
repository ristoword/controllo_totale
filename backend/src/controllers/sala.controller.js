// backend/src/controllers/sala.controller.js
const repo = require("../repositories/sala-tables.repository");

const VALID_STATI = ["libero", "aperto", "conto", "sporco"];

exports.listTables = async (req, res) => {
  res.json(repo.listTables());
};

exports.createTable = async (req, res) => {
  const { nome, posti, x, y, forma } = req.body || {};
  if (!nome) return res.status(400).json({ error: "Campo nome obbligatorio" });
  const table = repo.createTable({ nome, posti, x, y, forma });
  res.status(201).json(table);
};

exports.updateTable = async (req, res) => {
  const { id } = req.params;
  const patch = req.body || {};
  const updated = repo.updateTable(id, patch);
  if (!updated) return res.status(404).json({ error: "Tavolo non trovato" });
  res.json(updated);
};

exports.patchStatus = async (req, res) => {
  const { id } = req.params;
  const { stato } = req.body || {};
  if (!stato || !VALID_STATI.includes(stato)) {
    return res.status(400).json({ error: `stato deve essere uno di: ${VALID_STATI.join(", ")}` });
  }
  const updated = repo.patchStatus(id, stato);
  if (!updated) return res.status(404).json({ error: "Tavolo non trovato" });
  res.json(updated);
};

exports.deleteTable = async (req, res) => {
  const { id } = req.params;
  const ok = repo.deleteTable(id);
  if (!ok) return res.status(404).json({ error: "Tavolo non trovato" });
  res.json({ ok: true });
};
