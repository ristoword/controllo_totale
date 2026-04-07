const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./suppliers.repository.json");
const mysql = require("./mysql/suppliers.repository.mysql");

function impl() {
  return useMysqlPersistence() ? mysql : json;
}

module.exports = {
  list: (...a) => impl().list(...a),
  getById: (...a) => impl().getById(...a),
  create: (...a) => impl().create(...a),
  update: (...a) => impl().update(...a),
  archive: (...a) => impl().archive(...a),
  restore: (...a) => impl().restore(...a),
  addOrder: (...a) => impl().addOrder(...a),
  patchOrder: (...a) => impl().patchOrder(...a),
  removeOrder: (...a) => impl().removeOrder(...a),
  addInvoice: (...a) => impl().addInvoice(...a),
  patchInvoice: (...a) => impl().patchInvoice(...a),
  removeInvoice: (...a) => impl().removeInvoice(...a),
  paymentSummary: (...a) => impl().paymentSummary(...a),
};
