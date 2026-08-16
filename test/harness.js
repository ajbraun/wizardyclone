"use strict";
// Headless boot harness: loads the game into a vm sandbox with a stubbed DOM,
// canvas, and localStorage, and exposes keyboard-driven play.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ROOT = path.join(__dirname, "..");
const FILES = ["util.js", "events.js", "data.js", "maps.js", "char.js", "render.js", "ui.js", "town.js", "maze.js", "combat.js", "achievements.js", "main.js"];

function boot(opts) {
  opts = opts || {};
  const noop = () => {};
  const ctx2d = new Proxy({}, { get: (t, p) => (p === "canvas" ? {} : noop), set: () => true });
  const els = {};
  const listeners = { document: {}, window: {} };
  const store = opts.store || {};
  const sandbox = {
    console, Math, JSON, Array, Object, Set, Map, parseInt, parseFloat, String, Number, RegExp, isFinite,
    document: {
      getElementById: id => (els[id] = els[id] || { innerHTML: "", textContent: "", getContext: () => ctx2d }),
      addEventListener: (ev, fn) => { listeners.document[ev] = fn; },
    },
    window: { addEventListener: (ev, fn) => { listeners.window[ev] = fn; } },
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
    },
  };
  vm.createContext(sandbox);
  const files = opts.files || FILES;
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(ROOT, "js", f), "utf8"), sandbox, { filename: f });
  if (files.includes("main.js")) listeners.window.load();
  const press = k => listeners.document.keydown({ key: k, metaKey: false, ctrlKey: false, altKey: false, preventDefault: noop });
  return {
    sandbox, els, store, press,
    type: s => { for (const c of s) press(c); },
    get: expr => vm.runInContext("(" + expr + ")", sandbox),
    run: code => vm.runInContext(code, sandbox),
  };
}

function makeChecker(name) {
  let fails = 0;
  return {
    assert(cond, msg) { if (!cond) { fails++; console.log("FAIL: " + msg); } },
    done() {
      console.log(fails ? `\n${name}: ${fails} FAILURES` : `\n${name}: PASSED`);
      process.exit(fails ? 1 : 0);
    },
  };
}
module.exports = { boot, makeChecker, ROOT };
