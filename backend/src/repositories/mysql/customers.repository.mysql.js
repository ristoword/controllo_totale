const { getJson, setJson } = require("./tenant-module.mysql");
const { createCustomersApi } = require("../customers.repository.logic");

const MODULE_KEY = "customers";

const api = createCustomersApi({
  loadCustomers: async () => {
    const data = await getJson(MODULE_KEY, []);
    return Array.isArray(data) ? data : [];
  },
  saveCustomers: async (list) => setJson(MODULE_KEY, list),
});

module.exports = { ...api };
