"use strict";
let _charId = 1;
function statMod(v) { return v >= 18 ? 2 : v >= 16 ? 1 : v <= 5 ? -1 : 0; }
function vitMod(v) { return Math.floor((v - 10) / 3); }

// ---------------------------------------------------------------- modifier pipeline
// Every combat/check formula asks mod() for its bonuses instead of hardcoding
// them. Sources (skills, item affixes, buffs) contribute additively via
// registered functions (ch, key, ctx) -> number.
// Keys in use: toHit, dmg, ac, swings, runChance, inspect, disarm, xpGain, goldGain.
// ctx may carry {vs: monsterDef, ...} for conditional bonuses.
const MOD_SOURCES = [];
function registerModSource(fn) { MOD_SOURCES.push(fn); }
function mod(ch, key, ctx) {
  let total = 0;
  for (const fn of MOD_SOURCES) total += fn(ch, key, ctx || {}) || 0;
  return total;
}
// Diminishing returns for skill levels: level 1 = base, growth flattens fast.
function skillBonus(base, level) { return base * Math.log2(level + 1); }
// skills source: reads the SKILLS registry (populated in phase 3)
registerModSource((ch, key, ctx) => {
  if (!ch.skills || !ch.skills.length) return 0;
  let total = 0;
  for (const s of ch.skills) {
    const def = SKILLS[s.id];
    if (!def || !def.mods || def.mods[key] === undefined) continue;
    if (def.vs && (!ctx.vs || !def.vs(ctx.vs))) continue;
    total += skillBonus(def.mods[key], s.level);
  }
  return total;
});
// item source: equipped items may carry a mods table (affix items, phase 4)
registerModSource((ch, key) => {
  let total = 0;
  for (const it of ch.items) {
    if (!it.eq) continue;
    const def = ITEMS[it.id];
    if (def.mods && def.mods[key]) total += def.mods[key];
  }
  return total;
});

// ---------------------------------------------------------------- mutation helpers
// All HP/gold/status changes go through these so events can't be missed.
// src: {type: 'melee'|'spell'|'trap'|'poison'|'breath'|..., by, monster, name}
function applyDamage(ch, dmg, src) {
  ch.hp -= dmg;
  Events.emit("damaged", { ch, dmg, src: src || {} });
  if (ch.hp <= 0) {
    ch.hp = 0;
    ch.status = "DEAD";
    ch.asleep = false;
    Events.emit("death", { ch, src: src || {} });
    return true;
  }
  return false;
}
function applyHeal(ch, amt, src) {
  const eff = Math.max(0, Math.min(ch.maxhp - ch.hp, amt));
  ch.hp += eff;
  Events.emit("heal", { ch, amt: eff, src: src || {} });
  return eff;
}
function grantGold(ch, amt, src) {
  ch.gold += amt;
  Events.emit("gold", { ch, amt, src: src || "" });
}
function spendGold(ch, amt, src) {
  ch.gold -= amt;
  Events.emit("spend", { ch, amt, src: src || "" });
}

function eligibleClasses(stats, align) {
  return Object.keys(CLASSES).filter(c => {
    const cl = CLASSES[c];
    if (!cl.align.includes(align)) return false;
    return Object.entries(cl.req).every(([s, min]) => stats[s] >= min);
  });
}

function newChar(name, race, align, stats, cls) {
  const ch = {
    id: _charId++,
    name, race, align, cls,
    stats: Object.assign({}, stats),
    level: 1, xp: 0,
    gold: 100 + d(100),
    status: "OK",           // OK POISONED PARALYZED DEAD ASHES
    items: [],              // {id, eq}
    skills: [],             // {id, level, uses} — resolved against SKILLS registry
    sp: { mage: Array(7).fill(0), priest: Array(7).fill(0) },
  };
  ch.maxhp = Math.max(1, CLASSES[cls].hd + vitMod(stats.VIT));
  ch.hp = ch.maxhp;
  restoreSP(ch);
  return ch;
}

function knownBooks(ch) { return CLASSES[ch.cls].books; }
function maxSP(ch, book, sl) {
  const books = knownBooks(ch);
  if (!books[book]) return 0;
  const at = books[book](sl);
  if (ch.level < at) return 0;
  return clamp(ch.level - at + 2, 1, 9);
}
function restoreSP(ch) {
  for (const book of ["mage", "priest"]) {
    for (let s = 1; s <= 7; s++) ch.sp[book][s - 1] = maxSP(ch, book, s);
  }
}
function knownSpells(ch) {
  return Object.keys(SPELLS).filter(n => {
    const s = SPELLS[n];
    return maxSP(ch, s.book, s.sl) > 0;
  });
}
function itemDef(entry) { return ITEMS[entry.id]; }
function equipped(ch, slot) {
  const e = ch.items.find(i => i.eq && ITEMS[i.id].slot === slot);
  return e ? ITEMS[e.id] : null;
}
function acOf(ch) {
  let ac = 10;
  let any = false;
  for (const i of ch.items) {
    if (i.eq && ITEMS[i.id].ac) { ac -= ITEMS[i.id].ac; any = true; }
  }
  if (ch.cls === "Ninja" && !any) ac = 8 - Math.floor(ch.level / 2);
  ac -= (ch.tempAC || 0);
  ac -= mod(ch, "ac");
  return ac;
}
function atkBonus(ch, ctx) {
  const base = FIGHTER_TYPES.includes(ch.cls) ? ch.level
    : (ch.cls === "Mage" || ch.cls === "Bishop") ? Math.floor(ch.level / 2)
    : Math.floor(ch.level * 2 / 3);
  return base + statMod(ch.stats.STR) + Math.floor(mod(ch, "toHit", ctx));
}
function numAttacks(ch) {
  const base = FIGHTER_TYPES.includes(ch.cls) ? Math.min(3, 1 + Math.floor(ch.level / 5)) : 1;
  return base + Math.floor(mod(ch, "swings"));
}
function weaponDmg(ch) {
  const w = equipped(ch, "weapon");
  return w ? w.dmg : "1d2";
}
function canUseItem(ch, id) {
  const it = ITEMS[id];
  return !it.cls || it.cls.includes(ch.cls);
}
function isUp(ch) { return ch.status === "OK" || ch.status === "POISONED"; }
function aliveParty() { return Game.party.filter(isUp); }

// returns array of level-up message strings (called when resting at the inn)
function checkLevelUp(ch) {
  const msgs = [];
  const before = knownSpells(ch);
  while (ch.xp >= xpForLevel(ch.cls, ch.level + 1)) {
    ch.level++;
    const gain = Math.max(1, d(CLASSES[ch.cls].hd) + vitMod(ch.stats.VIT));
    ch.maxhp += gain;
    let m = `${ch.name} attained level ${ch.level}! (+${gain} HP)`;
    if (pct(35)) {
      const s = pick(STATS);
      if (ch.stats[s] < 18) { ch.stats[s]++; m += ` ${s} rose!`; }
    }
    msgs.push(m);
    Events.emit("levelup", { ch, level: ch.level });
  }
  const after = knownSpells(ch);
  const learned = after.filter(s => !before.includes(s));
  if (learned.length) msgs.push(`${ch.name} learned: ${learned.join(", ")}`);
  return msgs;
}
