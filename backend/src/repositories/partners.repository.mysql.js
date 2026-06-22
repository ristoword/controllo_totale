const { getGlobalJson, setGlobalJson } = require("./mysql/tenant-module.mysql");

const MODULE_KEY = "partners";

async function readAll() {
  const raw = await getGlobalJson(MODULE_KEY, { partners: [] });
  return Array.isArray(raw.partners) ? raw.partners : [];
}

async function writeAll(partners) {
  await setGlobalJson(MODULE_KEY, { partners });
}

async function getByCode(code) {
  const list = await readAll();
  return list.find((p) => p.code === code) || null;
}

module.exports = { readAll, writeAll, getByCode };
