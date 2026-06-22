#!/usr/bin/env node
/**
 * Carica src/app senza avviare il server: verifica sintassi e require chain.
 * Uso: npm test
 */
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.VERIFY_LOAD_ONLY = "1";

require("../src/config/loadEnv").loadEnv();

const crypto = require("crypto");
if (!process.env.SESSION_SECRET || !String(process.env.SESSION_SECRET).trim()) {
  process.env.SESSION_SECRET = crypto.randomBytes(32).toString("hex");
}

require("../src/app");
console.log("[verify-load] OK");
process.exit(0);
