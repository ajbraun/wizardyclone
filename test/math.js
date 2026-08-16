"use strict";
// Combat math: logistic hit curve properties, campaign-band A/B vs the old
// clamped d20, empirical hit rates through real combat code, crit hook,
// and the level-relative XP rule.
const { boot, makeChecker } = require("./harness");
const { assert, done } = makeChecker("math");

// --- pure curve properties
const H = boot({ files: ["util.js"] });
const hc = d => H.get(`hitChance(${d})`);
assert(Math.abs(hc(0) - 0.5) < 1e-9, "50% at parity");
let mono = true;
for (let d = -40; d < 40; d++) if (hc(d + 1) <= hc(d)) mono = false;
assert(mono, "monotonic");
assert(hc(-100) >= 0.05 && hc(-100) < 0.051, "floor ~5%");
assert(hc(100) <= 0.95 && hc(100) > 0.949, "ceiling ~95%");
// campaign band: within 6 points of the old linear-clamped d20 for |delta| <= 8
// (worst case is at the band edges — a sigmoid can't hug a straight line exactly)
let maxDiff = 0;
for (let d = -8; d <= 8; d++) {
  const linear = Math.min(0.95, Math.max(0.05, 0.5 + d * 0.05));
  maxDiff = Math.max(maxDiff, Math.abs(hc(d) - linear));
}
assert(maxDiff <= 0.06, `campaign band matches old d20 (max diff ${maxDiff.toFixed(3)})`);
// but beyond the old cap, bonuses still matter (no saturation)
assert(hc(20) - hc(12) > 0.02, "still gains past old clamp");

// --- relXpMult: absolute world, relative rewards
const H2 = boot({ files: ["util.js", "events.js", "data.js", "char.js"] });
H2.run("var Game = {party:[]};");
const mult = (c, m) => H2.get(`relXpMult(${c}, ${m})`);
assert(mult(5, 5) === 1, "parity pays 100%");
assert(mult(5, 8) > 1.5 && mult(5, 8) <= 1.6001, "punching up pays premium");
assert(mult(1, 50) === 3, "punch-up capped at 3x");
assert(mult(9, 1) < 0.11, "punching down decays hard");
assert(mult(50, 1) === 0.05, "decay floors at 5%");

// --- empirical: real combat code paths
const G = boot();
G.press("n");
G.run(`
  const ch = newChar("STATFTR", "Human", "Neutral", {STR:10,IQ:8,PIE:5,VIT:14,AGI:10,LUK:9}, "Fighter");
  ch.level = 4; ch.maxhp = 500; ch.hp = 500;
  Game.roster.push(ch); Game.party.push(ch);
  Game.maze = { level: 1, x: 9, y: 18, f: 0, light: 0 };
  Combat.groups = []; Combat.addGroup("ORC", 4);
  Combat.msgs = []; Combat.xpTotal = 0; Combat.opts = {};
  var __sw = [], __dmgEvents = 0;
  Events.on("swing", p => __sw.push(p));
  Events.on("damaged", () => __dmgEvents++);
  var __g = Combat.groups[0];
  var __ch = ch;
`);
// party swings: fighter L4 (atk 4) vs ORC AC 9 => delta 4 => expect hitChance(4)
const N1 = 5000;
G.run(`
  for (let i = 0; i < ${N1}; i++) {
    __g.members.forEach(m => { m.hp = 5; m.asleep = false; m.para = false; });
    __ch.skills = []; __ch.prog = {}; // rates must measure a skill-free baseline
    Combat.msgs = [];
    Combat.partyAct({ ch: __ch, type: "fight", group: __g });
  }
`);
const swings = G.get("__sw");
const expP = hc(4);
const obsP = swings.filter(s => s.hit).length / swings.length;
assert(Math.abs(obsP - expP) < 0.025, `party hit rate ${obsP.toFixed(3)} ~ ${expP.toFixed(3)}`);
const baseCritRate = swings.filter(s => s.crit).length / Math.max(1, swings.filter(s => s.hit).length);
assert(baseCritRate > 0.005 && baseCritRate < 0.055, `base crit ~2% (got ${(baseCritRate * 100).toFixed(1)}%)`);

// crit skill through the mod pipeline
G.run(`
  SKILLS.__CRIT = { mods: { crit: 50 } };
  __ch.skills.push({ id: "__CRIT", level: 1, uses: 0 });
  __sw.length = 0;
  for (let i = 0; i < 3000; i++) {
    __g.members.forEach(m => { m.hp = 9; m.asleep = false; m.para = false; });
    __ch.skills = [{ id: "__CRIT", level: 1, uses: 0 }]; __ch.prog = {};
    Combat.msgs = [];
    Combat.partyAct({ ch: __ch, type: "fight", group: __g });
  }
  __ch.skills = []; delete SKILLS.__CRIT;
`);
const sw2 = G.get("__sw");
const critRate = sw2.filter(s => s.crit).length / Math.max(1, sw2.filter(s => s.hit).length);
assert(critRate > 0.44 && critRate < 0.56, `modded crit ~50% (got ${(critRate * 100).toFixed(1)}%)`);

// monster swings: ORC L1 vs AC 10 => delta 2 => expect hitChance(2)
G.run(`
  __dmgEvents = 0;
  var __mm = __g.members[0]; __mm.hp = 5;
  for (let i = 0; i < ${N1}; i++) {
    __ch.hp = 500; __ch.status = "OK";
    __ch.skills = []; __ch.prog = {}; // Pain Tolerance would skew the measurement
    Combat.msgs = [];
    Combat.monsterAct(__g, __mm);
  }
`);
const obsM = G.get("__dmgEvents") / N1;
const expM = hc(2);
assert(Math.abs(obsM - expM) < 0.025, `monster hit rate ${obsM.toFixed(3)} ~ ${expM.toFixed(3)}`);

done();
