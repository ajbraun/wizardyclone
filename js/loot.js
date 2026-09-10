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
  STURDY:   { name: "Sturdy",          pos: "pre", slots: ["armor", "shield", "helm", "cloak"], ac: 1, price: 200 },
  WARDING:  { name: "of Warding",      pos: "suf", slots: ["armor", "shield", "helm", "cloak"], ac: 2, price: 400 },
  CAT:      { name: "of the Cat",      pos: "suf", slots: ["armor", "shield", "helm", "cloak"], mods: { runChance: 10 }, price: 150 },
  GILDED:   { name: "Gilded",          pos: "pre", slots: ["armor", "shield", "helm", "cloak"], mods: { goldGain: 10 }, price: 250 },
  GRACE:    { name: "of Grace",        pos: "suf", slots: ["armor", "shield", "helm", "cloak", "ring"], mods: { healPower: 2 }, price: 250 },
  SAGE:     { name: "of the Sage",     pos: "suf", slots: ["armor", "shield", "helm", "cloak", "ring"], mods: { spellPower: 2 }, price: 250 },
  FORTUNE:  { name: "of Fortune",      pos: "suf", slots: ["armor", "shield", "helm", "weapon", "cloak", "ring"], mods: { crit: 2, goldGain: 5 }, price: 300 },
  // accessories
  VIGOR:    { name: "of Vigor",        pos: "suf", slots: ["ring", "cloak"], mods: { maxhp: 5 }, price: 350 },
  AEGIS:    { name: "of the Aegis",    pos: "suf", slots: ["ring", "cloak"], mods: { resist: 15 }, price: 350 },
  // deep-crawl tiers — minDepth gates them out of the shallow pools
  RAZOR:     { name: "Razor",           pos: "pre", slots: ["weapon"], mods: { crit: 6 }, price: 700, minDepth: 9 },
  SAVAGE:    { name: "Savage",          pos: "pre", slots: ["weapon"], dmgPlus: 4, price: 900, minDepth: 11 },
  VAMPIRIC:  { name: "Vampiric",        pos: "pre", slots: ["weapon"], mods: { lifesteal: 2 }, price: 900, minDepth: 10 },
  TWINNED:   { name: "Twinned",         pos: "pre", slots: ["weapon"], mods: { swings: 1 }, price: 2500, minDepth: 15 },
  EVOKER:    { name: "of the Evoker",   pos: "suf", slots: ["weapon"], mods: { spellPower: 3 }, price: 500, minDepth: 7 },
  HUNTSMAN:  { name: "of the Huntsman", pos: "suf", slots: ["weapon"], dmgPlus: 1, mods: { toHit: 3 }, price: 700, minDepth: 8 },
  BULWARK:   { name: "Bulwark",         pos: "pre", slots: ["armor", "shield", "helm", "cloak"], ac: 3, price: 900, minDepth: 10 },
  STONESKIN: { name: "Stoneskin",       pos: "pre", slots: ["armor", "shield", "helm", "cloak"], ac: 2, mods: { maxhp: 4 }, price: 1100, minDepth: 12 },
  DRAKESCALE:{ name: "Drakescale",      pos: "pre", slots: ["armor", "shield", "helm", "cloak"], mods: { resist: 20 }, price: 700, minDepth: 8 },
  JUGGERNAUT:{ name: "of the Juggernaut", pos: "suf", slots: ["armor", "shield", "helm"], mods: { maxhp: 10 }, price: 1500, minDepth: 14 },
  BLOODED:   { name: "of the Blooded",  pos: "suf", slots: ["ring", "cloak"], mods: { maxhp: 8 }, price: 900, minDepth: 10 },
  SAVANT:    { name: "of the Savant",   pos: "suf", slots: ["ring", "cloak"], mods: { spellPower: 4 }, price: 1100, minDepth: 12 },
  MERCY:     { name: "of Mercy",        pos: "suf", slots: ["ring", "cloak"], mods: { healPower: 4 }, price: 1100, minDepth: 12 },
  PREDATOR:  { name: "of the Predator", pos: "suf", slots: ["ring", "cloak"], mods: { crit: 3, toHit: 2 }, price: 1200, minDepth: 13 },
  MAGNATE:   { name: "of the Magnate",  pos: "suf", slots: ["ring", "cloak", "helm"], mods: { goldGain: 20 }, price: 700, minDepth: 9 },
  SCHOLAR:   { name: "of the Scholar",  pos: "suf", slots: ["ring", "cloak", "helm"], mods: { xpGain: 10 }, price: 1000, minDepth: 11 },
  LOCKSMITH: { name: "of the Locksmith", pos: "suf", slots: ["ring", "cloak"], mods: { inspect: 15, disarm: 15 }, price: 400, minDepth: 6 },
  SUREFOOT:  { name: "Surefoot",        pos: "pre", slots: ["cloak", "armor"], mods: { runChance: 20 }, price: 300, minDepth: 6 },
};

