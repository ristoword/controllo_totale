"use strict";

const proposalsRepo = require("../repositories/ai-proposals.repository");
const aiAssistantService = require("../service/ai-assistant.service");

exports.list = async (req, res) => {
  const { status, type } = req.query;
  const proposals = await proposalsRepo.list({ status, type });
  res.json(proposals);
};

exports.getById = async (req, res) => {
  const p = await proposalsRepo.getById(req.params.id);
  if (!p) return res.status(404).json({ error: "Proposta non trovata" });
  res.json(p);
};

exports.generate = async (req, res) => {
  const { context, type } = req.body || {};
  const proposalType = type || "general";

  try {
    let analysisData = {};
    try {
      const [status, brain] = await Promise.all([
        aiAssistantService.getOperationalStatus(),
        aiAssistantService.getDailyBrain(),
      ]);
      analysisData = { status, brain };
    } catch (_) {}

    const suggestions = [];

    if (analysisData.brain) {
      const b = analysisData.brain;
      if (b.lowStockAlerts && b.lowStockAlerts.length > 0) {
        suggestions.push({
          type: "inventory",
          title: "Riordino scorte basse",
          description: `${b.lowStockAlerts.length} prodotti sotto la scorta minima. Consigliato riordino immediato.`,
          impact: "high",
          data: { items: b.lowStockAlerts },
        });
      }
      if (b.topDishes && b.topDishes.length > 0) {
        suggestions.push({
          type: "menu",
          title: "Ottimizzazione menu basata su vendite",
          description: `I piatti più venduti sono: ${b.topDishes.slice(0, 3).map((d) => d.name).join(", ")}. Considera di promuoverli nel menu del giorno.`,
          impact: "medium",
          data: { topDishes: b.topDishes.slice(0, 5) },
        });
      }
    }

    if (analysisData.status) {
      const s = analysisData.status;
      if (s.lateOrders > 0) {
        suggestions.push({
          type: "operations",
          title: "Ordini in ritardo",
          description: `${s.lateOrders} ordini in ritardo. Suggerimento: verificare colli di bottiglia in cucina.`,
          impact: "high",
          data: { lateOrders: s.lateOrders },
        });
      }
    }

    if (suggestions.length === 0) {
      suggestions.push({
        type: proposalType,
        title: "Analisi operativa OK",
        description: "Nessun intervento urgente rilevato. Continua a monitorare.",
        impact: "low",
        data: { context: context || "routine-check" },
      });
    }

    const created = [];
    for (const s of suggestions) {
      created.push(await proposalsRepo.create(s));
    }

    res.json({ generated: created.length, proposals: created });
  } catch (err) {
    res.status(500).json({
      error: "generate_error",
      message: err.message || "Errore nella generazione proposte AI",
    });
  }
};

exports.review = async (req, res) => {
  const { status, notes } = req.body || {};
  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ error: "Stato non valido. Usa 'approved' o 'rejected'" });
  }
  const p = await proposalsRepo.review(req.params.id, status, notes);
  if (!p) return res.status(404).json({ error: "Proposta non trovata" });
  res.json(p);
};

exports.apply = async (req, res) => {
  const existing = await proposalsRepo.getById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Proposta non trovata" });
  if (existing.status !== "approved") {
    return res.status(400).json({ error: "Solo proposte approvate possono essere applicate" });
  }
  const p = await proposalsRepo.apply(req.params.id);
  res.json(p);
};

exports.schedule = async (req, res) => {
  const { scheduledFor } = req.body || {};
  if (!scheduledFor) {
    return res.status(400).json({ error: "Specificare 'scheduledFor' (data/ora)" });
  }
  const p = await proposalsRepo.schedule(req.params.id, scheduledFor);
  if (!p) return res.status(404).json({ error: "Proposta non trovata" });
  res.json(p);
};

exports.remove = async (req, res) => {
  const ok = await proposalsRepo.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: "Proposta non trovata" });
  res.json({ success: true });
};
