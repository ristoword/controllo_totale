const cantinaRepository = require("../repositories/cantina.repository");
const cantinaAiService = require("../service/cantina-ai.service");

exports.list = async (req, res) => {
  await cantinaRepository.seedIfEmpty();
  let wines = await cantinaRepository.list({
    q: req.query.q,
    color: req.query.color,
    country: req.query.country,
  });
  if (!wines.length) {
    await cantinaRepository.seedIfEmpty();
    wines = await cantinaRepository.list({
      q: req.query.q,
      color: req.query.color,
      country: req.query.country,
    });
  }
  res.json(wines);
};

exports.getById = async (req, res) => {
  const wine = await cantinaRepository.getById(req.params.id);
  if (!wine) return res.status(404).json({ error: "Vino non trovato" });
  res.json(wine);
};

exports.create = async (req, res) => {
  try {
    const wine = await cantinaRepository.create(req.body || {});
    res.status(201).json(wine);
  } catch (e) {
    res.status(400).json({ error: e.message || "Errore creazione" });
  }
};

exports.update = async (req, res) => {
  const wine = await cantinaRepository.update(req.params.id, req.body || {});
  if (!wine) return res.status(404).json({ error: "Vino non trovato" });
  res.json(wine);
};

exports.remove = async (req, res) => {
  const ok = await cantinaRepository.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: "Vino non trovato" });
  res.json({ ok: true });
};

exports.adjustStock = async (req, res) => {
  const delta = Number((req.body || {}).delta);
  if (!Number.isFinite(delta)) return res.status(400).json({ error: "delta obbligatorio" });
  const wine = await cantinaRepository.adjustStock(req.params.id, delta);
  if (!wine) return res.status(404).json({ error: "Vino non trovato" });
  res.json(wine);
};

exports.aiSnapshot = async (_req, res) => {
  await cantinaRepository.seedIfEmpty();
  const snapshot = await cantinaAiService.buildSnapshot();
  res.json(snapshot);
};
