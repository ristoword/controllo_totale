/**
 * Variabili Stripe (Price ID da Dashboard Stripe).
 * Priorità: nomi Controllo Totale → alias brevi CT → legacy Ristoword (stesso account Stripe prodotti esistenti).
 */
function priceMonthly() {
  const v =
    process.env.STRIPE_PRICE_CONTROLLO_TOTALE_MONTHLY ||
    process.env.STRIPE_PRICE_CT_MONTHLY ||
    process.env.STRIPE_PRICE_RISTOWORD_MONTHLY ||
    "";
  return String(v).trim();
}

function priceAnnual() {
  const v =
    process.env.STRIPE_PRICE_CONTROLLO_TOTALE_ANNUAL ||
    process.env.STRIPE_PRICE_CT_ANNUAL ||
    process.env.STRIPE_PRICE_RISTOWORD_YEARLY ||
    "";
  return String(v).trim();
}

module.exports = {
  priceMonthly,
  priceAnnual,
};
