const crypto = require("crypto");
function generateId() {
  return crypto.randomUUID();
}

function shortId(length = 8) {
  return crypto.randomUUID()
    .replace(/-/g, "")
    .substring(0, length);
}

function numericId() {
  const now = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return Number(`${now}${random}`);
}

module.exports = {
  generateId,
  shortId,
  numericId
};

