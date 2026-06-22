const cantinaRepository = require("../repositories/cantina.repository");

function marginPct(wine) {
  const sale = Number(wine.salePrice) || 0;
  const buy = Number(wine.purchasePrice) || 0;
  if (sale <= 0) return 0;
  return Math.round(((sale - buy) / sale) * 100);
}

async function buildSnapshot() {
  const wines = await cantinaRepository.list();
  const active = wines.filter((w) => w.active !== false);
  const lowStock = active.filter((w) => (Number(w.stock) || 0) <= 3 && (Number(w.stock) || 0) > 0);
  const outOfStock = active.filter((w) => (Number(w.stock) || 0) === 0);
  const margins = active
    .map((w) => ({ id: w.id, name: w.name, producer: w.producer, marginPct: marginPct(w), stock: w.stock }))
    .sort((a, b) => b.marginPct - a.marginPct);

  const pricingSuggestions = active
    .filter((w) => marginPct(w) < 55 && (Number(w.salePrice) || 0) > 0)
    .slice(0, 5)
    .map((w) => ({
      id: w.id,
      name: w.name,
      currentMargin: marginPct(w),
      suggestion: "Valuta aumento prezzo vendita o revisione costo acquisto",
    }));

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      total: active.length,
      lowStock: lowStock.length,
      outOfStock: outOfStock.length,
      totalBottles: active.reduce((s, w) => s + (Number(w.stock) || 0), 0),
      avgMarginPct: margins.length
        ? Math.round(margins.reduce((s, m) => s + m.marginPct, 0) / margins.length)
        : 0,
    },
    lowStock,
    outOfStock,
    topMargins: margins.slice(0, 5),
    pricingSuggestions,
  };
}

function snapshotToPrompt(snapshot) {
  const s = snapshot.summary || {};
  return [
    "CONTESTO CANTINA (dati reali):",
    `- Vini in carta: ${s.total}`,
    `- Bottiglie totali: ${s.totalBottles}`,
    `- Sotto scorta (≤3): ${s.lowStock}`,
    `- Esauriti: ${s.outOfStock}`,
    `- Margine medio: ${s.avgMarginPct}%`,
  ].join("\n");
}

module.exports = { buildSnapshot, snapshotToPrompt, marginPct };
