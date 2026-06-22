#!/usr/bin/env node
/**
 * Inizializza ogni modulo tenant con una "signatura" demo (1 record minimo).
 * Scrive i JSON in data/tenants/{id}/ e opzionalmente importa su MySQL.
 *
 * Uso (da backend/):
 *   node scripts/db-seed-signatures.js
 *   node scripts/db-seed-signatures.js --dry-run
 *   node scripts/db-seed-signatures.js --force
 *   node scripts/db-seed-signatures.js --no-mysql
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const bcrypt = require("bcrypt");
const { loadEnv, getBackendRoot } = require("../src/config/loadEnv");
const paths = require("../src/config/paths");
const { safeReadJson, atomicWriteJson } = require("../src/utils/safeFileIO");
const { buildContext, countPayload } = require("./tenant-signatures/context");
const { MODULE_SIGNATURES } = require("./tenant-signatures/signatures");

loadEnv();

const DEMO_PASSWORD = "Demo2026!";
const DEMO_PASSWORD_HASH = bcrypt.hashSync(DEMO_PASSWORD, 10);

function parseArgs(argv) {
  return {
    dryRun: argv.includes("--dry-run"),
    force: argv.includes("--force"),
    noMysql: argv.includes("--no-mysql"),
    tenant: (() => {
      const a = argv.find((x) => x.startsWith("--tenant="));
      return a ? a.split("=").slice(1).join("=") : "";
    })(),
  };
}

function listTenants() {
  const fp = path.join(paths.DATA, "restaurants.json");
  const data = safeReadJson(fp, { restaurants: [] });
  const fromJson = (Array.isArray(data.restaurants) ? data.restaurants : [])
    .filter((r) => r.status !== "inactive" && r.id)
    .map((r) => ({ id: String(r.id), name: r.restaurantName || r.name || r.id }));

  const tenantsDir = path.join(paths.DATA, "tenants");
  const fromDirs = fs.existsSync(tenantsDir)
    ? fs.readdirSync(tenantsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith("."))
        .map((d) => ({ id: d.name, name: d.name }))
    : [];

  const map = new Map();
  [...fromJson, ...fromDirs].forEach((t) => map.set(t.id, t));
  return [...map.values()].filter((t) => t.id && t.id !== "__global__");
}

function readModuleFile(tenantId, file) {
  const fp = path.join(paths.DATA, "tenants", tenantId, file);
  if (!fs.existsSync(fp)) return null;
  return safeReadJson(fp, null);
}

function moduleIsEmpty(existing, kind) {
  if (existing == null) return true;
  return countPayload(existing, kind) === 0;
}

function seedDemoUser(tenantId, ctx, dryRun) {
  const usersPath = path.join(paths.DATA, "users.json");
  const data = safeReadJson(usersPath, { users: [] });
  if (!Array.isArray(data.users)) data.users = [];

  const hasDemo = data.users.some((u) => u.id === ctx.staffUserId);
  const hasStaff = data.users.some(
    (u) => String(u.restaurantId) === tenantId && String(u.role).toLowerCase() !== "owner"
  );
  if (hasDemo) return { skipped: true, reason: "utente demo già presente" };
  if (hasStaff) return { skipped: true, reason: "staff già presente nel tenant" };

  const user = {
    id: ctx.staffUserId,
    username: ctx.username,
    password: DEMO_PASSWORD_HASH,
    name: "Mario",
    surname: "Demo",
    email: `${ctx.username}@demo.local`,
    role: "sala",
    restaurantId: tenantId,
    is_active: true,
    mustChangePassword: true,
    hourlyRate: 12,
    employmentType: "part-time",
    leaveBalances: { ferieMaturate: 14, ferieUsate: 0, permessiUsati: 0, malattiaGiorni: 0 },
    createdAt: ctx.now,
    _seed: true,
  };

  if (dryRun) {
    console.info(`[seed][dry-run] user demo ${ctx.username} @ ${tenantId}`);
    return { created: true };
  }

  data.users.push(user);
  atomicWriteJson(usersPath, data);
  console.info(`[seed] utente demo ${ctx.username} (${ctx.staffUserId}) @ ${tenantId} — password: ${DEMO_PASSWORD}`);
  return { created: true };
}

function seedTenantModules(tenant, opts) {
  const { dryRun, force } = opts;
  const tenantDir = path.join(paths.DATA, "tenants", tenant.id);
  if (!fs.existsSync(tenantDir)) {
    if (dryRun) {
      console.info(`[seed][dry-run] creerei cartella tenants/${tenant.id}`);
    } else {
      fs.mkdirSync(tenantDir, { recursive: true });
    }
  }

  const ctx = buildContext(tenant.id, tenant.name);
  let written = 0;
  let skipped = 0;

  for (const mod of MODULE_SIGNATURES) {
    if (mod.key === "sessions") continue;

    const existing = readModuleFile(tenant.id, mod.file);
    const empty = moduleIsEmpty(existing, mod.kind);
    if (!empty && !force) {
      skipped += 1;
      continue;
    }
    if (!empty && force && existing) {
      const hasNonSeed = (() => {
        if (mod.kind === "array" && Array.isArray(existing)) {
          return existing.some((x) => !x._seed);
        }
        if (mod.kind === "records") return (existing.records || []).some((x) => !x._seed);
        if (mod.kind === "requests") return (existing.requests || []).some((x) => !x._seed);
        if (mod.kind === "suppliers") return (existing.suppliers || []).some((x) => !x._seed);
        if (mod.kind === "recipes") return (existing.recipes || []).some((x) => !x._seed);
        if (mod.kind === "devices") return (existing.devices || []).some((x) => !x._seed);
        if (mod.kind === "routes") return (existing.routes || []).some((x) => !x._seed);
        if (mod.kind === "tables") return (existing.tables || []).some((x) => !x._seed);
        if (mod.kind === "shifts") return (existing.shifts || []).some((x) => !x._seed);
        if (mod.kind === "reports") return (existing.reports || []).some((x) => !x._seed);
        if (mod.kind === "entries") return (existing.entries || []).some((x) => !x._seed);
        if (mod.kind === "dishes") return (existing.dishes || []).some((x) => !x._seed);
        return !existing._seed;
      })();
      if (hasNonSeed) {
        skipped += 1;
        continue;
      }
    }

    const payload = mod.build(ctx);
    const fp = path.join(tenantDir, mod.file);

    if (dryRun) {
      console.info(`[seed][dry-run] ${tenant.id}/${mod.file} (${mod.key})`);
      written += 1;
      continue;
    }

    atomicWriteJson(fp, payload);
    console.info(`[seed] ${tenant.id}/${mod.file}`);
    written += 1;
  }

  const userRes = seedDemoUser(tenant.id, ctx, dryRun);
  return { written, skipped, user: userRes };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  let tenants = listTenants();
  if (opts.tenant) {
    tenants = tenants.filter((t) => t.id === opts.tenant);
    if (!tenants.length) tenants = [{ id: opts.tenant, name: opts.tenant }];
  }

  console.info("[seed] Backend root:", getBackendRoot());
  console.info("[seed] Tenant:", tenants.map((t) => t.id).join(", "));
  if (opts.dryRun) console.info("[seed] Modalità dry-run");

  let totalWritten = 0;
  let totalSkipped = 0;

  for (const tenant of tenants) {
    console.info(`\n[seed] === ${tenant.id} (${tenant.name}) ===`);
    const res = seedTenantModules(tenant, opts);
    totalWritten += res.written;
    totalSkipped += res.skipped;
    if (res.user?.created) console.info(`[seed] utente demo creato`);
    else if (res.user?.skipped) console.info(`[seed] utente demo: ${res.user.reason}`);
  }

  console.info(`\n[seed] Moduli scritti: ${totalWritten}, saltati (già popolati): ${totalSkipped}`);

  if (!opts.dryRun && !opts.noMysql) {
    console.info("\n[seed] Import MySQL (migrate:mysql --step=all)...");
    try {
      execSync("npm run migrate:mysql -- --step=all", {
        cwd: getBackendRoot(),
        stdio: "inherit",
        env: process.env,
      });
    } catch (e) {
      console.error("[seed] Migrazione MySQL fallita:", e.message);
      process.exit(1);
    }
    console.info("[seed] Import MySQL completato.");
  }

  console.info("\n[seed] Fatto. Password utente demo:", DEMO_PASSWORD);
}

main().catch((e) => {
  console.error("[seed] ERRORE:", e.message || e);
  process.exit(1);
});
