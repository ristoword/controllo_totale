// Router: JSON (default) oppure MySQL se USE_MYSQL_DATABASE=true.

const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./closures.repository.json");
const mysql = require("./mysql/closures.repository.mysql");
const { normalizeClosureInput } = require("./closures.repository.helpers");

function impl() {
  return useMysqlPersistence() ? mysql : json;
}

async function createClosure(payload) {
  const result = await impl().createClosure(payload);
  try {
    const dayOpenRepository = require("./day-open.repository");
    const d = result?.date || payload?.date;
    if (d) await dayOpenRepository.clearIfDateMatches(String(d).slice(0, 10));
  } catch (e) {
    console.warn("[closures] clear day_open:", e?.message || e);
  }
  return result;
}

module.exports = {
  CLOSURES_FILE: json.CLOSURES_FILE,
  ensureClosuresFile: async () => {
    if (!useMysqlPersistence()) await json.ensureClosuresFile();
  },
  readAllClosures: (...a) => impl().readAllClosures(...a),
  writeAllClosures: (...a) => impl().writeAllClosures(...a),
  createClosure,
  listClosures: (...a) => impl().listClosures(...a),
  getClosureByDate: (...a) => impl().getClosureByDate(...a),
  getClosureById: (...a) => impl().getClosureById(...a),
  isDayClosed: (...a) => impl().isDayClosed(...a),
  normalizeClosureInput,
};
