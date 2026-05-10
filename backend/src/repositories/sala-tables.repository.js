// backend/src/repositories/sala-tables.repository.js
// Router: JSON (default) oppure MySQL se USE_MYSQL_DATABASE=true.

const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json  = require("./sala-tables.repository.json");
const mysql = require("./mysql/sala-tables.repository.mysql");

function impl() {
  return useMysqlPersistence() ? mysql : json;
}

module.exports = {
  listTables:  (...a) => impl().listTables(...a),
  getTableById:(...a) => impl().getTableById(...a),
  createTable: (...a) => impl().createTable(...a),
  updateTable: (...a) => impl().updateTable(...a),
  deleteTable: (...a) => impl().deleteTable(...a),
  patchStatus: (...a) => impl().patchStatus(...a),
};
