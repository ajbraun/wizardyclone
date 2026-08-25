"use strict";
// Accessories: ring/cloak slots, gear max-HP, and spell/breath resist.
const { boot, makeChecker } = require("./harness");
const { assert, done } = makeChecker("gear");
const H = boot();
const { press, get, run } = H;

press("n");
run(`
  const ch = newChar("WIZZO", "Elf", "Good", {STR:6,IQ:17,PIE:5,VIT:8,AGI:10,LUK:9}, "Mage");
  ch.level = 5; ch.maxhp = 16; ch.hp = 16; ch.gold = 5000;
  Game.roster.push(ch); Game.party.push(ch);
`);

// --- Constitution Cloak: anyone can wear it, and it adds real hit points
run(`
  Game.party[0].items.push({ id: "CLOAKVIT", eq: true });
`);
assert(get("canUseItem(Game.party[0], 'CLOAKVIT')"), "mage can wear a cloak");
assert(get("maxHP(Game.party[0])") === 24, "Constitution Cloak adds +8 max HP");
run("applyHeal(Game.party[0], 50, { type: 'potion' });");
assert(get("Game.party[0].hp") === 24, "healing fills to the geared cap");
run("Game.party[0].items[Game.party[0].items.length - 1].eq = false; clampHP(Game.party[0]);");
assert(get("Game.party[0].hp") === 16, "unequipping clamps hp to the bare cap");
run("Game.party[0].items.pop();");

// --- Ring of Warding halves incoming spell damage reliably at resist 30+AGI
run(`
  Game.party[0].items.push({ id: "RINGWARD", eq: true });
`);
assert(get("Math.floor(mod(Game.party[0], 'resist'))") === 30, "ring feeds the resist mod");
run("Math.random = () => 0.55;"); // rnd(100)=55: AGI 10 + 30 base = 40 fails; +30 ring = 70 passes
run(`
  Game.maze = { level: 1, x: 9, y: 18, f: 0, light: 0 };
  Combat.opts = {}; Combat.groups = [];
  Combat.addGroup("MAGE5", 1);
  Combat.groups[0].members[0].hp = 30;
  Combat.round = 0; Combat.msgs = []; Combat.intentRound = -1;
  Combat.surprised = false; Combat.surprising = false;
  Game.go(CombatScreen);
  Combat.beginInput();
  Combat.groups[0].intent = { kind: "mahalito", label: "WEAVING FIRE", warn: "x" };
  Combat.groups[0].intentDone = false;
  var __hp0 = Game.party[0].hp;
  Combat.actions = [];
  Combat.resolveRound();
  var __dmgWith = __hp0 - Game.party[0].hp;
`);
run(`
  Game.party[0].items.pop(); // remove the ring
  Game.party[0].hp = 16;
  Combat.groups[0].members[0].hp = 30; Combat.groups[0].members[0].asleep = false;
  Combat.phase = "input"; Combat.round = 0; Combat.msgs = []; Combat.intentRound = -1;
  Combat.groups[0].intent = { kind: "mahalito", label: "WEAVING FIRE", warn: "x" };
  Combat.groups[0].intentDone = false;
  var __hp1 = Game.party[0].hp;
  Combat.actions = [];
  Combat.resolveRound();
  var __dmgWithout = __hp1 - Game.party[0].hp;
`);
assert(get("__dmgWith") * 2 === get("__dmgWithout"), "warded mage takes half the fireball (got " + get("__dmgWith") + " vs " + get("__dmgWithout") + ")");

// --- shop stocks the accessories; letters reach the 20th slot
run("Game.maze = null; Game.party[0].status = 'OK'; Game.party[0].hp = 16; Game.go(CastleScreen);");
press("b"); press("b"); // Boltac -> buy
assert(H.els["panel"].innerHTML.includes("Constitution Cloak"), "cloaks in stock");
assert(H.els["panel"].innerHTML.includes("Ring of Warding"), "rings in stock");
press("u"); // 20th stock item = RINGWARD
assert(get("Game.party[0].items.some(i => i.id === 'RINGWARD')"), "20th stock item buyable via 'u'");
assert(get("Game.party[0].items.find(i => i.id === 'RINGWARD').eq"), "ring auto-equips into the empty slot");

// --- generated accessories only roll slot-appropriate affixes
run(`
  var __affErr = [];
  for (const [aid, a] of Object.entries(AFFIXES)) {
    for (const s of a.slots) if (!["weapon","armor","shield","helm","cloak","ring"].includes(s)) __affErr.push(aid + " bad slot " + s);
  }
  Math.random = () => 0.999; // force base-item path in generateItem
  // sanity: itemCard renders accessory mods
  var __card = itemCard({ id: "CLOAKVIT" }, Game.party[0]);
`);
for (const e of get("__affErr")) assert(false, e);
assert(get("__card").includes("max HP"), "item card labels the max HP bonus");

done();
