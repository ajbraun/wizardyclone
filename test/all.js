"use strict";
// Run every test file in sequence: node test/all.js
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const tests = fs.readdirSync(__dirname).filter(f => f.endsWith(".js") && f !== "all.js" && f !== "harness.js");
let failed = 0;
for (const t of tests) {
  process.stdout.write(`== ${t} ==\n`);
  try {
    process.stdout.write(execFileSync("node", [path.join(__dirname, t)], { encoding: "utf8" }));
  } catch (e) {
    failed++;
    process.stdout.write((e.stdout || "") + (e.stderr || ""));
  }
}
console.log(failed ? `\n${failed} test file(s) FAILED` : "\nALL TEST FILES PASSED");
process.exit(failed ? 1 : 0);
