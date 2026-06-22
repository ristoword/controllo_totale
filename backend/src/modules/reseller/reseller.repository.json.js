const fs = require("fs");
const path = require("path");

const { safeReadJson, atomicWriteJson } = require("../../utils/safeFileIO");
const paths = require("../../config/paths");
const { createResellerApi } = require("./reseller.repository.logic");

const DATA_DIR = path.join(paths.DATA, "resellers");
const ACCOUNTS_FILE = path.join(DATA_DIR, "accounts.json");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const api = createResellerApi({
  readAccounts: async () => safeReadJson(ACCOUNTS_FILE, { accounts: [] }),
  writeAccounts: async (data) => {
    ensureDir();
    atomicWriteJson(ACCOUNTS_FILE, data);
  },
  readSessions: async () => safeReadJson(SESSIONS_FILE, { sessions: [] }),
  writeSessions: async (data) => {
    ensureDir();
    atomicWriteJson(SESSIONS_FILE, data);
  },
});

module.exports = api;
