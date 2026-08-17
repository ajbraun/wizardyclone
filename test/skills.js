"use strict";
// Skills: definitions, discovery, leveling, mod pipeline effects, persistence.
const { boot, makeChecker } = require("./harness");
const { assert, done } = makeChecker("skills");
const H = boot();
const { press, get, run } = H;

press("n");
run(`
  const ftr = newChar("PUNCHY", "Human", "Good", {STR:12,IQ:8,PIE:5,VIT:12,AGI:10,LUK:9}, "Fighter");
  const prs = newChar("HEALS", "Dwarf", "Good", {STR:10,IQ:7,PIE:14,VIT:10,AGI:5,LUK:6}, "Priest");
  Game.roster.push(ftr, prs); Game.party.push(ftr, prs);
  var __ftr = ftr, __prs = prs;
`);

// --- definition sanity
const MOD_KEYS = ["toHit", "dmg", "ac", "swings", "crit", "runChance", "inspect", "disarm", "xpGain", "goldGain", "spellPower", "healPower"];
run(`
  var __defErr = [];
  for (const [id, s] of Object.entries(SKILLS)) {
    if (!s.name || !s.flavor || !s.desc) __defErr.push("missing text " + id);
    if (!(s.unlockAt > 0)) __defErr.push("bad unlockAt " + id);
    if (!s.on) __defErr.push("no trigger " + id);
    if (!s.mods || !Object.keys(s.mods).length) __defErr.push("no mods " + id);
    for (const k of Object.keys(s.mods || {})) if (!${JSON.stringify(MOD_KEYS)}.includes(k)) __defErr.push("unknown mod key " + k + " in " + id);
  }
`);
for (const e of get("__defErr")) assert(false, e);
assert(get("Object.keys(SKILLS).length") >= 24, "at least 24 skills defined");

// --- discovery: 10 unarmed hits unlock Brawling for the actor only
run('for (let i = 0; i < 9; i++) Events.emit("swing", { ch: __ftr, hit: true, dmg: 1 });');
assert(get("__ftr.skills.length") === 0, "not unlocked early");
assert(get("__ftr.prog.BRAWLER") === 9, "pre-unlock progress tracked");
run('Events.emit("swing", { ch: __ftr, hit: true, dmg: 1 });');
assert(get('__ftr.skills.some(s => s.id === "BRAWLER" && s.level === 1)'), "Brawling unlocked at 10");
assert(get("__ftr.prog.BRAWLER === undefined"), "progress cleared after unlock");
assert(get("__prs.skills.length") === 0, "non-actor gains nothing");
assert(get("!!Game.achievements.SKILL_1"), "skill-unlock achievement fired");

// --- effect through the pipeline: Brawling L1 = +1 dmg exactly (log2(2) = 1)
assert(Math.abs(get('mod(__ftr, "dmg")') - 1) < 1e-9, "Brawling L1 grants +1 dmg");

// --- leveling: quadratic thresholds (L2 at unlockAt*4 = 40 uses)
run('for (let i = 0; i < 29; i++) Events.emit("swing", { ch: __ftr, hit: true, dmg: 1 });');
assert(get('__ftr.skills.find(s => s.id === "BRAWLER").level') === 1, "still L1 at 39 uses");
run('Events.emit("swing", { ch: __ftr, hit: true, dmg: 1 });');
assert(get('__ftr.skills.find(s => s.id === "BRAWLER").level') === 2, "L2 at 40 uses");
assert(get("Game.counters['e:skillUp']") === 1, "skill-up event counted");

// --- party-wide training: doors train everyone standing
run('for (let i = 0; i < 15; i++) Events.emit("door", { level: 1 });');
assert(get('__ftr.skills.some(s => s.id === "DOOR_SHOULDERER")'), "fighter shoulders doors");
assert(get('__prs.skills.some(s => s.id === "DOOR_SHOULDERER")'), "priest shoulders doors too");

