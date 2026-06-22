/**
 * Cutover JSON → MySQL: con `true`, moduli migrati (users, restaurants, licenses, ordini, pagamenti, chiusure,
 * report salvati, storni, turni cassa, **menu** / `tenant_menus`, magazzino `inventory`, **cantina**, …) usano MySQL.
 * Dati globali in `tenant_module_data` (__global__): partners, reseller-accounts, reseller-sessions.
 * Migrazione dati: npm run migrate:mysql -- --step=… (cantina/resellers/partners dopo restaurants).
 */

function useMysqlPersistence() {
  return String(process.env.USE_MYSQL_DATABASE || "").toLowerCase() === "true";
}

module.exports = {
  useMysqlPersistence,
};
