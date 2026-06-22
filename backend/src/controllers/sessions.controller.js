"use strict";

const { useMysqlPersistence } = require("../config/mysqlPersistence");

exports.list = async (req, res) => {
  const currentSessionId = req.sessionID;
  const currentUserId = req.session?.user?.id;

  if (!useMysqlPersistence()) {
    return res.json({
      sessions: [{
        id: currentSessionId,
        current: true,
        user: req.session?.user?.username || "—",
        createdAt: null,
        expiresAt: null,
      }],
      total: 1,
    });
  }

  try {
    const { getPool } = require("../db/mysql-pool");
    const pool = getPool();
    const [rows] = await pool.query(
      "SELECT session_id, data, expires FROM sessions ORDER BY expires DESC LIMIT 100"
    );

    const sessions = (rows || []).map((row) => {
      let parsed = {};
      try {
        parsed = typeof row.data === "string" ? JSON.parse(row.data) : row.data || {};
      } catch (_) {}

      const user = parsed.user || {};
      return {
        id: row.session_id,
        current: row.session_id === currentSessionId,
        user: user.username || "—",
        userId: user.id || null,
        role: user.role || null,
        restaurantId: user.restaurantId || null,
        expiresAt: row.expires ? new Date(row.expires * 1000).toISOString() : null,
      };
    });

    const own = currentUserId
      ? sessions.filter((s) => s.userId === currentUserId || !s.userId)
      : sessions;

    res.json({ sessions: own, total: own.length });
  } catch (err) {
    res.status(500).json({
      error: "sessions_error",
      message: err.message || "Errore nel recupero sessioni",
    });
  }
};

exports.revoke = async (req, res) => {
  const targetId = req.params.id;
  if (targetId === req.sessionID) {
    return res.status(400).json({ error: "Non puoi revocare la sessione corrente. Usa logout." });
  }

  if (!useMysqlPersistence()) {
    return res.status(501).json({ error: "Revoca sessioni disponibile solo con MySQL" });
  }

  try {
    const { getPool } = require("../db/mysql-pool");
    const pool = getPool();
    const [result] = await pool.query("DELETE FROM sessions WHERE session_id = ?", [targetId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Sessione non trovata" });
    }
    res.json({ success: true, revoked: targetId });
  } catch (err) {
    res.status(500).json({
      error: "revoke_error",
      message: err.message || "Errore nella revoca sessione",
    });
  }
};
