"use strict";
// Phase 10: the System Store (loot boxes for gold) and elevator tolls.
const { boot, makeChecker } = require("./harness");
const { assert, done } = makeChecker("store");
const H = boot();
const { press, get, run } = H;

press("n");
run(`
  const ch = newChar("MONEYBAGS", "Human", "Good", {STR:12,IQ:8,PIE:5,VIT:12,AGI:10,LUK:9}, "Fighter");
  ch.gold = 10000;
  Game.roster.push(ch); Game.party.push(ch);
  Game.flags.seed = 777;
`);

// --- store reachable from the System screen
run("openSystem(CastleScreen);");
assert(H.els["panel"].innerHTML.includes("System Store"), "System screen offers the store");
press("b");
assert(get("Game.state === StoreScreen"), "store opens");
assert(H.els["panel"].innerHTML.includes("NOT FOR SALE"), "CELESTIAL is a tease, not a product");

// --- prices track deepest floor
assert(get("StoreScreen.price(STORE_TIERS[0])") === 150, "BRONZE costs 150 at depth 1");
run("Game.counters.maxDepth = 7;");
assert(get("StoreScreen.price(STORE_TIERS[0])") === 1050, "BRONZE costs 150 x depth");
run("Game.counters.maxDepth = 1;");

// --- buying: gold out, box contents in
run(`
  var __spent0 = Game.counters.goldSpent || 0;
  var __items0 = Game.party[0].items.length;
`);
press("1"); // BRONZE, 150
assert(get("(Game.counters.goldSpent || 0) - __spent0") === 150, "store charged the party");
assert(get("Game.party[0].items.length") === get("__items0") + 1, "loot box delivered an item");
assert(get("Game.counters['e:storeBuy']") === 1, "purchase counted for achievements");
assert(get("Game.counters['e:lootbox']") >= 1, "a real loot box was opened");

// --- broke customers are refused
run("Game.party[0].gold = 10; UI.clearLog();");
press("2"); // SILVER, 500
assert(get("Game.counters['e:storeBuy']") === 1, "no purchase without funds");
assert(get("document.getElementById('log').innerHTML").includes("Insufficient funds"), "the System declines politely");
press("l");
assert(get("Game.state === SystemScreen"), "store exits back to the System");

// --- hatch toll: shown, charged, refused when broke
run("Game.flags.boss = true; Game.party[0].gold = 1000; Game.maze = null; Game.go(EdgeScreen);");
press("m");
assert(H.els["panel"].innerHTML.includes("100 gold toll"), "hatch toll on the menu");
press("2");
assert(get("Game.maze && Game.maze.level") === 4, "paid ride to floor 4");
assert(get("Game.party[0].gold") === 900, "toll of 25 x floor collected");
run("Game.maze = null; Game.party[0].gold = 50; UI.clearLog(); Game.go(EdgeScreen);");
press("m"); press("2");
assert(get("Game.maze") === null, "broke party refused the down ride");
assert(get("document.getElementById('log').innerHTML").includes("stairs remain free"), "the System suggests cardio");

// --- ride home always runs, even on partial payment
run(`
  Game.flags.seed = 777;
  const sc = findSpecial(getLevel(6), "sanctum");
  Game.maze = { level: 6, x: sc.x, y: sc.y, f: 0, light: 0 };
  Game.party[0].gold = 40; // toll is 150
  UI.clearLog();
  Game.go(MazeScreen);
`);
assert(H.els["panel"].innerHTML.includes("150 gold toll"), "sanctum prompt shows the toll");
press("t");
assert(get("Game.maze") === null && get("Game.state === CastleScreen"), "partial payment still rides");
assert(get("Game.party[0].gold") === 0, "the System took everything it could");
assert(get("document.getElementById('log').innerHTML").includes("partial payment"), "partial payment narrated");

done();
