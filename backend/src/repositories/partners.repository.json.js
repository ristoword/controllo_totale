const path = require("path");
const fs = require("fs");

const paths = require("../config/paths");
const { safeReadJson, atomicWriteJson } = require("../utils/safeFileIO");

const PARTNERS_FILE = path.join(paths.DATA, "config", "partners.json");

async function readAll() {
  const raw = safeReadJson(PARTNERS_FILE, { partners: [] });
  return Array.isArray(raw.partners) ? raw.partners : [];
}

async function writeAll(partners) {
  const dir = path.dirname(PARTNERS_FILE);
  fs.mkdirSync(dir, { recursive: true });
  atomicWriteJson(PARTNERS_FILE, { partners });
}

async function getByCode(code) {
  const list = await readAll();
  return list.find((p) => p.code === code) || null;
}

module.exports = { readAll, writeAll, getByCode };
