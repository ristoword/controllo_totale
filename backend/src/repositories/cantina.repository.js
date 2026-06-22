const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./cantina.repository.json");

function impl() {
  return json;
}

module.exports = {
  list: (...a) => impl().list(...a),
  getById: (...a) => impl().getById(...a),
  create: (...a) => impl().create(...a),
  update: (...a) => impl().update(...a),
  remove: (...a) => impl().remove(...a),
  adjustStock: (...a) => impl().adjustStock(...a),
  COLORS: json.COLORS,
};
