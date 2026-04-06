const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./day-open.repository.json");
const mysql = require("./day-open.repository.mysql");

function impl() {
  return useMysqlPersistence() ? mysql : json;
}

module.exports = {
  ensureOpenForToday: (...a) => impl().ensureOpenForToday(...a),
  clearIfDateMatches: (...a) => impl().clearIfDateMatches(...a),
};
