"use strict";
// The Crawl: floor generation determinism + connectivity, stairs linkage,
// sanctums, generated monsters in real combat, affix loot, automap, obituary.
const { boot, makeChecker } = require("./harness");
const { assert, done } = makeChecker("gen");

// --- determinism: same seed => identical floor and monsters
{
  const A = boot(), B = boot();
  A.press("n"); B.press("n");
  A.run("Game.flags.seed = 777;"); B.run("Game.flags.seed = 777;");
  const wallsA = A.get("JSON.stringify({hw: getLevel(5).hw, vw: getLevel(5).vw, sp: getLevel(5).specials})");
  const wallsB = B.get("JSON.stringify({hw: getLevel(5).hw, vw: getLevel(5).vw, sp: getLevel(5).specials})");
  assert(wallsA === wallsB, "same seed generates identical floor 5");
  const monA = A.get("getLevel(5).table.map(([id]) => MONSTERS[id].name).join('|')");
  const monB = B.get("getLevel(5).table.map(([id]) => MONSTERS[id].name).join('|')");
  assert(monA === monB, "same seed generates identical monsters");
  const C = boot();
  C.press("n");
  C.run("Game.flags.seed = 778;");
  const wallsC = C.get("JSON.stringify({hw: getLevel(5).hw, vw: getLevel(5).vw})");
  assert(wallsA !== wallsC, "different seed differs");
}

const H = boot();
const { press, get, run } = H;
press("n");
run("Game.flags.seed = 424242;");

// --- connectivity + monster sanity for floors 4..12
run(`
  var __genErr = [];
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
  for (let n = 4; n <= 12; n++) {
    const m = getLevel(n);
    const up = findSpecial(m, "up"), down = findSpecial(m, "down");
    if (!up || !down) { __genErr.push("floor " + n + " missing stairs"); continue; }
    const r = __bfs(m, up.x, up.y);
    for (const key of Object.keys(m.specials)) if (!r.has(key)) __genErr.push("floor " + n + " special " + key + " unreachable");
    if (r.size < 300) __genErr.push("floor " + n + " mostly sealed (" + r.size + " cells)");
    if (n % 3 === 0 && !findSpecial(m, "sanctum")) __genErr.push("floor " + n + " missing sanctum");
    for (const [id] of m.table) {
      const d = MONSTERS[id];
      if (!d) { __genErr.push("floor " + n + " unknown monster " + id); continue; }
      if (!(d.lvl >= 1) || !(d.xp > 0) || !(dice(d.hp) > 0) || !(dice(d.num) > 0)) __genErr.push("floor " + n + " bad stats " + id);
      for (const dd of d.dmg) if (!(dice(dd) >= 0)) __genErr.push("floor " + n + " bad dmg " + id);
    }
  }
`);
for (const e of get("__genErr")) assert(false, e);

// --- party for the crawl
run(`
  for (const [nm, cls, st] of [
    ["TANK","Fighter",{STR:18,IQ:8,PIE:5,VIT:16,AGI:10,LUK:9}],
    ["BRUTE","Fighter",{STR:17,IQ:8,PIE:5,VIT:15,AGI:9,LUK:9}],
    ["VICAR","Priest",{STR:10,IQ:8,PIE:16,VIT:12,AGI:8,LUK:9}],
  ]) {
    const ch = newChar(nm, "Human", "Good", st, cls);
    ch.level = 12; ch.xp = xpForLevel(cls, 12); ch.maxhp = 90; ch.hp = 90; ch.gold = 100;
    restoreSP(ch);
    ch.items.push({ id: "LONGSWORD", eq: canUseItem(ch, "LONGSWORD"), affixes: ["BRUTAL", "SOLDIER"] });
    ch.items.push({ id: "CHAINMAIL", eq: canUseItem(ch, "CHAINMAIL"), affixes: ["STURDY"] });
    Game.roster.push(ch); Game.party.push(ch);
  }
  Game.flags.boss = true; // hatch open
`);

// --- affix item resolution
assert(get('IT({ id: "CHAINMAIL", affixes: ["STURDY"] }).ac') === 4, "Sturdy Chain Mail AC 3+1");
assert(get('IT({ id: "CHAINMAIL", affixes: ["STURDY"] }).name') === "Sturdy Chain Mail", "prefix naming");
assert(get('IT({ id: "LONGSWORD", affixes: ["BRUTAL", "SOLDIER"] }).dmg') === "1d8+2", "dmgPlus merges into dice");
assert(get('IT({ id: "LONGSWORD", affixes: ["BRUTAL", "SOLDIER"] }).mods.toHit') === 2, "affix mods merge");
assert(get('IT({ id: "LONGSWORD", affixes: ["BRUTAL", "SOLDIER"] }).name') === "Brutal Long Sword of the Soldier", "pre+suf naming");
assert(get('IT({ id: "LONGSWORD", affixes: ["BRUTAL"] }).price') > get("ITEMS.LONGSWORD.price"), "affixes raise price");
// affix mods flow into character stats
assert(get("acOf(Game.party[0])") === 10 - 3 - 1, "equipped Sturdy Chain Mail counts");
run("var __atkBase = 12 + statMod(18);");
assert(get("atkBonus(Game.party[0])") === get("__atkBase") + 2, "of-the-Soldier toHit counts");

