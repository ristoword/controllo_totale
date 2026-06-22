const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./cantina.repository.json");
const mysql = require("./mysql/cantina.repository.mysql");

function impl() {
  return useMysqlPersistence() ? mysql : json;
}

module.exports = {
  list: (...a) => impl().list(...a),
  getById: (...a) => impl().getById(...a),
  create: (...a) => impl().create(...a),
  update: (...a) => impl().update(...a),
  remove: (...a) => impl().remove(...a),
  adjustStock: (...a) => impl().adjustStock(...a),
  seedIfEmpty: (...a) => impl().seedIfEmpty(...a),
  COLORS: json.COLORS,
};
