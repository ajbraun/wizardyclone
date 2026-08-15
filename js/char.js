"use strict";
let _charId = 1;
function statMod(v) { return v >= 18 ? 2 : v >= 16 ? 1 : v <= 5 ? -1 : 0; }
function vitMod(v) { return Math.floor((v - 10) / 3); }

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
  return ac;
}
function atkBonus(ch) {
  const base = FIGHTER_TYPES.includes(ch.cls) ? ch.level
    : (ch.cls === "Mage" || ch.cls === "Bishop") ? Math.floor(ch.level / 2)
    : Math.floor(ch.level * 2 / 3);
  return base + statMod(ch.stats.STR);
}
function numAttacks(ch) {
  return FIGHTER_TYPES.includes(ch.cls) ? Math.min(3, 1 + Math.floor(ch.level / 5)) : 1;
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
  }
  const after = knownSpells(ch);
  const learned = after.filter(s => !before.includes(s));
  if (learned.length) msgs.push(`${ch.name} learned: ${learned.join(", ")}`);
  return msgs;
}
