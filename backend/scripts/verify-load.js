#!/usr/bin/env node
/**
 * Carica src/app senza avviare il server: verifica sintassi e require chain.
 * Uso: npm test
 */
process.env.NODE_ENV = process.env.NODE_ENV || "test";
require("../src/app");
console.log("[verify-load] OK");
