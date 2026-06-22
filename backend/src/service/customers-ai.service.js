const customersRepository = require("../repositories/customers.repository");

function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
}

function isThisMonth(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth();
}

function hasAllergies(c) {
  return (Array.isArray(c.allergies) && c.allergies.length) || (Array.isArray(c.intolerances) && c.intolerances.length);
}

async function buildSnapshot() {
  const customers = await customersRepository.getAll();
  const vip = customers.filter((c) => c.category === "vip");
  const withAllergies = customers.filter(hasAllergies);
  const inactiveVip = vip.filter((c) => {
    const days = daysSince(c.lastVisit);
    return days != null && days > 30;
  });
  const totalSpent = customers.reduce((s, c) => s + (Number(c.totalSpent) || 0), 0);
  const avgSpend = customers.length ? Math.round(totalSpent / customers.length) : 0;
  const newThisMonth = customers.filter((c) => isThisMonth(c.createdAt)).length;

  const atRisk = customers
    .filter((c) => {
      const days = daysSince(c.lastVisit);
      return (c.category === "vip" || c.category === "habitue") && days != null && days > 21;
    })
    .slice(0, 8)
    .map((c) => ({
      id: c.id,
      name: `${c.name} ${c.surname}`.trim(),
      category: c.category,
      lastVisit: c.lastVisit,
      daysSinceVisit: daysSince(c.lastVisit),
    }));

  const allergyAlerts = withAllergies.slice(0, 10).map((c) => ({
    id: c.id,
    name: `${c.name} ${c.surname}`.trim(),
    allergies: [...(c.allergies || []), ...(c.intolerances || [])],
  }));

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      total: customers.length,
      vip: vip.length,
      habitue: customers.filter((c) => c.category === "habitue").length,
      walkin: customers.filter((c) => c.category === "walkin").length,
      nuovo: customers.filter((c) => c.category === "nuovo").length,
      avgSpend,
      newThisMonth,
      withAllergies: withAllergies.length,
      inactiveVip: inactiveVip.length,
    },
    atRisk,
    allergyAlerts,
    topSpenders: [...customers]
      .sort((a, b) => (Number(b.totalSpent) || 0) - (Number(a.totalSpent) || 0))
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        name: `${c.name} ${c.surname}`.trim(),
        totalSpent: Number(c.totalSpent) || 0,
        visits: Number(c.visits) || 0,
        category: c.category,
      })),
  };
}

function buildTemplateInsights(snapshot) {
  const s = snapshot.summary || {};
  const lines = [
    `Analisi CRM: ${s.total} clienti in anagrafica.`,
    `VIP: ${s.vip}, habitué: ${s.habitue}, nuovi questo mese: ${s.newThisMonth}.`,
    `Spesa media per cliente: circa € ${s.avgSpend}.`,
  ];
  if (s.inactiveVip > 0) {
    lines.push(`Attenzione: ${s.inactiveVip} clienti VIP senza visita da oltre 30 giorni — valuta un contatto personalizzato.`);
  }
  if (s.withAllergies > 0) {
    lines.push(`${s.withAllergies} clienti con allergie o intolleranze registrate: verifica sempre in sala e in cucina.`);
  }
  if (snapshot.atRisk && snapshot.atRisk.length) {
    lines.push(`A rischio churn: ${snapshot.atRisk.map((c) => c.name).join(", ")}.`);
  }
  return lines.join(" ");
}

async function buildInsights({ locale = "it", enhance = true } = {}) {
  const snapshot = await buildSnapshot();
  const template = buildTemplateInsights(snapshot);

  if (!enhance || !process.env.OPENAI_API_KEY) {
    return { snapshot, insights: template, source: "template" };
  }

  try {
    const OpenAI = require("openai");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const lang =
      locale === "en" ? "English" : locale === "de" ? "German" : locale === "fr" ? "French" : locale === "es" ? "Spanish" : locale === "nl" ? "Dutch" : "Italian";
    const res = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.35,
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content: `You are a restaurant CRM analyst. Write concise actionable insights in ${lang}. Use ONLY the JSON data. Mention VIP retention, allergies, and revenue opportunities. Max 4 short paragraphs.`,
        },
        { role: "user", content: JSON.stringify(snapshot) },
      ],
    });
    const aiText = res.choices?.[0]?.message?.content?.trim();
    return { snapshot, insights: aiText || template, source: aiText ? "ai" : "template" };
  } catch {
    return { snapshot, insights: template, source: "template" };
  }
}

module.exports = { buildSnapshot, buildInsights, buildTemplateInsights };