// --- vs-gated mods: Grave Manners only applies against undead
run('for (let i = 0; i < 10; i++) Events.emit("kill", { by: __ftr, monster: MONSTERS.SKELETON, how: "melee" });');
assert(get('__ftr.skills.some(s => s.id === "GRAVE_MANNERS")'), "Grave Manners unlocked");
const dmgVsUndead = get('mod(__ftr, "dmg", { vs: MONSTERS.ZOMBIE })');
const dmgVsOrc = get('mod(__ftr, "dmg", { vs: MONSTERS.ORC })');
assert(Math.abs(dmgVsUndead - dmgVsOrc - 2) < 1e-9, "vs-undead bonus is +2 over baseline");

// --- spellPower reaches real combat spell damage (HALITO 1d8 + floor(2*log2(2)) = 3..10)
run(`
  __prs.skills.push({ id: "EVOKER", level: 1, uses: 15 });
  Game.maze = { level: 1, x: 9, y: 18, f: 0, light: 0 };
  Combat.groups = []; Combat.addGroup("ORC", 4);
  var __minDmg = 99;
  for (let i = 0; i < 60; i++) {
    Combat.groups[0].members.forEach(m => m.hp = 500);
    Combat.msgs = [];
    __prs.sp.priest[0] = 9;
    Combat.castCombatSpell(__prs, "BADIOS", { group: Combat.groups[0] });
    const m = /takes (\\d+)/.exec(Combat.msgs.join(" "));
    if (m) __minDmg = Math.min(__minDmg, +m[1]);
  }
`);
assert(get("__minDmg") >= 3, "spellPower adds to spell damage (min roll " + get("__minDmg") + ")");

// --- healPower reaches healing
run(`
  __prs.skills.push({ id: "FIELD_MEDIC", level: 1, uses: 15 });
  var __minHeal = 99;
  for (let i = 0; i < 40; i++) {
    __prs.hp = 1;
    __prs.sp.priest[0] = 9;
    var __before = __prs.hp;
    castCampSpell(__prs, "DIOS", __prs);
    __minHeal = Math.min(__minHeal, __prs.hp - __before);
  }
`);
assert(get("__minHeal") >= 3, "healPower adds to healing (min " + get("__minHeal") + ")");

// --- character sheet shows skills with their effects
assert(get("UI.charSheet(__ftr)").includes("Brawling L2"), "sheet lists skill with level");
assert(get('skillEffectStr({ id: "BRAWLER", level: 2 })') === "+1.6 damage", "effect string computes level scaling");
assert(get('skillEffectStr({ id: "GRAVE_MANNERS", level: 1 })') === "+2 damage vs undead", "vs-gated effect labeled");
assert(get("UI.charSheet(__ftr)").includes("damage"), "sheet includes effect text");

// --- AC stays an integer even with fractional skill scaling (log2 levels)
run('__ftr.skills.push({ id: "WALL_SENSE", level: 2, uses: 100 }, { id: "PAIN_TOLERANCE", level: 4, uses: 800 });');
assert(get("Number.isInteger(acOf(__ftr))"), "AC is an integer with fractional skill bonuses (got " + get("acOf(__ftr)") + ")");
run('__ftr.skills = __ftr.skills.filter(s => s.id === "BRAWLER" || s.id === "DOOR_SHOULDERER" || s.id === "GRAVE_MANNERS");');

// --- persistence: skills and pre-unlock progress survive save/load
run('Events.emit("swing", { ch: __prs, hit: true, dmg: 1 });'); // priest starts brawling progress
run("Game.save(); Game.load();");
assert(get('Game.roster.find(c => c.name === "PUNCHY").skills.some(s => s.id === "BRAWLER" && s.level === 2)'), "skills persist");
assert(get('Game.roster.find(c => c.name === "HEALS").prog.BRAWLER') === 1, "pre-unlock progress persists");

done();
