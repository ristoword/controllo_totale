/**
 * Variabili Stripe per Controllo Totale (Price ID da Dashboard Stripe).
 * Nomi dedicati — non usare prefissi di altri prodotti.
 */
function priceMonthly() {
  const v =
    process.env.STRIPE_PRICE_CONTROLLO_TOTALE_MONTHLY ||
    process.env.STRIPE_PRICE_CT_MONTHLY ||
    "";
  return String(v).trim();
}

function priceAnnual() {
  const v =
    process.env.STRIPE_PRICE_CONTROLLO_TOTALE_ANNUAL ||
    process.env.STRIPE_PRICE_CT_ANNUAL ||
    "";
  return String(v).trim();
}

module.exports = {
  priceMonthly,
  priceAnnual,
};