// ---------------------------------------------------------------- uniques
// Named one-off items: fixed kit, a lore line, no affixes. Rare drops from
// high-quality rolls once you're deep enough to deserve them.
ITEMS.U_ARGUMENT  = { name: "The Argument", slot: "weapon", dmg: "2d8+2", mods: { toHit: 2, crit: 4 }, price: 4000, cls: ["Fighter", "Samurai", "Lord", "Ninja"], loot: true, unique: true, lore: "It settles things." };
ITEMS.U_LEDGER    = { name: "Boltac's Ledger of Debts", slot: "weapon", dmg: "1d10+1", mods: { goldGain: 25 }, price: 3500, cls: null, loot: true, unique: true, lore: "Every wound is an invoice. It collects." };
ITEMS.U_WALLFLOWER = { name: "The Wallflower", slot: "shield", ac: 4, mods: { resist: 10 }, price: 3500, cls: ["Fighter", "Priest", "Samurai", "Lord"], loot: true, unique: true, lore: "It has attended every fight and joined none of them." };
ITEMS.U_ANTCROWN  = { name: "Crown of Ants", slot: "helm", ac: 2, mods: { maxhp: 6, inspect: 10 }, price: 3000, cls: null, loot: true, unique: true, lore: "The colony votes on your behalf. Usually for survival." };
ITEMS.U_STEVECLOAK = { name: "Steve's Spare Cloak", slot: "cloak", ac: 2, mods: { resist: 25 }, price: 4000, cls: null, loot: true, unique: true, lore: "Property of Steve. Steve will not be needing it back." };
ITEMS.U_RING847   = { name: "The 847th Ring", slot: "ring", mods: { maxhp: 5, resist: 10, crit: 2 }, price: 5000, cls: null, loot: true, unique: true, lore: "The tally stopped at 847. The ring kept counting." };
ITEMS.U_MOURNING  = { name: "The Mourning Star", slot: "weapon", dmg: "2d6+3", mods: { lifesteal: 2 }, price: 4500, cls: ["Fighter", "Priest", "Lord"], loot: true, unique: true, lore: "It grieves for everyone it meets. Briefly." };
ITEMS.U_QUILL     = { name: "The Archivist's Quill", slot: "weapon", dmg: "1d6+2", mods: { spellPower: 5 }, price: 4500, cls: null, loot: true, unique: true, lore: "Mightier than most swords, legally speaking." };
const UNIQUES = [
  { id: "U_LEDGER", minDepth: 6 },
  { id: "U_ARGUMENT", minDepth: 8 },
  { id: "U_WALLFLOWER", minDepth: 8 },
  { id: "U_ANTCROWN", minDepth: 10 },
  { id: "U_STEVECLOAK", minDepth: 12 },
  { id: "U_MOURNING", minDepth: 12 },
  { id: "U_RING847", minDepth: 14 },
  { id: "U_QUILL", minDepth: 16 },
];

const MOD_LABELS = {
  toHit: "to hit", dmg: "damage", ac: "AC", crit: "% crit chance",
  runChance: "% flee chance", inspect: "% trap inspection", disarm: "% trap disarm",
  xpGain: "% XP gain", goldGain: "% gold gain", spellPower: "spell power",
  healPower: "healing power", swings: "extra swings",
  maxhp: "max HP", resist: "% spell/breath resist", lifesteal: "HP on kill",
};

