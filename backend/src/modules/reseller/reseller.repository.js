const { useMysqlPersistence } = require("../../config/mysqlPersistence");
const json = require("./reseller.repository.json");
const mysql = require("./reseller.repository.mysql");

function impl() {
  return useMysqlPersistence() ? mysql : json;
}

module.exports = {
  createAccount: (...a) => impl().createAccount(...a),
  verifyLogin: (...a) => impl().verifyLogin(...a),
  createSessionToken: (...a) => impl().createSessionToken(...a),
  verifySessionToken: (...a) => impl().verifySessionToken(...a),
  touchSession: (...a) => impl().touchSession(...a),
  deleteSessionToken: (...a) => impl().deleteSessionToken(...a),
  getAccountByPartnerCode: (...a) => impl().getAccountByPartnerCode(...a),
  listAccounts: (...a) => impl().listAccounts(...a),
  seedFromEnv: (...a) => impl().seedFromEnv(...a),
};
