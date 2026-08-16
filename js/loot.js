"use strict";
// ================================================================ LOOT
// Item instances and affixes. An inventory entry may be {id, eq} (plain base
// item) or {id, eq, affixes: [affixId...]}. IT(entry) resolves the effective
// stats; everything that reads an item goes through it.

const AFFIXES = {
  // weapons
  KEEN:     { name: "Keen",            pos: "pre", slots: ["weapon"], mods: { crit: 3 }, price: 300 },
  BRUTAL:   { name: "Brutal",          pos: "pre", slots: ["weapon"], dmgPlus: 2, price: 350 },
  EMBER:    { name: "of Embers",       pos: "suf", slots: ["weapon"], dmgPlus: 1, price: 200 },
  SOLDIER:  { name: "of the Soldier",  pos: "suf", slots: ["weapon"], mods: { toHit: 2 }, price: 250 },
  HEADSMAN: { name: "of the Headsman", pos: "suf", slots: ["weapon"], dmgPlus: 1, mods: { crit: 2 }, price: 450 },
  // armor / shield / helm
  STURDY:   { name: "Sturdy",          pos: "pre", slots: ["armor", "shield", "helm"], ac: 1, price: 200 },
  WARDING:  { name: "of Warding",      pos: "suf", slots: ["armor", "shield", "helm"], ac: 2, price: 400 },
  CAT:      { name: "of the Cat",      pos: "suf", slots: ["armor", "shield", "helm"], mods: { runChance: 10 }, price: 150 },
  GILDED:   { name: "Gilded",          pos: "pre", slots: ["armor", "shield", "helm"], mods: { goldGain: 10 }, price: 250 },
  GRACE:    { name: "of Grace",        pos: "suf", slots: ["armor", "shield", "helm"], mods: { healPower: 2 }, price: 250 },
  SAGE:     { name: "of the Sage",     pos: "suf", slots: ["armor", "shield", "helm"], mods: { spellPower: 2 }, price: 250 },
  FORTUNE:  { name: "of Fortune",      pos: "suf", slots: ["armor", "shield", "helm", "weapon"], mods: { crit: 2, goldGain: 5 }, price: 300 },
};

function addDiceBonus(spec, plus) {
  const m = /^(\d*d\d+)([+-]\d+)?$/.exec(spec);
  if (!m) return spec;
  const b = (+(m[2] || 0)) + plus;
  return m[1] + (b > 0 ? "+" + b : b < 0 ? String(b) : "");
}

// resolve an inventory entry to effective stats (base + affixes)
function IT(entry) {
  const base = ITEMS[entry.id];
  if (!entry.affixes || !entry.affixes.length) return base;
  const out = Object.assign({}, base);
  out.mods = Object.assign({}, base.mods);
  let pre = "", suf = "";
  for (const aid of entry.affixes) {
    const a = AFFIXES[aid];
    if (!a) continue;
    if (a.dmgPlus && out.dmg) out.dmg = addDiceBonus(out.dmg, a.dmgPlus);
    if (a.ac) out.ac = (out.ac || 0) + a.ac;
    for (const k of Object.keys(a.mods || {})) out.mods[k] = (out.mods[k] || 0) + a.mods[k];
    out.price += a.price;
    if (a.pos === "pre") pre = a.name + " " + pre;
    else suf += " " + a.name;
  }
  out.name = pre + base.name + suf;
  return out;
}

// depth-banded base pools for generated loot
const LOOT_BASES = {
  1: ["DAGGER", "STAFF", "SHORTSWORD", "MACE", "ROBES", "LEATHER", "SMALLSHIELD"],
  2: ["SHORTSWORD", "LONGSWORD", "FLAIL", "CHAINMAIL", "LARGESHIELD", "HELM"],
  3: ["LONGSWORD", "FLAIL", "BREASTPLATE", "PLATEMAIL", "LARGESHIELD", "HELM"],
};

// quality 0..3 raises affix count; depth raises the base pool band
function generateItem(depth, quality) {
  if (pct(20)) return { id: pick(["P_DIOS", "P_LATUMOFIS"]), eq: false };
  const band = clamp(Math.ceil(depth / 2), 1, 3);
  const pool = LOOT_BASES[band].concat(band > 1 ? LOOT_BASES[band - 1] : []);
  const id = pick(pool);
  const slot = ITEMS[id].slot;
  const n = clamp(quality - 1 + rnd(3), 0, 3);
  const eligible = Object.keys(AFFIXES).filter(a => AFFIXES[a].slots.includes(slot));
  const affixes = [];
  for (let i = 0; i < n && eligible.length; i++) {
    const aid = pick(eligible);
    eligible.splice(eligible.indexOf(aid), 1);
    affixes.push(aid);
  }
  const entry = { id, eq: false };
  if (affixes.length) entry.affixes = affixes;
  return entry;
}

const BOX_TIERS = {
  BRONZE:   { gold: "4d10", mult: 5,   items: 1, q: 0 },
  SILVER:   { gold: "6d10", mult: 10,  items: 1, q: 1 },
  GOLD:     { gold: "8d10", mult: 20,  items: 1, q: 2 },
  PLATINUM: { gold: "10d10", mult: 40, items: 2, q: 3 },
  CELESTIAL:{ gold: "10d10", mult: 100, items: 3, q: 3 },
};

function openLootBox(tier, depthArg) {
  const t = BOX_TIERS[tier];
  if (!t) return;
  const depth = depthArg || Game.counters.maxDepth || 1;
  const gold = dice(t.gold) * t.mult;
  const up = Game.party.filter(isUp);
  const share = Math.floor(gold / Math.max(1, up.length));
  up.forEach(c => grantGold(c, share, "achievement"));
  const got = [];
  const holder = up[0];
  if (holder) {
    for (let i = 0; i < t.items; i++) {
      const entry = generateItem(depth, t.q);
      holder.items.push(entry);
      got.push(IT(entry).name);
    }
  }
  Events.emit("lootbox", { tier, gold, items: got.length });
  UI.log(`[SYSTEM] ${tier} LOOT BOX: ${gold} gold${got.length ? ` — ${got.join(", ")}` : ""}!`);
  UI.toast(`<b>${tier} LOOT BOX</b><br><span class="gold">${gold} gold</span>${got.length ? `<br>${esc(got.join(", "))}` : ""}`);
  UI.renderParty();
}
