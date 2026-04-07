const paths = require("../config/paths");
const tenantContext = require("../context/tenantContext");
const { safeReadJson, atomicWriteJson } = require("../utils/safeFileIO");
const { createSuppliersApi } = require("./suppliers.repository.logic");

function getDataPath() {
  return paths.tenant(tenantContext.getRestaurantId(), "suppliers.json");
}

module.exports = createSuppliersApi({
  load: async () => safeReadJson(getDataPath(), { suppliers: [] }),
  save: async (state) => {
    atomicWriteJson(getDataPath(), state);
  },
});