// --- generated loot + boxes
run(`
  var __lootOk = true;
  for (let i = 0; i < 200; i++) {
    const e = generateItem(8, 2);
    const st = IT(e);
    if (!st || !st.name || !ITEMS[e.id]) __lootOk = false;
    if (e.affixes) for (const a of e.affixes) {
      if (!AFFIXES[a]) __lootOk = false;
      else if (!AFFIXES[a].slots.includes(ITEMS[e.id].slot)) __lootOk = false;
    }
  }
`);
assert(get("__lootOk"), "200 generated items are valid and slot-compatible");
const goldBefore = get("partyGold()");
const itemsBefore = get("Game.party[0].items.length");
run('openLootBox("PLATINUM", 8);');
assert(get("partyGold()") > goldBefore, "loot box grants gold");
assert(get("Game.party[0].items.length") === itemsBefore + 2, "platinum box grants 2 items");

// --- descend L3 hatch -> floor 4 -> climb back
run('Game.maze = { level: 3, x: 10, y: 12, f: 0, light: 0 }; Game.go(MazeScreen);');
press("Enter");
assert(get("Game.maze.level") === 4, "hatch descends to floor 4");
const pos4 = get("({x: Game.maze.x, y: Game.maze.y})");
assert(get('findSpecial(getLevel(4), "up").x') === pos4.x, "arrived at floor 4 up stairs");
press("Enter");
assert(get("Game.maze.level") === 3 && get("Game.maze.x") === 10 && get("Game.maze.y") === 12, "climb returns to the hatch");
// sealed without the boss flag
run("Game.flags.boss = false;");
press("Enter");
assert(get("Game.maze.level") === 3, "hatch sealed before boss dies");
run("Game.flags.boss = true;");

// --- fight generated monsters on floor 5 (forced encounters, real combat)
run(`
  Game.maze = { level: 5, x: 2, y: 2, f: 0, light: 0 };
  Game.go(MazeScreen);
`);
const S = { MazeScreen: get("MazeScreen"), CombatScreen: get("CombatScreen") };
const Game = get("Game");
let fights = 0;
for (let f = 0; f < 5; f++) {
  run('Game.party.forEach(c => { if (c.status !== "DEAD") { c.status = "OK"; c.hp = c.maxhp; } }); Combat.start({});');
  let guard = 0;
  while (Game.state === S.CombatScreen && guard++ < 2000) {
    const C = get("Combat");
    if (C.phase === "msg") { press(" "); continue; }
    if (C.phase === "chest") { press("o"); continue; }
    if (C.phase === "input") {
      if (C.sub !== "action") { press("1"); continue; }
      if (C.inputIdx < 3) press("f"); else press("p");
    }
  }
  if (!Game.maze) break;
  fights++;
}
assert(fights >= 3, "fought generated monsters without errors (" + fights + " fights)");
assert(get("Game.counters.kills") > 0, "generated monsters die and count");

// --- sanctum on floor 6: rest once, then elevator
run(`
  const m6 = getLevel(6);
  const sc = findSpecial(m6, "sanctum");
  Game.maze = { level: 6, x: sc.x, y: sc.y, f: 0, light: 0 };
  Game.party.forEach(c => { if (c.status !== "DEAD") { c.status = "OK"; c.hp = 3; c.sp.priest && (c.sp.priest[0] = 0); } });
  Game.go(MazeScreen);
`);
press("Enter");
assert(get("Game.party.every(c => c.status === 'DEAD' || c.hp === c.maxhp)"), "sanctum restores HP");
assert(get("(Game.flags.sanctums || []).some(s => s.level === 6)"), "sanctum registered for the elevator");
run("Game.party.forEach(c => { if (c.status !== 'DEAD') c.hp = 5; });");
press("Enter");
assert(get("Game.party.some(c => c.status !== 'DEAD' && c.hp === 5)"), "sanctum is once per expedition");
press("t");
assert(get("Game.maze") === null, "elevator returns to castle");
assert(get("Game.state === CastleScreen"), "at the castle");
// edge of town offers elevator re-entry (fund the toll first)
run("Game.party.forEach(c => c.gold += 1000);");
press("e"); press("m");
assert(get("EdgeScreen.mode") === "enter", "entry choice offered");
assert(H.els["panel"].innerHTML.includes("The Hatch (Floor 4)"), "hatch entrance offered post-boss");
press("3");
assert(get("Game.maze && Game.maze.level === 6"), "elevator drops at floor 6 sanctum");

// --- automap: seen tracking + draw
assert(get("Object.keys(Game.seen[6] || {}).length") > 0, "cells marked seen");
press("m");
assert(get("Game.state === MapScreen"), "map opens");
press("m");
assert(get("Game.state === MazeScreen"), "map closes");
run("Render.drawMap(getLevel(6), Game.seen[6], Game.maze.x, Game.maze.y, 0);");

// --- obituary on wipe
run("Game.party.forEach(c => { c.status = 'DEAD'; c.hp = 0; }); partyWipe();");
assert(get("Game.state === WipeScreen"), "wipe shows the obituary");
assert(H.els["panel"].innerHTML.includes("OBITUARY"), "obituary rendered");
press(" ");
assert(get("Game.state === CastleScreen"), "obituary dismisses to castle");

// --- persistence: seen + sanctums survive save/load
run("Game.save(); Game.load();");
assert(get("Object.keys(Game.seen[6] || {}).length") > 0, "automap persists");
assert(get("(Game.flags.sanctums || []).length") > 0, "sanctum list persists");

done();
