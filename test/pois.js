"use strict";
// Phase 9: points of interest (shrine, kiosk, vault, remains) + depth streak.
const { boot, makeChecker } = require("./harness");
const { assert, done } = makeChecker("pois");
const H = boot();
const { press, get, run } = H;

press("n");
run(`
  const ch = newChar("DELVER", "Human", "Good", {STR:14,IQ:8,PIE:5,VIT:12,AGI:10,LUK:9}, "Fighter");
  ch.level = 6; ch.maxhp = 50; ch.hp = 50;
  Game.roster.push(ch); Game.party.push(ch);
  Game.flags.seed = 90210;
  Game.flags.boss = true;
  // pre-award gold-milestone achievements so their rewards don't skew gold math
  for (const a of ACHIEVEMENTS) if (a.counter === "goldSpent" || a.counter === "goldEarned") Game.achievements[a.id] = 1;
`);

// --- generation: every POI type appears, deterministically, crawl-only
run(`
  var __where = {};
  for (let n = 4; n <= 60; n++) {
    for (const t of ["shrine", "kiosk", "vault", "remains"]) {
      if (!__where[t] && findSpecial(getLevel(n), t)) __where[t] = n;
    }
  }
  var __campaignPois = [1, 2, 3].some(n =>
    Object.values(LEVELS[n].specials).some(s => ["shrine", "kiosk", "vault", "remains"].includes(s.t)));
`);
for (const t of ["shrine", "kiosk", "vault", "remains"]) {
  assert(get(`__where["${t}"]`) > 3, `${t} generates somewhere in the crawl`);
}
assert(get("__where.vault") >= 6, "vaults only spawn at floor 6+");
assert(get("__campaignPois") === false, "campaign floors stay hand-built");
const C = boot(); C.press("n"); C.run("Game.flags.seed = 90210;");
assert(
  get("JSON.stringify(Object.entries(getLevel(7).specials))") === C.get("JSON.stringify(Object.entries(getLevel(7).specials))"),
  "same seed places the same POIs");

// --- depth streak: builds through real entry + descent, shows in header
run("Game.go(EdgeScreen);");
press("m"); press("2"); // the Hatch -> floor 4
assert(get("streakCount()") === 1, "hatch entry starts the streak at 1");
run(`
  const dn = findSpecial(getLevel(4), "down");
  Game.maze.x = dn.x; Game.maze.y = dn.y;
  Game.go(MazeScreen);
`);
press("Enter"); // descend to 5
assert(get("streakCount()") === 2, "descending grows the streak");
assert(get("Math.abs(streakMult() - 1.2) < 1e-9"), "streak multiplier is +10% per floor");
assert(H.els["viewlabel"].textContent.includes("STREAK+20%"), "streak badge in the maze header");
run(`
  const up = findSpecial(getLevel(5), "up");
  Game.maze.x = up.x; Game.maze.y = up.y; MazeScreen.draw();
`);
press("Enter"); // climb back to 4
assert(get("streakCount()") === 2, "revisiting a floor does not double-count");
assert(get("Game.counters.maxStreak") === 2, "maxStreak counter tracks the best streak");
run("Game.maze = null;");
assert(get("streakCount()") === 0, "surfacing forfeits the streak");

// --- streak pays out in combat spoils
run(`
  var __plain = 4;
  while (getLevel(__plain).mod) __plain++;
  Game.maze = { level: __plain, x: 1, y: 1, f: 0, light: 0, streakFloors: { 4: 1, 5: 1 } };
  Combat.opts = {}; Combat.groups = [];
  Combat.addGroup("ORC", 1);
  Combat.groups[0].members[0].hp = 0;
  Combat.xpTotal = 100; Combat.msgs = [];
  Combat.victory();
`);
assert(get("Combat.msgs.join(' ')").includes("120 XP"), "2-floor streak pays +20% XP");

// --- shrine: blessing branch (low roll), one use only
run("Math.random = () => 0.01;");
run(`
  var __sh = null, __shF = 0;
  for (let n = 4; n <= 60 && !__sh; n++) { __sh = findSpecial(getLevel(n), "shrine"); if (__sh) __shF = n; }
  Game.maze = { level: __shF, x: __sh.x, y: __sh.y, f: 0, light: 0 };
  Game.party[0].hp = 5;
  Game.go(MazeScreen);
`);
assert(H.els["panel"].innerHTML.includes("SHRINE"), "shrine prompt appears");
press("Enter");
assert(get("Game.party[0].hp") === get("Game.party[0].maxhp"), "shrine blessing heals to full");
assert(get("Game.flags[poiFlag(Game.maze)]") === true, "shrine is spent");
assert(!H.els["panel"].innerHTML.includes("ENTER) Pray"), "spent shrine offers nothing");
assert(get("Game.counters['e:shrine']") === 1, "shrine prayer counted");

