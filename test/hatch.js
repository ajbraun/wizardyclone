"use strict";
// Post-campaign fast travel: the Hatch (Floor 4) elevator stop.
const { boot, makeChecker } = require("./harness");
const { assert, done } = makeChecker("hatch");
const H = boot();
const { press, get, run } = H;

press("n");
run(`
  const ch = newChar("SCOUT", "Human", "Good", {STR:12,IQ:8,PIE:5,VIT:12,AGI:10,LUK:9}, "Fighter");
  Game.roster.push(ch); Game.party.push(ch);
  Game.flags.seed = 4242;
`);

// --- before the boss: no menu, straight down the stairs
run("Game.go(EdgeScreen);");
press("m");
assert(get("Game.maze && Game.maze.level") === 1, "pre-boss entry goes straight to level 1");

// --- after the boss: the Hatch appears
run("Game.maze = null; Game.flags.boss = true; Game.go(EdgeScreen);");
press("m");
assert(H.els["panel"].innerHTML.includes("The Hatch (Floor 4)"), "boss kill unlocks the Hatch entrance");
assert(!H.els["panel"].innerHTML.includes("sanctum"), "no sanctum option before one is found");
press("2");
assert(get("Game.maze && Game.maze.level") === 4, "hatch drops the party on floor 4");
run("var __up4 = findSpecial(getLevel(4), 'up');");
assert(get("Game.maze.x === __up4.x && Game.maze.y === __up4.y"), "party arrives at floor 4's up stairs");
assert(get("document.getElementById('log').innerHTML").includes("Express service to the Hatch"), "the System bills for the ride");

// --- floor modifier announced on hatch/elevator arrival
run(`
  var __modSeed = 0;
  for (let s = 1; s < 200 && !__modSeed; s++) {
    clearGeneratedLevels();
    Game.flags.seed = s;
    if (getLevel(4).mod) __modSeed = s;
  }
  Game.maze = null;
  UI.clearLog();
  Game.go(EdgeScreen);
`);
assert(get("__modSeed") > 0, "found a seed where floor 4 has a modifier");
press("m");
press("2");
assert(get("document.getElementById('log').innerHTML.includes(getLevel(4).mod.announce)"), "modifier announced when arriving via the Hatch");

// --- with a sanctum found, all three entrances are offered
run("Game.maze = null; Game.flags.sanctums = [{ level: 6, x: 2, y: 3 }]; Game.go(EdgeScreen);");
press("m");
assert(H.els["panel"].innerHTML.includes("The Hatch (Floor 4)") && H.els["panel"].innerHTML.includes("Floor 6 sanctum"), "hatch and sanctum both listed");
press("3");
assert(get("Game.maze && Game.maze.level") === 6 && get("Game.maze.x") === 2 && get("Game.maze.y") === 3, "sanctum elevator still works from slot 3");

done();
