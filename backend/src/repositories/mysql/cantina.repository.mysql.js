const { getJson, setJson } = require("./tenant-module.mysql");
const { createCantinaApi, COLORS } = require("../cantina.repository.logic");

const MODULE_KEY = "cantina";

const api = createCantinaApi({
  loadWines: () => getJson(MODULE_KEY, []),
  saveWines: (list) => setJson(MODULE_KEY, list),
});

module.exports = { ...api, COLORS };
