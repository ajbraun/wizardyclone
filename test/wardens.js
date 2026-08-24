"use strict";
// Phase 11: biome bands (names, tints, weighted monsters) and band Wardens.
const { boot, makeChecker } = require("./harness");
const { assert, done } = makeChecker("wardens");
const H = boot();
const { press, get, run } = H;

press("n");
run(`
  const ch = newChar("SEALBREAKER", "Human", "Good", {STR:16,IQ:8,PIE:5,VIT:14,AGI:30,LUK:9}, "Fighter");
  ch.level = 10; ch.maxhp = 80; ch.hp = 80; ch.gold = 10000;
  Game.roster.push(ch); Game.party.push(ch);
  Game.flags.seed = 1187;
  Game.flags.boss = true;
`);

// --- bands: every floor belongs to a place
assert(get("bandOf(4).name") === "The Warrens", "floors 4-8 are the Warrens");
assert(get("bandOf(8).name") === "The Warrens", "band spans five floors");
assert(get("bandOf(9).name") === "The Drowned Court", "floor 9 starts the next band");
assert(get("bandOf(33).name") === "The Root", "floor 33 ends the Root");
assert(get("bandOf(60).name") === "The After", "everything past 33 is the After");
run(`
  var __bandErr = [];
  for (const b of BANDS) {
    if (!b.name || !b.intro || !b.tint || !b.msgs || b.msgs.length < 2) __bandErr.push("band incomplete: " + b.name);
  }
  const m9 = getLevel(9);
  if (m9.band !== "The Drowned Court") __bandErr.push("floor 9 map not stamped with its band");
  if (m9.tint !== bandOf(9).tint) __bandErr.push("floor 9 map missing its tint");
`);
for (const e of get("__bandErr")) assert(false, e);

// --- carve profiles: generated floors approach the hand-built feel
run(`
  function __openness(m) {
    let open = 0, total = 0;
    for (let y = 1; y < 20; y++) for (let x = 0; x < 20; x++) { total++; if (m.hw[y][x] !== 1) open++; }
    for (let y = 0; y < 20; y++) for (let x = 1; x < 20; x++) { total++; if (m.vw[y][x] !== 1) open++; }
    return open / total;
  }
  var __openErr = [];
  for (const n of [4, 10, 15, 20, 25, 30]) {
    const o = __openness(getLevel(n));
    if (o < 0.63) __openErr.push("floor " + n + " too mazey (" + o.toFixed(3) + ")");
  }
  if (!(__openness(getLevel(30)) > __openness(getLevel(25)))) __openErr.push("Root should be more open than the Archive");
`);
for (const e of get("__openErr")) assert(false, e);

// --- band weighting: the Bone Orchard leans undead (deterministic per seed)
run(`
  var __undead = getLevel(15).table.filter(([id]) => MONSTERS[id].undead).length;
`);
assert(get("__undead") >= 2, "Bone Orchard floor rolls multiple undead species");

// --- warden defs are sound and in the bestiary
run(`
  var __wdErr = [];
  const KNOWN_ART = ["blob", "humanoid", "caster", "undead", "beast", "bug", "drake", "brute"];
  for (const [floor, wd] of Object.entries(WARDENS)) {
    if (MONSTERS[wd.id] !== wd) __wdErr.push("warden not registered: " + wd.id);
    if (!(dice(wd.hp) > 0) || !(wd.xp > 0) || !wd.lore || !wd.affix) __wdErr.push("bad warden stats: " + wd.id);
    if (!KNOWN_ART.includes(wd.art)) __wdErr.push("bad warden art: " + wd.id);
    if (!monsterCard(wd).includes("NAMED")) __wdErr.push("warden card not flagged NAMED: " + wd.id);
  }
`);
for (const e of get("__wdErr")) assert(false, e);

// --- the seal: floor 8's down stairs start a warden fight, not a descent
run(`
  const dn8 = findSpecial(getLevel(8), "down");
  Game.maze = { level: 8, x: dn8.x, y: dn8.y, f: 0, light: 0 };
  Game.go(MazeScreen);
`);
assert(H.els["panel"].innerHTML.includes("MOTHER OF THOUSANDS"), "seal prompt names the Warden");
press("Enter");
assert(get("Combat.opts.warden") === 8, "challenge starts the warden fight");
assert(get("Game.maze.level") === 8, "no descent while the seal holds");
assert(get("Combat.groups[0].def.id") === "WARDEN8", "the Warden leads the fight");
assert(get("Combat.groups.length") >= 2, "the Warden brought a retinue");

// --- victory breaks the seal, pays a GOLD box, unlocks the elevator
run(`
  Combat.groups.forEach(g => g.members.forEach(mm => mm.hp = 0));
  Combat.xpTotal = 4000; Combat.msgs = [];
  Combat.victory();
`);
assert(get("Game.flags.warden8") === true, "seal flag set");
assert(get("Game.counters['e:warden']") === 1, "warden kill counted");
assert(get("Game.achievements.WARDEN_1") === 1, "Regicide, Basically unlocked");
assert(get("Combat.msgs.join(' ')").includes("DROWNED COURT"), "the System opens the next band");
assert(get("document.getElementById('log').innerHTML").includes("GOLD LOOT BOX"), "warden pays a GOLD box");

// --- descent now works, and the band transition is announced
run(`
  // silence achievement/loot-box spam so the intro stays in the log window
  for (const a of ACHIEVEMENTS) Game.achievements[a.id] = 1;
  var __dn8 = findSpecial(getLevel(8), "down");
  Game.maze = { level: 8, x: __dn8.x, y: __dn8.y, f: 0, light: 0 };
  UI.clearLog();
  Game.go(MazeScreen);
`);
press("Enter");
assert(get("Game.maze.level") === 9, "stairs open after the Warden falls");
assert(get("document.getElementById('log').innerHTML").includes("THE DROWNED COURT"), "band intro announced on crossing");

// --- elevator stop for the opened band
run("Game.maze = null; Game.go(EdgeScreen);");
press("m");
assert(H.els["panel"].innerHTML.includes("The Drowned Court (Floor 9)"), "warden kill adds the band elevator stop");
press("3"); // 1 stairs, 2 hatch, 3 new band stop
assert(get("Game.maze && Game.maze.level") === 9, "express ride to floor 9 works");

done();
