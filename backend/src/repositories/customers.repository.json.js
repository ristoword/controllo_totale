const paths = require("../config/paths");
const tenantContext = require("../context/tenantContext");
const { loadJsonArray, saveJsonArray } = require("../utils/fileStore");
const { createCustomersApi } = require("./customers.repository.logic");

function getDataPath() {
  return paths.tenant(tenantContext.getRestaurantId(), "customers.json");
}

const api = createCustomersApi({
  loadCustomers: async () => loadJsonArray(getDataPath()),
  saveCustomers: async (list) => saveJsonArray(getDataPath(), list),
});

module.exports = { ...api };
