"use strict";
// Phase 7: monster intents (telegraphs + interrupts) and named elites.
const { boot, makeChecker } = require("./harness");
const { assert, done } = makeChecker("elites");
const H = boot();
const { press, get, run } = H;

press("n");

// deterministic dice: every roll is minimal, every pct() check passes,
// pick()/pickWeighted() take the first entry
run("Math.random = () => 0.01;");

run(`
  const ch = newChar("BRUISER", "Human", "Good", {STR:16,IQ:8,PIE:5,VIT:14,AGI:30,LUK:9}, "Fighter");
  ch.level = 5; ch.maxhp = 40; ch.hp = 40;
  Game.roster.push(ch); Game.party.push(ch);
  Game.maze = { level: 1, x: 9, y: 18, f: 0, light: 0 };
`);

// --- intents: a breather telegraphs before acting
run(`
  Combat.opts = {}; Combat.groups = [];
  Combat.addGroup("DRAGONFLY", 1);
  Combat.groups[0].members[0].hp = 20;
  Combat.round = 0; Combat.xpTotal = 0; Combat.msgs = []; Combat.intentRound = -1;
  Combat.surprised = false; Combat.surprising = false;
  Game.go(CombatScreen);
  Combat.beginInput();
`);
assert(get("Combat.groups[0].intent && Combat.groups[0].intent.kind") === "breath", "breather rolls a breath intent");
assert(H.els["panel"].innerHTML.includes("[INHALING]"), "intent label shown in enemy list");
assert(H.els["panel"].innerHTML.includes("inhales deeply"), "intent warning shown during input");

// --- the telegraphed breath actually lands next resolution
const hpBefore = get("Game.party[0].hp");
run("Combat.actions = []; Combat.resolveRound();");
assert(get("Combat.msgs.join(' ')").includes("breathes fire"), "breath executes on resolution");
assert(get("Game.party[0].hp") < hpBefore, "breath damaged the party");
assert(get("Combat.groups[0].intent") === null, "intents cleared after the round");

// --- interrupt: kill the group before its intent fires
run(`
  Combat.groups = [];
  Combat.addGroup("DRAGONFLY", 1);
  Combat.groups[0].members[0].hp = 1;
  Combat.round = 0; Combat.msgs = []; Combat.intentRound = -1;
  Combat.surprised = false; Combat.surprising = false;
  Combat.beginInput();
  Combat.actions = [{ ch: Game.party[0], type: "fight", group: Combat.groups[0] }];
  Combat.resolveRound();
`);
assert(get("Combat.msgs.join(' ')").includes("dies with its breath still gathered"), "killed mid-telegraph fizzles with a message");
assert(get("Game.counters['e:interrupt']") >= 1, "interrupt counted for achievements");
assert(get("Combat.endTo") === "victory", "the drake is dead");

// --- casters telegraph too, and silence interrupts them
run(`
  Combat.groups = [];
  Combat.addGroup("MAGE5", 1);
  Combat.groups[0].members[0].hp = 30;
  Combat.round = 0; Combat.msgs = []; Combat.intentRound = -1;
  Combat.surprised = false; Combat.surprising = false;
  Combat.beginInput();
`);
assert(get("Combat.groups[0].intent && Combat.groups[0].intent.kind") === "mahalito", "rank-3 mage weaves fire");
run(`
  Combat.groups[0].silenced = true;
  Combat.actions = [];
  Combat.resolveRound();
`);
assert(get("Combat.msgs.join(' ')").includes("dies unspoken"), "silence interrupts the telegraphed spell");

