/**
 * startupPasswordResets.js
 *
 * Resets user passwords at startup via environment variables.
 * Works with BOTH JSON and MySQL persistence (uses the repository router).
 *
 * ─── Supported env var formats ────────────────────────────────────────────
 *
 *   CT_RESET_PASS_<userId>=plainPassword
 *     → Resets user by numeric ID (JSON ids and MySQL auto-increment ids may
 *       differ; prefer the username format below for reliability).
 *
 *   CT_RESET_PASS_USER_<username>=plainPassword
 *     → Resets user by username (case-insensitive). Works regardless of DB id.
 *
 *   CT_RESET_PASS_OWNER_<restaurantId>=plainPassword
 *     → Resets the owner user of a specific restaurant by restaurantId.
 *       Most reliable when you know the tenant but not the exact username/id.
 *
 * ─── Example ──────────────────────────────────────────────────────────────
 *
 *   CT_RESET_PASS_OWNER_baia-verde=BaiaVerde2026!
 *   CT_RESET_PASS_USER_costantino=BaiaVerde2026!
 *   CT_RESET_PASS_10=BaiaVerde2026!   ← legacy (JSON id only)
 *
 * After reset, mustChangePassword=true forces the user to change on first login.
 * ──────────────────────────────────────────────────────────────────────────
 */

const bcrypt = require("bcrypt");
const BCRYPT_ROUNDS = 10;

async function runStartupPasswordResets() {
  const entries = Object.entries(process.env).filter(([k]) => k.startsWith("CT_RESET_PASS_"));
  if (entries.length === 0) return;

  // Lazy-load to allow server.js loadEnv() to run first
  let usersRepo;
  try {
    usersRepo = require("../repositories/users.repository");
  } catch (e) {
    console.warn("[startup-pass-reset] Could not load users.repository:", e.message);
    return;
  }

  const allUsers = await usersRepo.readUsers().catch(() => []);

  for (const [key, plain] of entries) {
    if (!plain || !plain.trim()) continue;

    const rest = key.slice("CT_RESET_PASS_".length); // e.g. "10", "USER_costantino", "OWNER_baia-verde"

    let user = null;
    let description = "";

    if (rest.startsWith("OWNER_")) {
      const restaurantId = rest.slice("OWNER_".length);
      user = allUsers.find(
        (u) =>
          u.role === "owner" &&
          String(u.restaurantId || "").toLowerCase() === restaurantId.toLowerCase()
      );
      description = `owner of restaurantId=${restaurantId}`;
    } else if (rest.startsWith("USER_")) {
      const username = rest.slice("USER_".length).toLowerCase();
      user = allUsers.find((u) => String(u.username || "").toLowerCase() === username);
      description = `username=${rest.slice("USER_".length)}`;
    } else {
      // Legacy: by numeric id
      const userId = rest;
      user = allUsers.find((u) => String(u.id) === String(userId));
      description = `id=${userId}`;
    }

    if (!user) {
      console.warn(`[startup-pass-reset] User not found for ${key} (${description}), skipping`);
      continue;
    }

    const hash = await bcrypt.hash(String(plain.trim()), BCRYPT_ROUNDS);
    const ok = await usersRepo.setUserPassword(user.id, hash, { mustChangePassword: true });
    if (ok) {
      console.log(
        `[startup-pass-reset] Password reset OK → ${description} (username=${user.username}, restaurantId=${user.restaurantId})`
      );
    } else {
      console.warn(`[startup-pass-reset] setUserPassword returned false for ${description}`);
    }
  }
}

module.exports = { runStartupPasswordResets };
