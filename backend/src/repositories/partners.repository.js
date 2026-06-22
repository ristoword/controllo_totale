const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./partners.repository.json");
const mysql = require("./partners.repository.mysql");

function impl() {
  return useMysqlPersistence() ? mysql : json;
}

module.exports = {
  readAll: (...a) => impl().readAll(...a),
  writeAll: (...a) => impl().writeAll(...a),
  getByCode: (...a) => impl().getByCode(...a),
};