// --- named elite: spawn, announcement, card, portrait, rewards
run(`
  UI.clearLog();
  Combat.start({});
`);
assert(get("Combat.groups.some(g => g.elite)"), "elite spawned (stubbed rng forces the roll)");
assert(get("Combat.groups[0].elite") === true, "elite leads the group list");
run(`
  var __e = Combat.groups[0].def;
  var __base = Object.values(MONSTERS).find(m => m.name === __e.base);
`);
assert(get("__e.name") === "Gruzzik the Damp", "elite gets a generated name");
assert(get("__e.affix.key") === "REGENERATING", "elite carries an affix");
assert(get("__e.xp === __base.xp * 4 && __e.lvl === __base.lvl + 2"), "elite stats scale from the base species");
assert(get("Combat.groups[0].members[0].maxhp > dice(__base.hp)"), "elite has real hp");
assert(get("document.getElementById('log').innerHTML").includes("NAMED monster: GRUZZIK THE DAMP"), "the System announces the elite");
assert(get("monsterCard(__e)").includes("NAMED"), "bestiary card flags the elite");
run("var __drawOk = true; try { Render.monsterBox(__e, 1); } catch (e) { __drawOk = false; }");
assert(get("__drawOk"), "elite portrait draws");

// --- regenerating affix heals at end of round
run(`
  const g = Combat.groups[0];
  Combat.groups = [g];
  const mm = g.members[0];
  mm.hp = mm.maxhp - 5;
  var __hurtHp = mm.hp;
  Combat.round = 0; Combat.msgs = []; Combat.intentRound = -1;
  Combat.surprised = false; Combat.surprising = false;
  Combat.actions = [];
  Combat.resolveRound();
  var __regained = g.members[0].hp - __hurtHp;
`);
assert(get("__regained") === get("Math.min(__e.lvl, 5)"), "regenerating elite heals its level in hp");
assert(get("Combat.msgs.join(' ')").includes("knits itself back together"), "regen is narrated");

// --- victory over an elite: kill counted, payroll note, guaranteed chest
run(`
  Combat.groups[0].members[0].hp = 1;
  Combat.round = 0; Combat.msgs = []; Combat.intentRound = -1;
  Combat.beginInput();
  Combat.actions = [{ ch: Game.party[0], type: "fight", group: Combat.groups[0] }];
  Combat.resolveRound();
`);
assert(get("Combat.endTo") === "victory", "elite slain");
assert(get("Game.counters.eliteKills") === 1, "elite kill feeds the eliteKills counter");
assert(get("Game.achievements.ELITE_1") === 1, "first named kill unlocks the achievement");
run("Combat.xpTotal = 100; Combat.victory();");
assert(get("Combat.msgs.join(' ')").includes("removed from the payroll"), "the System notes the elite's death");
assert(get("Combat.msgs.join(' ')").includes("CHEST"), "elites always guard a chest");

// --- fight targeting uses enemy-list numbers; rank rules still hold
run(`
  Combat.opts = {}; Combat.groups = [];
  Combat.addGroup("ORC", 2); Combat.addGroup("WOLF", 2); Combat.addGroup("KOBOLD", 2);
  Combat.groups[0].members.forEach(mm => mm.hp = 0); // front group slain
  Combat.round = 0; Combat.msgs = []; Combat.intentRound = -1;
  Combat.surprised = false; Combat.surprising = false;
  Combat.beginInput();
`);
press("f");
assert(get("Combat.sub") === "fightGroup", "multiple living groups ask for a target");
assert(H.els["panel"].innerHTML.includes("(2, 3 in melee reach)"), "prompt lists absolute group numbers");
press("3");
assert(get("Combat.actions[0].group.def.id") === "KOBOLD", "pressing 3 targets the group labeled 3");
run(`
  Combat.phase = "input"; Combat.inputIdx = 0; Combat.actions = [];
  Combat.sub = "fightGroup";
  Combat.groups[0].members.forEach(mm => mm.hp = 0); // may have woken from resolution
`);
press("1"); // slain group: auto-retarget instead of dead-end
assert(get("Combat.actions.length") === 1 && get("Combat.actions[0].group.def.id") === "WOLF", "dead group number retargets to the first living group");

done();
