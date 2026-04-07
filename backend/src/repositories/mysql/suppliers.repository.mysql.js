const { getJson, setJson } = require("./tenant-module.mysql");
const { createSuppliersApi } = require("../suppliers.repository.logic");

const MODULE_KEY = "suppliers";

module.exports = createSuppliersApi({
  load: () => getJson(MODULE_KEY, { suppliers: [] }),
  save: (state) => setJson(MODULE_KEY, state),
});
