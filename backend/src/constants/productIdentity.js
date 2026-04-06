/**
 * Identità prodotto Controllo Totale — costanti centralizzate.
 * Non usare nomi di altri progetti; integrazioni esterne usano GS_SYNC_SOURCE*.
 */

module.exports = {
  /** Piano / prodotto predefinito (metadata Stripe, licenze) */
  DEFAULT_PLAN_SLUG: "controllo_totale_pro",

  /** Identificativo inviato a servizi esterni (es. Gestione Semplificata) */
  GS_SYNC_SOURCE: "controllo_totale",
  GS_SYNC_SOURCE_BATCH: "controllo_totale_batch",
  GS_SYNC_SOURCE_STRIPE: "controllo_totale_stripe",

  /** Versione dev se manca APP_VERSION */
  DEV_VERSION_LABEL: "controllo-totale-dev",
};
