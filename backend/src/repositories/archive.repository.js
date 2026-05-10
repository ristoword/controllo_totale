// backend/src/repositories/archive.repository.js
// Router: JSON (default) oppure MySQL se USE_MYSQL_DATABASE=true.

const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json  = require("./archive.repository.json");
const mysql = require("./mysql/archive.repository.mysql");

function impl() {
  return useMysqlPersistence() ? mysql : json;
}

module.exports = {
  readStore:               (...a) => impl().readStore(...a),
  writeStore:              (...a) => impl().writeStore(...a),
  createId:                (...a) => impl().createId(...a),
  saveAttachmentBuffer:    (...a) => impl().saveAttachmentBuffer(...a),
  readAttachmentRelative:  (...a) => impl().readAttachmentRelative(...a),
  getUploadsDir:           (...a) => impl().getUploadsDir(...a),
};