// full stat card for an item instance — the System hides nothing
function itemCard(entry, ch) {
  const st = IT(entry);
  const base = ITEMS[entry.id];
  const lines = [];
  lines.push(`<span class="hi">${esc(st.name)}</span>  <span class="dim">[${st.slot}]</span>`);
  if (base.unique) lines.push(`<span class="gold">UNIQUE</span> — <span class="dim">"${esc(base.lore)}"</span>`);
  if (base.effect) lines.push(`EFFECT     ${esc(base.effect)}`);
  lines.push("");
  if (st.dmg) lines.push(`DAMAGE     ${st.dmg}${st.dmg !== base.dmg ? `  <span class="dim">(base ${base.dmg})</span>` : ""}`);
  if (st.ac) lines.push(`ARMOR      +${st.ac} AC${st.ac !== (base.ac || 0) ? `  <span class="dim">(base +${base.ac || 0})</span>` : ""}`);
  if (st.use === "heal") lines.push(`ON USE     heals ${st.dice} HP`);
  if (st.use === "curepoison") lines.push(`ON USE     cures poison`);
  for (const [k, v] of Object.entries(st.mods || {})) {
    lines.push(`BONUS      ${v > 0 ? "+" : ""}${v} ${MOD_LABELS[k] || k}`);
  }
  if (entry.affixes && entry.affixes.length) {
    lines.push("", "ENCHANTMENTS:");
    for (const aid of entry.affixes) {
      const a = AFFIXES[aid];
      if (!a) continue;
      const fx = [];
      if (a.dmgPlus) fx.push(`+${a.dmgPlus} damage`);
      if (a.ac) fx.push(`+${a.ac} AC`);
      for (const [k, v] of Object.entries(a.mods || {})) fx.push(`${v > 0 ? "+" : ""}${v} ${MOD_LABELS[k] || k}`);
      lines.push(`  <span class="k">${esc(a.name)}</span> — ${esc(fx.join(", "))}`);
    }
  }
  lines.push("", `USABLE BY  ${base.cls ? esc(base.cls.join(", ")) : "everyone"}` +
    (ch && !canUseItem(ch, entry.id) ? `  <span class="bad">(not ${esc(ch.name)})</span>` : ""));
  lines.push(`VALUE      <span class="gold">${st.price} G</span>  <span class="dim">(Boltac pays ${Math.floor(st.price / 2)})</span>`);
  return lines.join("\n");
}

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
  1: ["DAGGER", "STAFF", "SHORTSWORD", "MACE", "ROBES", "LEATHER", "SMALLSHIELD", "CLOAK", "RINGVIT"],
  2: ["SHORTSWORD", "LONGSWORD", "FLAIL", "CHAINMAIL", "LARGESHIELD", "HELM", "CLOAKVIT", "RINGWARD"],
  3: ["LONGSWORD", "FLAIL", "BREASTPLATE", "PLATEMAIL", "LARGESHIELD", "HELM", "CLOAKVIT", "RINGWARD", "FALCHION"],
  4: ["FALCHION", "WARMAUL", "PLATEMAIL", "TOWERSHIELD", "GREATHELM", "DUELCLOAK", "ARCSTAFF", "RINGWARD"],
  5: ["GREATSWORD", "WARMAUL", "DRAGONSCALE", "TOWERSHIELD", "GREATHELM", "SHADOWWEAVE", "SIGNET", "DUELCLOAK"],
  6: ["GREATSWORD", "RUNEBLADE", "DRAGONSCALE", "SHADOWWEAVE", "ARCSTAFF", "SIGNET", "TOWERSHIELD"],
};

// quality 0..3 raises affix count; depth raises the base pool band, opens
// deeper affix tiers, and puts uniques on the table
function generateItem(depth, quality) {
  if (pct(20)) return { id: pick(["P_DIOS", "P_LATUMOFIS"]), eq: false };
  if (quality >= 2 && pct(5 + 2 * quality)) {
    const elig = UNIQUES.filter(u => depth >= u.minDepth);
    if (elig.length) return { id: pick(elig).id, eq: false };
  }
  const band = clamp(Math.ceil(depth / 4), 1, 6);
  const pool = LOOT_BASES[band].concat(band > 1 ? LOOT_BASES[band - 1] : []);
  const id = pick(pool);
  const slot = ITEMS[id].slot;
  const n = clamp(quality - 1 + rnd(3), 0, 3);
  const eligible = Object.keys(AFFIXES).filter(a => AFFIXES[a].slots.includes(slot) && depth >= (AFFIXES[a].minDepth || 0));
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
