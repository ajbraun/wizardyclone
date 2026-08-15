"use strict";
function rnd(n) { return Math.floor(Math.random() * n); }
function d(n) { return rnd(n) + 1; }
function dice(s) {
  if (typeof s === "number") return s;
  const m = /^(\d*)d(\d+)([+-]\d+)?$/.exec(s);
  if (!m) return parseInt(s, 10) || 0;
  const c = +(m[1] || 1), f = +m[2], b = +(m[3] || 0);
  let t = b;
  for (let i = 0; i < c; i++) t += d(f);
  return Math.max(0, t);
}
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function pick(arr) { return arr[rnd(arr.length)]; }
function pct(p) { return rnd(100) < p; }
function pickWeighted(table) {
  let total = 0;
  for (const [, w] of table) total += w;
  let r = rnd(total);
  for (const [id, w] of table) { r -= w; if (r < 0) return id; }
  return table[0][0];
}
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function pad(s, n) { s = String(s); return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length); }
function padl(s, n) { s = String(s); return s.length >= n ? s : " ".repeat(n - s.length) + s; }
