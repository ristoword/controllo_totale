const paths = require("../config/paths");
const tenantContext = require("../context/tenantContext");
const { safeReadJson, atomicWriteJson } = require("../utils/safeFileIO");
const { createCantinaApi, COLORS } = require("./cantina.repository.logic");

function getDataPath() {
  return paths.tenant(tenantContext.getRestaurantId(), "cantina.json");
}

const api = createCantinaApi({
  loadWines: async () => safeReadJson(getDataPath(), []),
  saveWines: async (list) => atomicWriteJson(getDataPath(), list),
});

module.exports = { ...api, COLORS };
