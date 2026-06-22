#!/usr/bin/env node
/**
 * Merge keys from it.json into all locale files (missing keys → copy from en, then it).
 * Run from backend/: node scripts/sync-i18n-locales.js
 */
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "../public/i18n");
const langs = ["it", "en", "de", "fr", "es", "nl"];

const it = JSON.parse(fs.readFileSync(path.join(dir, "it.json"), "utf8"));
const en = JSON.parse(fs.readFileSync(path.join(dir, "en.json"), "utf8"));

for (const lang of langs) {
  const fp = path.join(dir, lang + ".json");
  const current = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, "utf8")) : {};
  const merged = { ...current };
  for (const key of Object.keys(it)) {
    if (merged[key] === undefined) {
      merged[key] = lang === "it" ? it[key] : en[key] || it[key];
    }
  }
  const ordered = {};
  for (const key of Object.keys(it)) {
    if (merged[key] !== undefined) ordered[key] = merged[key];
  }
  for (const key of Object.keys(merged)) {
    if (ordered[key] === undefined) ordered[key] = merged[key];
  }
  fs.writeFileSync(fp, JSON.stringify(ordered, null, 2) + "\n", "utf8");
  console.log("[i18n] synced", lang, Object.keys(ordered).length, "keys");
}
