(function (root) {
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

  root.RW_TABLE_MATCH = { normalizeTableKey, tablesMatch };
})(typeof window !== "undefined" ? window : globalThis);
