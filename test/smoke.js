"use strict";
// Data integrity, map reachability, char math, mod pipeline, save migration.
const { boot, makeChecker } = require("./harness");
const { assert, done } = makeChecker("smoke");

const H = boot({ files: ["util.js", "events.js", "data.js", "maps.js", "char.js"] });
const { get, run } = H;

// --- data cross-references
run(`
  var __err = [];
  for (const lv of Object.values(LEVELS))
    for (const [id] of lv.table) if (!MONSTERS[id]) __err.push("bad monster " + id);
  for (const id of SHOP_STOCK) if (!ITEMS[id]) __err.push("bad stock " + id);
  for (const depth of [1,2,3]) for (const id of LOOT_TABLE[depth]) if (!ITEMS[id]) __err.push("bad loot " + id);
  for (const [n, s] of Object.entries(SPELLS)) if (!["mage","priest"].includes(s.book)) __err.push("bad book " + n);
`);
for (const e of get("__err")) assert(false, e);

// --- BFS reachability (doors passable)
run(`
  function __bfs(m, sx, sy) {
    const seen = new Set([sx + "," + sy]);
    const q = [[sx, sy]];
    while (q.length) {
      const [x, y] = q.shift();
      const w = cellWalls(m, x, y);
      for (let dir = 0; dir < 4; dir++) {
        if (w[dir] === 1) continue;
        const nx = x + DIRS[dir].dx, ny = y + DIRS[dir].dy;
        if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
        const k = nx + "," + ny;
        if (!seen.has(k)) { seen.add(k); q.push([nx, ny]); }
      }
    }
    return seen;
  }
  var __unreach = [];
  for (const [starts, lvl] of [[[LEVELS[1].start.x, LEVELS[1].start.y], 1], [[18,1], 2], [[1,1], 3]]) {
    const m = LEVELS[lvl];
    const r = __bfs(m, starts[0], starts[1]);
    for (const key of Object.keys(m.specials)) if (!r.has(key)) __unreach.push("L" + lvl + " " + key);
  }
  // stairs round-trip
  for (const [n, m] of Object.entries(LEVELS))
    for (const [key, spc] of Object.entries(m.specials))
      if (spc.dest) {
        const dm = LEVELS[spc.dest.level];
        const back = dm && dm.specials[spc.dest.x + "," + spc.dest.y];
        if (!back || (back.t !== "up" && back.t !== "down")) __unreach.push("L" + n + " stairs " + key + " no round-trip");
      }
`);
for (const e of get("__unreach")) assert(false, e);

// --- char math + mod pipeline
run(`
  var Game = { party: [] };
  var __t = [];
  const ftr = newChar("T", "Human", "Good", {STR:15,IQ:11,PIE:11,VIT:14,AGI:11,LUK:9}, "Fighter");
  __t.push(["hp>0", ftr.maxhp > 0]);
  __t.push(["skills array", Array.isArray(ftr.skills)]);
  __t.push(["mod baseline 0", mod(ftr, "toHit") === 0]);
  const baseAtk = atkBonus(ftr);
  // skill contributes with log2 scaling
  SKILLS.__TEST = { mods: { toHit: 2 } };
  ftr.skills.push({ id: "__TEST", level: 1, uses: 0 });
  __t.push(["skill mod L1", Math.abs(mod(ftr, "toHit") - 2) < 1e-9]);
  ftr.skills[0].level = 3;
  __t.push(["skill mod L3 = 4", Math.abs(mod(ftr, "toHit") - 4) < 1e-9]);
  __t.push(["atkBonus includes mod", atkBonus(ftr) === baseAtk + 4]);
  // conditional (vs) gating
  SKILLS.__VS = { mods: { dmg: 3 }, vs: def => !!def.undead };
  ftr.skills.push({ id: "__VS", level: 1, uses: 0 });
  __t.push(["vs no ctx", mod(ftr, "dmg") === 0]);
  __t.push(["vs undead", Math.abs(mod(ftr, "dmg", { vs: MONSTERS.SKELETON }) - 3) < 1e-9]);
  __t.push(["vs living", mod(ftr, "dmg", { vs: MONSTERS.ORC }) === 0]);
  delete SKILLS.__TEST; delete SKILLS.__VS;
  ftr.skills = [];
  // item mods source
  ITEMS.__RING = { name: "Test Ring", slot: "helm", price: 1, cls: null, mods: { ac: 2 } };
  ftr.items.push({ id: "__RING", eq: true });
  __t.push(["item mod ac", acOf(ftr) === 8]);
  delete ITEMS.__RING;
  ftr.items = [];
  // helpers fire events
  var __evs = [];
  Events.onAny((t) => __evs.push(t));
  applyDamage(ftr, 3, { type: "test" });
  applyHeal(ftr, 2, { type: "test" });
  grantGold(ftr, 5, "test"); spendGold(ftr, 5, "test");
  __t.push(["events fired", JSON.stringify(__evs) === JSON.stringify(["damaged","heal","gold","spend"])]);
  applyDamage(ftr, 999, { type: "test" });
  __t.push(["death event", __evs.includes("death") && ftr.status === "DEAD" && ftr.hp === 0]);
  __t.push(["dice", (() => { for (let i=0;i<200;i++){const v=dice("2d4+1"); if (v<3||v>9) return false;} return true; })()]);
  __t.push(["xp lvl2", xpForLevel("Fighter", 2) === 1000]);
`);
for (const [name, ok] of get("__t")) assert(ok, "char test: " + name);

// --- v1 save migration (chars without skills field load fine into v2)
const v1chars = [{ id: 1, name: "OLDGUY", race: "Human", cls: "Fighter", align: "Good",
  stats: { STR: 15, IQ: 8, PIE: 5, VIT: 12, AGI: 9, LUK: 9 }, level: 3, xp: 2000, gold: 50,
  status: "OK", hp: 20, maxhp: 20, items: [{ id: "LONGSWORD", eq: true }],
  sp: { mage: [0,0,0,0,0,0,0], priest: [0,0,0,0,0,0,0] } }];
const store = { wizardy_save_v1: JSON.stringify({ roster: v1chars, party: [1], maze: null, flags: {}, nextId: 2 }) };
const H2 = boot({ store });
assert(H2.get("Game.hasSave()"), "v1 save detected");
assert(H2.get("Game.load()"), "v1 save loads");
assert(H2.get("Game.roster.length") === 1, "migrated roster");
assert(H2.get("Array.isArray(Game.roster[0].skills)"), "migrated char gains skills array");
assert(H2.get("Game.party.length") === 1, "migrated party");
H2.run("Game.save()");
assert(!!H2.store.wizardy_save_v2, "re-save writes v2 key");
assert(JSON.parse(H2.store.wizardy_save_v2).version === 2, "v2 version stamp");

done();