// --- shrine: audit branch (high roll) tithes and poisons
run("Math.random = () => 0.85;");
run(`
  var __sh2 = null, __shF2 = 0;
  for (let n = __shF + 1; n <= 80 && !__sh2; n++) { __sh2 = findSpecial(getLevel(n), "shrine"); if (__sh2) __shF2 = n; }
  Game.party[0].gold = 5000;
  Game.maze = { level: __shF2, x: __sh2.x, y: __sh2.y, f: 0, light: 0 };
  Game.go(MazeScreen);
`);
press("Enter");
assert(get("Game.party[0].gold") === 5000 - 30 * get("__shF2"), "shrine audit takes the tithe");
assert(get("Game.party[0].status") === "POISONED", "shrine audit poisons");
run("Game.party[0].status = 'OK';");

// --- remains: note + gold + (forced) item
run("Math.random = () => 0.01;");
run(`
  var __rm = null, __rmF = 0;
  for (let n = 4; n <= 60 && !__rm; n++) { __rm = findSpecial(getLevel(n), "remains"); if (__rm) __rmF = n; }
  var __goldBefore = Game.party[0].gold;
  var __itemsBefore = Game.party[0].items.length;
  Game.maze = { level: __rmF, x: __rm.x, y: __rm.y, f: 0, light: 0 };
  Game.go(MazeScreen);
`);
press("Enter");
assert(get("Game.party[0].gold") > get("__goldBefore"), "remains yield gold");
assert(get("Game.party[0].items.length") === get("__itemsBefore") + 1, "remains yield an item on the lucky roll");
assert(get("document.getElementById('log').innerHTML").length > 0, "remains note logged");
assert(get("Game.counters['e:remains']") === 1, "remains search counted");

// --- kiosk: pooled gold, limited stock
run(`
  var __ki = null, __kiF = 0;
  for (let n = 4; n <= 60 && !__ki; n++) { __ki = findSpecial(getLevel(n), "kiosk"); if (__ki) __kiF = n; }
  Game.party[0].gold = 800;
  Game.maze = { level: __kiF, x: __ki.x, y: __ki.y, f: 0, light: 0 };
  Game.go(MazeScreen);
`);
press("Enter");
assert(get("Game.state === KioskScreen"), "kiosk opens");
run("var __kItems = Game.party[0].items.length;");
press("1"); // Potion of Dios, 750
assert(get("Game.party[0].gold") === 50, "kiosk charges pooled gold");
assert(get("Game.party[0].items.length") === get("__kItems") + 1, "kiosk delivers the potion");
assert(H.els["panel"].innerHTML.includes("SOLD OUT"), "kiosk stock is finite");
press("2"); // 450 > 50 gold left
assert(get("Game.party[0].items.length") === get("__kItems") + 1, "kiosk refuses the broke");
press("l");
assert(get("Game.state === MazeScreen"), "kiosk exits back to the maze");

// --- vault: elite guardian, victory opens it permanently
run(`
  var __vl = null, __vlF = 0;
  for (let n = 6; n <= 80 && !__vl; n++) { __vl = findSpecial(getLevel(n), "vault"); if (__vl) __vlF = n; }
  Game.maze = { level: __vlF, x: __vl.x, y: __vl.y, f: 0, light: 0 };
  Game.go(MazeScreen);
`);
assert(H.els["panel"].innerHTML.includes("VAULT"), "vault prompt appears");
press("Enter");
assert(get("Combat.opts.vault") === true, "vault fight starts");
assert(get("Combat.groups.some(g => g.elite)"), "vault guardian is a named elite");
run(`
  Combat.groups.forEach(g => g.members.forEach(mm => mm.hp = 0));
  Combat.xpTotal = 50; Combat.msgs = [];
  Combat.victory();
`);
assert(get("Game.flags[Combat.opts.vaultKey]") === true, "vault flagged open on victory");
assert(get("Combat.msgs.join(' ')").includes("vault stands open"), "vault victory narrated");
assert(get("Game.counters['e:vault']") === 1, "vault crack counted");
assert(get("Combat.msgs.join(' ')").includes("CHEST"), "vault always yields a chest");

done();
