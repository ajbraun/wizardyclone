"use strict";
// Long crawl with a strong party: chests, spells, inn level-ups, temple,
// plus phase-1 event-stream assertions (no NaN damage, counts consistent).
const { boot, makeChecker } = require("./harness");
const { assert, done } = makeChecker("sim-crawl");
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
    ch.level = 6; ch.xp = xpForLevel(cls, 6); ch.maxhp = 45; ch.hp = 45; ch.gold = 500;
    restoreSP(ch);
    ch.items.push({id: cls==="Mage" ? "STAFF" : "LONGSWORD", eq: cls!=="Mage" && cls!=="Priest"});
    if (cls==="Priest") ch.items.push({id:"MACE", eq:true});
    ch.items.push({id:"CHAINMAIL", eq: canUseItem(ch,"CHAINMAIL")});
    Game.roster.push(ch); Game.party.push(ch);
  }
  // event-stream monitors
  var __evCount = {};
  var __badEvents = [];
  Events.onAny((t, p) => {
    __evCount[t] = (__evCount[t] || 0) + 1;
    if (p && typeof p.dmg === "number" && !isFinite(p.dmg)) __badEvents.push(t + ":NaN-dmg");
    if (p && typeof p.amt === "number" && !isFinite(p.amt)) __badEvents.push(t + ":NaN-amt");
  });
`);
assert(get("Game.party.length") === 6, "party of 6");

press("e"); press("m");
const Game = get("Game");
const MazeScreen = get("MazeScreen"), CombatScreen = get("CombatScreen"), CampScreen = get("CampScreen");
const SPELLS = get("SPELLS");
let chests = 0, victories = 0;
for (let steps = 0; steps < 12000 && Game.maze; steps++) {
  const st = Game.state;
  if (st === CombatScreen) {
    const C = get("Combat");
    if (C.phase === "msg") { if (C.endTo === "victory") victories++; press(" "); continue; }
    if (C.phase === "chest") {
      chests++;
      const r = Math.random();
      if (r < 0.3) press("i"); else if (r < 0.5) press("d"); else press("o");
      continue;
    }
    if (C.phase === "input") {
      if (C.sub !== "action") { press("1"); continue; }
      const ch = C.currentChar();
      if (ch && (ch.cls === "Mage" || ch.cls === "Priest") && Math.random() < 0.5) {
        const list = C.combatSpells(ch).filter(s => {
          const d = SPELLS[s];
          return ch.sp[d.book][d.sl - 1] > 0 && (d.target === "group" || d.target === "foe");
        });
        if (list.length) {
          const s = list[Math.floor(Math.random() * list.length)];
          press("s"); press("abcdefghij"[C.combatSpells(ch).indexOf(s)]);
          continue;
        }
      }
      if (C.inputIdx < 3) press("f"); else press("p");
      continue;
    }
    continue;
  }
  if (st === MazeScreen) {
    if (steps % 10 === 0) run('Game.party.forEach(c => { if (c.status==="POISONED") c.status="OK"; if (c.status==="OK") c.hp=Math.min(c.maxhp,c.hp+8); })');
    const onExit = Game.maze.level === 1 && Game.maze.x === 9 && Game.maze.y === 18;
    const r = Math.random();
    if (r < 0.15 && !onExit) press("Enter");
    else if (r < 0.65) press("w"); else if (r < 0.85) press("a"); else press("d");
    continue;
  }
  if (st === CampScreen) { press("l"); continue; }
  break;
}
console.log(`victories: ${victories}, chests: ${chests}`);
assert(victories > 3, "won some fights");
assert(chests > 0, "opened some chests");

// --- event-stream integrity
const ev = get("__evCount");
assert(get("__badEvents.length") === 0, "no NaN payloads: " + JSON.stringify(get("__badEvents").slice(0, 5)));
assert((ev.victory || 0) === victories, `victory events (${ev.victory}) match observed (${victories})`);
assert(ev.kill > 0, "kill events fired");
assert(ev.swing > 0, "swing events fired");
assert(ev.damaged > 0, "damaged events fired");
assert(ev.gold > 0, "gold events fired");
assert(ev.step === get("Game.counters['e:step']"), "onAny counters match direct listener");

// camp spells
run(`
  const pr = Game.party.find(c => c.cls === "Priest" && (c.status==="OK"||c.status==="POISONED"));
  if (pr && Game.maze) {
    const hurt = Game.party.find(c => c.hp < c.maxhp && (c.status==="OK"||c.status==="POISONED"));
    if (hurt) { pr.sp.priest[0] = Math.max(1, pr.sp.priest[0]); castCampSpell(pr, "DIOS", hurt); }
    castCampSpell(pr, "DUMAPIC", null);
  }
`);

// inn level-up + temple
run(`
  if (!Game.party.length) { Game.party = Game.roster.slice(0,6); Game.party.forEach(c=>{c.status="OK"; c.hp=Math.max(1,c.hp);}); }
  Game.maze = null;
  Game.go(CastleScreen);
  for (const c of Game.party) c.xp += xpForLevel(c.cls, c.level + 1);
`);
press("a"); press("c");
assert(get('Game.party.filter(c => c.status === "OK" || c.status === "POISONED").every(c => c.level >= 7)'), "inn leveled the party");
assert(get("Game.counters['e:levelup'] > 0"), "levelup events counted");
press("l");
run('Game.party[0].status = "DEAD"; Game.party[0].hp = 0; Game.party.forEach(c=>c.gold=2000);');
press("t"); press("a"); press("y");
assert(get('["OK","ASHES"].includes(Game.party[0].status)'), "temple resolved DEAD");
assert(get("Game.counters['e:temple'] > 0"), "temple event counted");
// achievements earn themselves organically during a long crawl
const earned = get("Object.keys(Game.achievements)");
console.log(`achievements earned organically: ${earned.length} (${earned.slice(0, 8).join(", ")}...)`);
assert(earned.length >= 5, "crawl earned achievements organically");
assert(earned.includes("FIRST_BLOOD"), "First Blood among them");
done();
