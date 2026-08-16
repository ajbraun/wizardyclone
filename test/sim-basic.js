"use strict";
// Keyboard-driven playthrough: creation UI, tavern, shop, maze wander, save/load, renderer.
const { boot, makeChecker } = require("./harness");
const { assert, done } = makeChecker("sim-basic");
const H = boot();
const { press, type, get, run } = H;

// Allocate every bonus point through the UI: pump the current stat until it
// caps (bonus stops moving), then advance to the next stat. Ends with Enter.
function finishAlloc() {
  let guard = 0;
  while (get("Game.state.step") === "bonus" && guard++ < 300) {
    const b = get("Game.state.bonus");
    if (b === 0) { press("Enter"); break; }
    press("ArrowRight");
    if (get("Game.state.bonus") === b) press("ArrowDown");
  }
}
// create two characters through the real UI
press("n");
press("e"); press("t");
press("c"); type("HERO"); press("Enter"); press("1"); press("2"); // human neutral, STR first -> Fighter
finishAlloc(); press("1");
press("c"); type("CLERIC"); press("Enter"); press("3"); press("1"); // dwarf good
press("ArrowDown"); press("ArrowDown"); // start on PIE -> Priest
finishAlloc(); press("1");
assert(get("Game.roster.length") === 2, "roster has 2");
assert(get("Game.counters['e:create']") === 2, "create events counted");

// party + shop
press("l"); press("c"); press("g");
press("a"); press("a"); press("a");
press("l"); press("l");
assert(get("Game.party.length") === 2, "party of 2");
// regression: temple resurrection is free under level 3, even for a broke party
run('Game.party[1].status = "DEAD"; Game.party[1].hp = 0; Game.party.forEach(c => c.gold = 0);');
press("t"); press("a"); press("y");
assert(get("Game.party[1].status") !== "DEAD", "novice resurrection resolved without gold");
press("l");
run('Game.party[1].status = "OK"; Game.party[1].hp = Game.party[1].maxhp; Game.party.forEach(c => c.gold = 150);');
press("b"); press("b"); press("d"); // buy a long sword
// regression: "l" is Back, never a list letter — Small Shield (12th item) sells via "m"
run("Game.party[0].gold = 500");
press("l");
assert(get("ShopScreen.mode") === "menu", "'l' backs out of the buy list");
press("b"); press("m");
assert(get("Game.party[0].items.some(i => i.id === 'SMALLSHIELD')"), "12th stock item buyable via 'm'");
press("l"); press("l");

// regression: trade gear between party members via Inspect > Trade
press("g"); press("i"); press("1"); // tavern -> inspect HERO
press("t"); press("1"); press("2"); // give item 1 (long sword) to member 2
assert(get("Game.party[1].items.some(i => i.id === 'LONGSWORD' && !i.eq)"), "long sword traded to CLERIC, unequipped");
assert(get("Game.party[0].items.every(i => i.id !== 'LONGSWORD')"), "HERO no longer has the long sword");
assert(get("Game.counters['e:trade']") === 1, "trade event counted");
press("t"); press("1"); press("1"); // self-trade is a polite no-op
assert(get("Game.party[0].items.length") === 1, "self-trade changes nothing");
press("l"); press("l");

// wander until wipe or step budget
press("e"); press("m");
assert(get("!!Game.maze"), "entered maze");
const MazeScreen = get("MazeScreen"), CombatScreen = get("CombatScreen");
const Game = get("Game");
for (let steps = 0; steps < 3000 && Game.maze; steps++) {
  const st = Game.state;
  if (st === CombatScreen) {
    const C = get("Combat");
    if (C.phase === "msg") { press(" "); continue; }
    if (C.phase === "chest") { press("o"); continue; }
    if (C.phase === "input") {
      if (C.sub !== "action") { press("1"); continue; }
      if (C.inputIdx < 3) press("f"); else press("p");
    }
    continue;
  }
  if (st === MazeScreen) {
    const r = Math.random();
    if (r < 0.6) press("w"); else if (r < 0.8) press("a"); else press("d");
    continue;
  }
  break;
}
assert(get("Game.counters['e:step'] > 0"), "steps counted");
assert(get("Game.counters['e:encounter'] > 0"), "encounters happened");

// save / load round trip incl. counters
run("Game.save()");
const stepsBefore = get("Game.counters['e:step']");
run("Game.load()");
assert(get("Game.counters['e:step']") === stepsBefore, "counters persist through save/load");
assert(get("Game.roster.length") >= 1, "roster persists");

// renderer: every viewpoint on all levels draws without throwing
run(`
  for (const lvl of [1,2,3]) {
    const m = LEVELS[lvl];
    for (let y=0;y<m.h;y++) for (let x=0;x<m.w;x++) for (let f=0;f<4;f++) Render.draw(m,x,y,f,3);
  }
`);
done();
