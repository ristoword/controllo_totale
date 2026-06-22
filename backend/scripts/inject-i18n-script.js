#!/usr/bin/env node
/** Inject i18n.js into HTML pages that lack it */
const fs = require("fs");
const path = require("path");

const publicDir = path.join(__dirname, "../public");
const tag = '<script src="/js/i18n.js"></script>';

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const fp = path.join(dir, name);
    if (fs.statSync(fp).isDirectory()) walk(fp, out);
    else if (name.endsWith(".html")) out.push(fp);
  }
}

const files = [];
walk(publicDir, files);
let updated = 0;
for (const fp of files) {
  let html = fs.readFileSync(fp, "utf8");
  if (html.includes("i18n.js")) continue;
  if (html.includes("</body>")) {
    html = html.replace("</body>", "  " + tag + "\n</body>");
    fs.writeFileSync(fp, html, "utf8");
    updated++;
    console.log("[i18n] added to", path.relative(publicDir, fp));
  }
}
console.log("[i18n] updated", updated, "files");
