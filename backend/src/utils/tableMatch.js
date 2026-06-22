/**
 * Confronto tavolo ordine ↔ riferimento sala/cassa.
 * "2", "T2", "t2" sono lo stesso tavolo.
 */
function normalizeTableKey(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "";
  const prefixed = raw.match(/^t(\d+)$/);
  if (prefixed) return prefixed[1];
  return raw;
}

function tablesMatch(orderTable, refTable) {
  const a = normalizeTableKey(orderTable);
  const b = normalizeTableKey(refTable);
  if (!a || !b) return false;
  return a === b;
}

module.exports = { normalizeTableKey, tablesMatch };
