/**
 * Identità prodotto Controllo Totale (SaaS multi-locale).
 * Override con APP_NAME / APP_VERSION nel .env (Railway, Docker, ecc.).
 */
function trimEnv(key, fallback) {
  const v = process.env[key];
  if (v == null || String(v).trim() === "") return fallback;
  return String(v).trim();
}

function getAppName() {
  return trimEnv("APP_NAME", "Controllo Totale");
}

function getAppShortName() {
  return trimEnv("APP_SHORT_NAME", "CT");
}

/** Versione build / release (health, API). */
function getAppVersion() {
  return trimEnv("APP_VERSION", trimEnv("RISTOWORD_VERSION", "controllo-totale-dev"));
}

/** Slug URL / billing (Stripe metadata). */
function getProductSlug() {
  return trimEnv("PRODUCT_SLUG", "controllo-totale");
}

function getLogPrefix() {
  return `[${getAppName()}]`;
}

/** JSON per health / client bootstrap. */
function getProductInfo() {
  return {
    name: getAppName(),
    shortName: getAppShortName(),
    slug: getProductSlug(),
    version: getAppVersion(),
    tagline: "Gestionale ristorazione multi-locale · SaaS",
    saas: true,
  };
}

module.exports = {
  getAppName,
  getAppShortName,
  getAppVersion,
  getProductSlug,
  getLogPrefix,
  getProductInfo,
};
