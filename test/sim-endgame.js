"use strict";
// Targeted endgame: stair transitions, boss fight, amulet win, special monster abilities.
const { boot, makeChecker } = require("./harness");
const { assert, done } = makeChecker("sim-endgame");
const H = boot();
const { press, get, run } = H;

press("n");
run(`
  for (const [nm, cls, st] of [
    ["TANK","Fighter",{STR:18,IQ:8,PIE:5,VIT:16,AGI:10,LUK:9}],
    ["BRUTE","Fighter",{STR:17,IQ:8,PIE:5,VIT:15,AGI:9,LUK:9}],
    ["SNEAK","Thief",{STR:10,IQ:8,PIE:5,VIT:10,AGI:17,LUK:12}],
    ["VICAR","Priest",{STR:10,IQ:8,PIE:16,VIT:12,AGI:8,LUK:9}],
    ["ZAPPO","Mage",{STR:6,IQ:17,PIE:5,VIT:8,AGI:10,LUK:9}],
    ["PADRE","Priest",{STR:10,IQ:8,PIE:15,VIT:12,AGI:8,LUK:9}],
  ]) {
    const ch = newChar(nm, "Human", cls === "Thief" ? "Neutral" : "Good", st, cls);
    ch.level = 9; ch.xp = xpForLevel(cls, 9); ch.maxhp = 70; ch.hp = 70; ch.gold = 500;
    restoreSP(ch);
    ch.items.push({id:"LONGSWORD1", eq: canUseItem(ch,"LONGSWORD1")});
    ch.items.push({id:"CHAINMAIL1", eq: canUseItem(ch,"CHAINMAIL1")});
    Game.roster.push(ch); Game.party.push(ch);
  }
`);
const Game = get("Game");
const S = { MazeScreen: get("MazeScreen"), CombatScreen: get("CombatScreen") };

function grind(maxIter, label) {
  for (let i = 0; i < maxIter; i++) {
    if (Game.state === S.MazeScreen || !Game.maze) return true;
    if (Game.state !== S.CombatScreen) return true;
    const C = get("Combat");
    if (C.phase === "msg") { press(" "); continue; }
    if (C.phase === "chest") { press("o"); continue; }
    if (C.phase === "input") {
      if (C.sub !== "action") { press("1"); continue; }
      if (C.inputIdx < 3) press("f"); else press("p");
    }
  }
  console.log("grind stuck: " + label);
  return false;
}

press("e"); press("m");
// L1 -> L2
run('Game.maze = {level:1,x:18,y:2,f:0,light:0}; MazeScreen.draw();');
press("w"); grind(500, "to L1 stairs");
press("Enter");
assert(Game.maze.level === 2, "descended to L2");
assert(get("Game.counters['e:descend'] >= 1"), "descend event");
// L2 -> L3 and back up
run('Game.maze = {level:2,x:1,y:17,f:2,light:0}; MazeScreen.draw();');
press("w"); grind(500, "to L2 stairs");
press("Enter");
assert(Game.maze.level === 3, "descended to L3");
press("Enter");
assert(Game.maze.level === 2, "climbed back to L2");

// boss
run('Game.maze = {level:3,x:9,y:6,f:2,light:0}; MazeScreen.draw();');
press("w");
assert(Game.state === S.CombatScreen, "boss combat started");
assert(grind(3000, "boss fight"), "boss fight completed");
assert(Game.flags.boss, "boss defeated");
run('Game.party.forEach(c=>{ if(c.status!=="DEAD"&&c.status!=="ASHES"){c.status="OK";c.hp=c.maxhp;} });');
for (let i = 0; i < 40 && !(Game.maze.x === 9 && Game.maze.y === 11); i++) {
  if (Game.state === S.CombatScreen) { grind(2000, "amulet walk"); continue; }
  run('Game.maze.f = 2;');
  press("w");
}
assert(Game.maze.x === 9 && Game.maze.y === 11, "reached amulet tile");
press("Enter");
assert(Game.flags.won, "amulet taken");
assert(get("Game.counters['e:won'] === 1"), "won event counted");

// special abilities: forced encounters resolve without errors
for (const id of ["SHADE", "DRAGONFLY", "MAGE5", "PRIEST3", "SPIDER"]) {
  run(`
    Game.party.forEach(c=>{ if(c.status!=="DEAD"&&c.status!=="ASHES"){c.status="OK";c.hp=c.maxhp;c.asleep=false;} });
    Combat.opts = {}; Combat.groups = [];
    Combat.addGroup("${id}", 3);
    Game.party.forEach(ch => { ch.tempAC = 0; ch.parry = false; });
    Combat.round = 0; Combat.xpTotal = 0; Combat.msgs = [];
    Combat.surprised = false; Combat.surprising = false;
    Game.go(CombatScreen);
    Combat.beginInput();
  `);
  assert(grind(3000, "vs " + id), "fight vs " + id + " completed");
}

run('Game.maze = null; Game.go(CastleScreen);');
assert(H.els["panel"].innerHTML.includes("Amulet"), "castle shows victory banner");
done();
