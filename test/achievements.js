"use strict";
// Achievements: counter wiring, thresholds, rewards, secrets, persistence.
const { boot, makeChecker } = require("./harness");
const { assert, done } = makeChecker("achievements");
const H = boot();
const { press, get, run } = H;

press("n");
run(`
  const ch = newChar("ACHIE", "Human", "Good", {STR:15,IQ:8,PIE:5,VIT:12,AGI:10,LUK:9}, "Fighter");
  ch.gold = 0;
  Game.roster.push(ch); Game.party.push(ch);
`);

// definitions are sane: unique ids, counters named, positive thresholds
run(`
  var __defErr = [];
  const seen = new Set();
  for (const a of ACHIEVEMENTS) {
    if (seen.has(a.id)) __defErr.push("dup id " + a.id);
    seen.add(a.id);
    if (!a.counter || !(a.at > 0)) __defErr.push("bad def " + a.id);
    if (!a.name || !a.flavor || !a.desc) __defErr.push("missing text " + a.id);
  }
`);
for (const e of get("__defErr")) assert(false, e);
assert(get("ACHIEVEMENTS.length") >= 50, "at least 50 achievements defined");

// first kill: counter + award + gold reward
run('Events.emit("kill", { by: Game.party[0], monster: MONSTERS.ORC, how: "melee" });');
assert(get("Game.counters.kills") === 1, "kills counter");
assert(get("Game.counters['kill:ORC']") === 1, "per-monster counter");
assert(get("!!Game.achievements.FIRST_BLOOD"), "First Blood earned");
assert(get("Game.party[0].gold") === 25, "gold reward paid");
assert(get("Game.counters.goldEarned || 0") === 0, "achievement gold doesn't count as earned gold");

// tier thresholds fire exactly at N
run('for (let i = 0; i < 8; i++) Events.emit("kill", { monster: MONSTERS.ORC, how: "melee" });');
assert(get("!Game.achievements.KILLS_10"), "tier not early");
run('Events.emit("kill", { monster: MONSTERS.ORC, how: "melee" });');
assert(get("!!Game.achievements.KILLS_10"), "tier fires at 10");

// undead + sleeping + spell kill detail counters
run(`
  Events.emit("kill", { monster: MONSTERS.SKELETON, how: "spell", spell: "HALITO" });
  Events.emit("kill", { monster: MONSTERS.ZOMBIE, how: "melee", sleeping: true });
`);
assert(get("Game.counters['kills:undead']") === 2, "undead counter");
assert(get("Game.counters.sleepKills") === 1, "sleep-kill counter");
assert(get("Game.counters.spellKills") === 1, "spell-kill counter");

// gauge counters (maxDepth) award all crossed tiers
run('Events.emit("descend", { to: 3 });');
assert(get("!!Game.achievements.DEPTH_2 && !!Game.achievements.DEPTH_3"), "depth gauges award");

// title reward
run('Game.counters["e:bump"] = 99; Events.emit("bump", {});');
assert(get("!!Game.achievements.BUMPS_100"), "Wall Magnet earned");
assert(get('Game.titles.includes("Wall Magnet")'), "title granted");

// System screen: undiscovered achievements are hidden entirely (count only)
run("openSystem(CastleScreen);");
let panel = H.els["panel"].innerHTML;
assert(panel.includes("undiscovered"), "undiscovered count shown");
assert(!panel.includes("Nightmare Fuel"), "unearned achievement names not leaked");
assert(!panel.includes("Serial Winner"), "no pending list with progress");
assert(panel.includes("Wall Magnet"), "earned achievement listed");
assert(panel.includes("WALLS HEADBUTTED"), "stats shown");
press("l");
assert(get("Game.state === CastleScreen"), "System screen returns to castle");
run('Game.counters.sleepKills = 20; Events.emit("kill", { monster: MONSTERS.ORC, sleeping: true, how: "melee" });');
run("openSystem(CastleScreen);");
panel = H.els["panel"].innerHTML;
assert(panel.includes("Nightmare Fuel"), "secret revealed once earned");
press("l");

// persistence: earned achievements survive save/load, no double-award
const beforeCount = get("Object.keys(Game.achievements).length");
run("Game.save(); Game.load();");
assert(get("Object.keys(Game.achievements).length") === beforeCount, "achievements persist");
assert(get('Game.titles.includes("Wall Magnet")'), "titles persist");
run('Events.emit("kill", { monster: MONSTERS.ORC, how: "melee" });');
assert(get("Object.keys(Game.achievements).length") >= beforeCount, "no crash after reload");

// toast rendered
assert(H.els["toasts"].innerHTML.includes("ACHIEVEMENT"), "toast displayed");

done();
