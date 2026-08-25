"use strict";
// Phase 12: deep base ladder, depth-gated affix tiers, uniques, lifesteal.
const { boot, makeChecker } = require("./harness");
const { assert, done } = makeChecker("itemization");
const H = boot();
const { get, run, press } = H;

press("n");

// --- data integrity: every loot base and unique resolves and renders
run(`
  var __itemErr = [];
  for (const band of Object.values(LOOT_BASES)) for (const id of band) {
    if (!ITEMS[id]) __itemErr.push("loot base missing: " + id);
  }
  for (const u of UNIQUES) {
    const it = ITEMS[u.id];
    if (!it || !it.unique || !it.lore) __itemErr.push("bad unique: " + u.id);
    else if (!itemCard({ id: u.id }).includes("UNIQUE")) __itemErr.push("unique card untagged: " + u.id);
  }
  for (const [aid, a] of Object.entries(AFFIXES)) {
    for (const s of a.slots) if (!["weapon","armor","shield","helm","cloak","ring"].includes(s)) __itemErr.push(aid + ": bad slot " + s);
  }
`);
for (const e of get("__itemErr")) assert(false, e);

// --- depth gating: shallow drops never carry deep affixes, deep drops can
run(`
  var __shallowDeep = 0, __deepTiered = 0, __sawUnique = 0, __deepBases = 0;
  const DEEP = Object.keys(AFFIXES).filter(a => (AFFIXES[a].minDepth || 0) > 4);
  for (let i = 0; i < 300; i++) {
    const shallow = generateItem(4, 3);
    if ((shallow.affixes || []).some(a => DEEP.includes(a))) __shallowDeep++;
    const deep = generateItem(20, 3);
    if ((deep.affixes || []).some(a => DEEP.includes(a))) __deepTiered++;
    if (ITEMS[deep.id].unique) __sawUnique++;
    if (["GREATSWORD","DRAGONSCALE","TOWERSHIELD","SHADOWWEAVE","SIGNET","GREATHELM","WARMAUL","DUELCLOAK","ARCSTAFF"].includes(deep.id)) __deepBases++;
  }
`);
assert(get("__shallowDeep") === 0, "depth-4 drops never roll deep-tier affixes");
assert(get("__deepTiered") > 20, "depth-20 drops roll deep-tier affixes");
assert(get("__sawUnique") > 0, "uniques drop at depth with high quality");
assert(get("__deepBases") > 50, "depth-20 drops use the deep base ladder");

// --- uniques come clean: no affixes stacked on them
run(`
  var __uniqueAffixed = 0;
  for (let i = 0; i < 400; i++) {
    const e = generateItem(20, 3);
    if (ITEMS[e.id].unique && e.affixes) __uniqueAffixed++;
  }
`);
assert(get("__uniqueAffixed") === 0, "uniques never carry affixes");

// --- lifesteal: a vampiric kill heals the killer
run(`
  const ch = newChar("LEECH", "Human", "Evil", {STR:16,IQ:8,PIE:5,VIT:14,AGI:30,LUK:9}, "Fighter");
  ch.level = 8; ch.maxhp = 50; ch.hp = 30;
  ch.items.push({ id: "U_MOURNING", eq: true });
  Game.roster.push(ch); Game.party.push(ch);
  Game.maze = { level: 1, x: 9, y: 18, f: 0, light: 0 };
  Math.random = () => 0.01;
  Combat.opts = {}; Combat.groups = [];
  Combat.addGroup("ORC", 1);
  Combat.groups[0].members[0].hp = 1;
  Combat.round = 0; Combat.msgs = []; Combat.intentRound = -1;
  Combat.surprised = false; Combat.surprising = false;
  Game.go(CombatScreen);
  Combat.beginInput();
  Combat.actions = [{ ch, type: "fight", group: Combat.groups[0] }];
  Combat.resolveRound();
`);
assert(get("Game.party[0].hp") === 32, "Mourning Star heals 2 on the kill");
assert(get("Combat.endTo") === "victory", "orc died to fund the healing");

// --- TWINNED grants a real extra swing
run(`
  Game.party[0].items = [{ id: "LONGSWORD", eq: true, affixes: ["TWINNED"] }];
  var __sw = numAttacks(Game.party[0]);
  Game.party[0].items = [{ id: "LONGSWORD", eq: true }];
  var __sw0 = numAttacks(Game.party[0]);
`);
assert(get("__sw") === get("__sw0") + 1, "Twinned adds one swing");

done();
