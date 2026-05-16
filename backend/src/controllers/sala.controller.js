// backend/src/controllers/sala.controller.js
const repo = require("../repositories/sala-tables.repository");
const { broadcastNote } = require("../service/websocket.service");

const VALID_STATI = ["libero", "aperto", "conto", "sporco"];
const DEFAULT_TABLE_COUNT = 10;

async function seedDefaults() {
  const cols = 5;
  const leftPad = 12, topPad = 18, colStep = 15, rowStep = 22;
  const created = [];
  for (let i = 1; i <= DEFAULT_TABLE_COUNT; i++) {
    const row = Math.floor((i - 1) / cols);
    const col = (i - 1) % cols;
    const t = await repo.createTable({
      nome: `T${i}`,
      posti: 4,
      x: leftPad + col * colStep,
      y: topPad + row * rowStep,
      forma: i % 3 === 0 ? "tondo" : "quadrato",
    });
    created.push(t);
  }
  return created;
}

exports.listTables = async (req, res) => {
  let tables = await repo.listTables();
  if (!Array.isArray(tables) || tables.length === 0) {
    tables = await seedDefaults();
  }
  res.json(tables);
};

exports.createTable = async (req, res) => {
  const { nome, posti, x, y, forma } = req.body || {};
  if (!nome) return res.status(400).json({ error: "Campo nome obbligatorio" });
  const table = await repo.createTable({ nome, posti, x, y, forma });
  res.status(201).json(table);
};

exports.updateTable = async (req, res) => {
  const { id } = req.params;
  const patch = req.body || {};
  const updated = await repo.updateTable(id, patch);
  if (!updated) return res.status(404).json({ error: "Tavolo non trovato" });
  res.json(updated);
};

exports.patchStatus = async (req, res) => {
  const { id } = req.params;
  const { stato } = req.body || {};
  if (!stato || !VALID_STATI.includes(stato)) {
    return res.status(400).json({ error: `stato deve essere uno di: ${VALID_STATI.join(", ")}` });
  }
  const updated = await repo.patchStatus(id, stato);
  if (!updated) return res.status(404).json({ error: "Tavolo non trovato" });
  res.json(updated);
};

exports.deleteTable = async (req, res) => {
  const { id } = req.params;
  const ok = await repo.deleteTable(id);
  if (!ok) return res.status(404).json({ error: "Tavolo non trovato" });
  res.json({ ok: true });
};

exports.sendNote = async (req, res) => {
  const { table, department, text } = req.body || {};
  if (!department) return res.status(400).json({ error: "Campo department obbligatorio" });
  const user = req.session?.user;
  broadcastNote({
    table: table || "",
    department,
    text: text || "",
    from: user?.name || user?.username || "Sala",
    sentAt: new Date().toISOString(),
  });
  res.json({ ok: true });
};
