"use strict";
// Phase 8: floor modifiers — deterministic rolls, announcements, and effects.
const { boot, makeChecker } = require("./harness");
const { assert, done } = makeChecker("floors");
const H = boot();
const { press, get, run } = H;

press("n");
run("Game.flags.seed = 20260817;");

// --- rolls: crawl-only, valid, deterministic, rate applied
run(`
  var __mods = {};
  var __modErr = [];
  const IDS = FLOOR_MODS.map(m => m.id);
  for (let n = 1; n <= 3; n++) if (getLevel(n).mod) __modErr.push("campaign floor " + n + " has a modifier");
  for (let n = 4; n <= 40; n++) {
    const m = getLevel(n);
    if (!m.mod) continue;
    __mods[m.mod.id] = n;
    if (!IDS.includes(m.mod.id)) __modErr.push("floor " + n + " unknown modifier " + m.mod.id);
    if (m.mod.rate && m.rate !== m.mod.rate) __modErr.push("floor " + n + " rate not applied");
    if (!m.mod.announce || !m.mod.name) __modErr.push("floor " + n + " modifier missing copy");
  }
`);
for (const e of get("__modErr")) assert(false, e);
assert(get("Object.keys(__mods).length") >= 3, "several distinct modifiers appear by floor 40");
assert(get("[4,5,6,7,8,9,10,11,12].some(n => !getLevel(n).mod)"), "some floors are unmodified");

const B = boot();
B.press("n");
B.run("Game.flags.seed = 20260817;");
const seqA = get("JSON.stringify([4,5,6,7,8,9,10,11,12].map(n => getLevel(n).mod ? getLevel(n).mod.id : null))");
const seqB = B.get("JSON.stringify([4,5,6,7,8,9,10,11,12].map(n => getLevel(n).mod ? getLevel(n).mod.id : null))");
assert(seqA === seqB, "same seed rolls the same modifiers");

// find one floor per modifier of interest (scan far enough that each shows up)
run(`
  var __find = {};
  for (let n = 4; n <= 200 && Object.keys(__find).length < FLOOR_MODS.length; n++) {
    const m = getLevel(n);
    if (m.mod && !__find[m.mod.id]) __find[m.mod.id] = n;
  }
`);
const found = get("__find");
assert(Object.keys(found).length === get("FLOOR_MODS.length"), "every modifier occurs somewhere in 200 floors");

// --- floorMod() accessor
run(`Game.maze = { level: 1, x: 1, y: 1, f: 0, light: 0 };`);
assert(get("JSON.stringify(floorMod())") === "{}", "campaign floors have no modifier");
run(`Game.maze.level = __find.BLOOD;`);
assert(get("floorMod().mdmg") === 2, "blood floor exposes +2 monster damage");

// --- BLOOD: monster melee hits for dice + 2 (min roll 1 + 2 = 3)
run("Math.random = () => 0.01;");
run(`
  const ch = newChar("TANK", "Human", "Good", {STR:16,IQ:8,PIE:5,VIT:14,AGI:9,LUK:9}, "Fighter");
  ch.level = 5; ch.maxhp = 40; ch.hp = 40;
  Game.roster.push(ch); Game.party.push(ch);
  Combat.opts = {}; Combat.groups = [];
  Combat.addGroup("ORC", 1);
  Combat.round = 0; Combat.xpTotal = 0; Combat.msgs = []; Combat.intentRound = -1;
  Combat.surprised = false; Combat.surprising = false;
  Game.go(CombatScreen);
  Combat.beginInput();
  Combat.actions = [];
  Combat.resolveRound();
`);
assert(get("Combat.msgs.join(' ')").includes("is hit for 3"), "blood surcharge adds +2 to the orc's minimum 1");

// --- gold multiplier on victory (dice 2d10 min = 2)
run(`
  Combat.groups.forEach(g => g.members.forEach(mm => mm.hp = 0));
  Combat.xpTotal = 100;
  Combat.victory();
`);
const bloodDepth = found.BLOOD;
assert(get("Combat.msgs.join(' ')").includes(`${Math.floor(2 * bloodDepth * 5 * 1.5)} gold`), "blood floor pays +50% gold");

// --- SWARM: xp multiplier shown in the spoils
run(`
  Game.maze.level = __find.SWARM;
  Combat.groups = []; Combat.addGroup("ORC", 1);
  Combat.groups[0].members[0].hp = 0;
  Combat.xpTotal = 100;
  Combat.msgs = [];
  Combat.victory();
`);
assert(get("Combat.msgs.join(' ')").includes("125 XP"), "rush hour pays +25% XP");

// --- GREED: chests are always trapped (high roll would normally mean no trap)
run("Math.random = () => 0.99;");
run(`Game.maze.level = __find.GREED; Combat.openChestUI();`);
assert(get("Combat.chest.trap") !== null, "audit season: chest trapped even on a 99 roll");
run(`Game.maze.level = 4; while (getLevel(Game.maze.level).mod) Game.maze.level++; Combat.openChestUI();`);
assert(get("Combat.chest.trap") === null, "normal floor: 99 roll means no trap");

// --- DARK: automap refuses to render
run(`Game.maze.level = __find.DARK; Game.maze.x = 1; Game.maze.y = 1; MapScreen.draw();`);
assert(H.els["panel"].innerHTML.includes("SIGNAL LOST"), "blackout floor kills the automap");
run(`Game.maze.level = 1; MapScreen.draw();`);
assert(H.els["panel"].innerHTML.includes("sanctum"), "normal automap still renders");

// --- arrival announcement + header badge, through the real descend flow
run("Math.random = () => 0.5;");
run(`
  // silence achievement/loot-box spam so the announcement stays in the log window
  for (const a of ACHIEVEMENTS) Game.achievements[a.id] = 1;
  var __target = 0;
  // skip floors whose ancestor is a sealed Warden floor — descent would start a fight
  for (let n = 6; n <= 200; n++) if (getLevel(n).mod && !WARDENS[n - 1]) { __target = n; break; }
  const prev = getLevel(__target - 1);
  const dn = findSpecial(prev, "down");
  Game.maze = { level: __target - 1, x: dn.x, y: dn.y, f: 0, light: 0 };
  UI.clearLog();
  Game.go(MazeScreen);
`);
press("Enter");
run("var __tmod = getLevel(__target).mod;");
assert(get("document.getElementById('log').innerHTML.includes(__tmod.announce)"), "the System announces the modifier on descent");
assert(get("document.getElementById('viewlabel').textContent.includes(__tmod.name)"), "modifier badge shown in the maze header");

done();
