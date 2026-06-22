const { getGlobalJson, setGlobalJson } = require("../../repositories/mysql/tenant-module.mysql");
const { createResellerApi } = require("./reseller.repository.logic");

const ACCOUNTS_KEY = "reseller-accounts";
const SESSIONS_KEY = "reseller-sessions";

const api = createResellerApi({
  readAccounts: () => getGlobalJson(ACCOUNTS_KEY, { accounts: [] }),
  writeAccounts: (data) => setGlobalJson(ACCOUNTS_KEY, data),
  readSessions: () => getGlobalJson(SESSIONS_KEY, { sessions: [] }),
  writeSessions: (data) => setGlobalJson(SESSIONS_KEY, data),
});

module.exports = api;
