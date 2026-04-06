/**
 * Stato giornata aperta su MySQL (tabella day_open_status).
 */

const tenantContext = require("../context/tenantContext");
const { getPool } = require("../db/mysql-pool");
const closuresRepository = require("./closures.repository");

function getRid() {
  return String(tenantContext.getRestaurantId() || tenantContext.DEFAULT_TENANT);
}

function sqlDateToStr(v) {
  if (v == null) return "";
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  return String(v).slice(0, 10);
}

async function ensureOpenForToday(dateStr, openedBy) {
  const d = String(dateStr || "").slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const rid = getRid();
  const pool = getPool();

  if (d !== today) {
    const [rows] = await pool.query(
      "SELECT business_date, opened_at, opened_by FROM day_open_status WHERE restaurant_id = ? LIMIT 1",
      [rid]
    );
    if (rows && rows.length) {
      const r = rows[0];
      const bd = sqlDateToStr(r.business_date);
      if (bd === d) {
        return {
          date: bd,
          openedAt: r.opened_at ? new Date(r.opened_at).toISOString() : null,
          openedBy: r.opened_by != null ? String(r.opened_by) : "",
        };
      }
    }
    return { date: d, openedAt: null, openedBy: null };
  }

  if (await closuresRepository.isDayClosed(d)) {
    return null;
  }

  const [existing] = await pool.query(
    "SELECT business_date, opened_at, opened_by FROM day_open_status WHERE restaurant_id = ? LIMIT 1",
    [rid]
  );
  if (existing && existing.length) {
    const r = existing[0];
    const bd = sqlDateToStr(r.business_date);
    if (bd === d) {
      return {
        date: bd,
        openedAt: r.opened_at ? new Date(r.opened_at).toISOString() : null,
        openedBy: r.opened_by != null ? String(r.opened_by) : "",
      };
    }
  }

  const now = new Date();
  const openedAtIso = now.toISOString();
  const by = openedBy || "system";
  await pool.query(
    `INSERT INTO day_open_status (restaurant_id, business_date, opened_at, opened_by)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE business_date = VALUES(business_date), opened_at = VALUES(opened_at), opened_by = VALUES(opened_by)`,
    [rid, d, now, by]
  );

  return { date: d, openedAt: openedAtIso, openedBy: by };
}

async function clearIfDateMatches(dateStr) {
  const d = String(dateStr || "").slice(0, 10);
  const rid = getRid();
  const pool = getPool();
  await pool.query(
    "DELETE FROM day_open_status WHERE restaurant_id = ? AND business_date = ?",
    [rid, d]
  );
}

module.exports = {
  ensureOpenForToday,
  clearIfDateMatches,
};
