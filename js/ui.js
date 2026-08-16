"use strict";
const UI = (() => {
  const logLines = [];
  const toastQ = [];
  function panel(html) { document.getElementById("panel").innerHTML = html; }
  function viewLabel(s) { document.getElementById("viewlabel").textContent = s || ""; }
  function renderToasts() {
    const el = document.getElementById("toasts");
    if (el) el.innerHTML = toastQ.map(t => `<div class="toast">${t}</div>`).join("");
  }
  function toast(html) {
    toastQ.push(html);
    if (toastQ.length > 4) toastQ.shift();
    renderToasts();
    if (typeof setTimeout === "function") {
      setTimeout(() => {
        const i = toastQ.indexOf(html);
        if (i >= 0) toastQ.splice(i, 1);
        renderToasts();
      }, 5000);
    }
  }
  function log(msg) {
    logLines.push(msg);
    if (logLines.length > 200) logLines.shift();
    const el = document.getElementById("log");
    el.innerHTML = logLines.slice(-6).map(esc).join("<br>");
  }
  function clearLog() { logLines.length = 0; document.getElementById("log").innerHTML = ""; }
  function key(k, label) { return `<span class="k">${k}</span>) ${label}`; }
  function statusStr(ch) {
    if (ch.status === "OK") return ch.hp < ch.maxhp / 4 ? '<span class="bad">OK</span>' : "OK";
    const cls = (ch.status === "DEAD" || ch.status === "ASHES") ? "bad" : "k";
    return `<span class="${cls}">${ch.status}</span>`;
  }
  function renderParty() {
    const rows = Game.party.map((ch, i) => {
      const spStr = spSummary(ch);
      return `<tr><td>${i + 1}</td><td class="hi">${esc(ch.name)}</td><td>${ch.align[0]}-${esc(ch.cls)}</td><td>${ch.level}</td><td>${acOf(ch)}</td><td>${ch.hp}/${ch.maxhp}</td><td>${spStr}</td><td>${statusStr(ch)}</td><td class="gold">${ch.gold}</td></tr>`;
    }).join("");
    document.getElementById("party").innerHTML = Game.party.length
      ? `<table><tr><th>#</th><th>NAME</th><th>CLASS</th><th>LVL</th><th>AC</th><th>HITS</th><th>SP</th><th>STATUS</th><th>GOLD</th></tr>${rows}</table>`
      : '<div class="dim" style="padding:4px">** NO PARTY — visit Gilgamesh\'s Tavern **</div>';
  }
  function spSummary(ch) {
    const parts = [];
    for (const b of ["mage", "priest"]) {
      const arr = ch.sp[b];
      if (arr.some(v => v > 0) || knownBooks(ch)[b]) {
        const tot = arr.reduce((a, v) => a + v, 0);
        if (knownBooks(ch)[b]) parts.push(`${b[0].toUpperCase()}${tot}`);
      }
    }
    return parts.join("/") || "-";
  }
  function charSheet(ch) {
    const st = STATS.map(s => `${pad(s, 4)}${padl(ch.stats[s], 3)}`).join("   ");
    const items = ch.items.length
      ? ch.items.map((it, i) => {
          const def = ITEMS[it.id];
          const usable = canUseItem(ch, it.id) ? "" : " #";
          return `  ${i + 1}) ${it.eq ? "*" : " "}${esc(def.name)}${usable}`;
        }).join("\n")
      : "  (no items)";
    const spells = knownSpells(ch);
    const spellStr = spells.length ? spells.join(", ") : "(none)";
    const sps = ["mage", "priest"].filter(b => knownBooks(ch)[b])
      .map(b => `${b.toUpperCase()} SP: ${ch.sp[b].map((v, i) => maxSP(ch, b, i + 1) ? v : "-").join("/")}`)
      .join("\n");
    const skills = (ch.skills || []).map(s => {
      const def = SKILLS[s.id];
      return `${def ? def.name : s.id} L${s.level}`;
    }).join(", ");
    return `<span class="hi">${esc(ch.name)}</span>  L${ch.level} ${ch.align} ${esc(ch.race)} ${esc(ch.cls)}\n\n` +
      `${st}\n\n` +
      `HP ${ch.hp}/${ch.maxhp}   AC ${acOf(ch)}   STATUS ${ch.status}\n` +
      `XP ${ch.xp}  (next level: ${xpForLevel(ch.cls, ch.level + 1)})   <span class="gold">GOLD ${ch.gold}</span>\n\n` +
      (sps ? sps + "\n" : "") +
      `SPELLS: ${esc(spellStr)}\n` +
      `SKILLS: ${esc(skills || "(none yet — the System is watching)")}\n\n` +
      `ITEMS (* = equipped, # = can't use):\n${items}`;
  }
  return { panel, log, clearLog, key, renderParty, charSheet, viewLabel, toast };
})();
