"use strict";
// ================================================================ SKILLS
// Use-based skills, DCC-style: doing a thing enough times unlocks a skill;
// doing it more levels the skill (quadratically slower each level, and the
// effect itself has log2 diminishing returns via skillBonus()).
//
// Definition shape (registered into the SKILLS registry from data.js):
//   on:       event name (or array) that trains this skill
//   party:    true = every standing member progresses on the event;
//             otherwise the event's actor (payload ch/by/from) does
//   when:     optional predicate (payload, ch) => qualifies
//   unlockAt: qualifying uses to unlock (level 1); level L at unlockAt*L^2
//   mods:     contributions to the mod() pipeline (scaled by skill level)
//   vs:       optional monster predicate gating the mods
// Characters store {id, level, uses} in ch.skills; pre-unlock progress in ch.prog.

function defSkill(id, def) { SKILLS[id] = def; }

// -------------------------------------------------------------- melee
defSkill("BRAWLER", {
  name: "Brawling", desc: "Land 10 unarmed hits",
  flavor: "Your fists have developed opinions.",
  on: "swing", when: (p, ch) => p.hit && !equipped(ch, "weapon"),
  unlockAt: 10, mods: { dmg: 1 },
});
defSkill("SWORD_FORM", {
  name: "Sword Form", desc: "Land 25 hits with a sword",
  flavor: "The sword goes in the monster. You've formalized this.",
  on: "swing", when: (p, ch) => { const w = equipped(ch, "weapon"); return p.hit && w && /Sword/.test(w.name); },
  unlockAt: 25, mods: { toHit: 1 },
});
defSkill("BLUNT_TRAUMA", {
  name: "Blunt Trauma", desc: "Land 25 hits with a blunt weapon",
  flavor: "Percussion, but for people who hate music.",
  on: "swing", when: (p, ch) => { const w = equipped(ch, "weapon"); return p.hit && w && /Mace|Flail|Staff/.test(w.name); },
  unlockAt: 25, mods: { dmg: 1 },
});
defSkill("GRAVE_MANNERS", {
  name: "Grave Manners", desc: "Destroy 10 undead",
  flavor: "You've developed strong opinions about the ambulatory dead.",
  on: "kill", when: p => p.monster.undead,
  unlockAt: 10, mods: { dmg: 2 }, vs: m => m.undead,
});
defSkill("BUG_STOMPER", {
  name: "Bug Stomper", desc: "Kill 10 oversized arthropods",
  flavor: "Some problems are shoe-shaped. You are the shoe.",
  on: "kill", when: p => ["SPIDER", "BEETLE", "DRAGONFLY"].includes(p.monster.id),
  unlockAt: 10, mods: { dmg: 2 }, vs: m => ["SPIDER", "BEETLE", "DRAGONFLY"].includes(m.id),
});
defSkill("FINISHER", {
  name: "Finisher", desc: "Kill 25 monsters",
  flavor: "You've stopped saying 'sorry' first.",
  on: "kill", unlockAt: 25, mods: { dmg: 1 },
});
defSkill("CRITICAL_EYE", {
  name: "Critical Eye", desc: "Land 10 critical hits",
  flavor: "You've started seeing dotted lines on everyone's weak points.",
  on: "swing", when: p => p.crit,
  unlockAt: 10, mods: { crit: 2 },
});
defSkill("BEDSIDE_MANNER", {
  name: "Bedside Manner", desc: "Kill 5 sleeping monsters",
  flavor: "The Hippocratic Oath, reversed.",
  on: "kill", when: p => p.sleeping,
  unlockAt: 5, mods: { dmg: 1, crit: 1 },
});
defSkill("SHIELD_DISCIPLINE", {
  name: "Shield Discipline", desc: "Be missed 20 times while holding a shield",
  flavor: "The shield does the work. You do the standing.",
  on: "dodge", when: (p, ch) => !!equipped(ch, "shield"),
  unlockAt: 20, mods: { ac: 1 },
});
defSkill("PAIN_TOLERANCE", {
  name: "Pain Tolerance", desc: "Get hit 50 times",
  flavor: "You've been hit so often it's basically a schedule.",
  on: "damaged", unlockAt: 50, mods: { ac: 1 },
});

// -------------------------------------------------------------- magic
defSkill("EVOKER", {
  name: "Evocation Habit", desc: "Cast 15 damaging spells",
  flavor: "Fire is a language. You're becoming fluent.",
  on: "spell", when: p => SPELLS[p.name] && SPELLS[p.name].kind === "damage",
  unlockAt: 15, mods: { spellPower: 2 },
});
defSkill("FIELD_MEDIC", {
  name: "Field Medicine", desc: "Cast 15 healing spells",
  flavor: "You've learned where the blood is supposed to go, and how to negotiate its return.",
  on: "spell", when: p => SPELLS[p.name] && SPELLS[p.name].kind === "heal",
  unlockAt: 15, mods: { healPower: 2 },
});
defSkill("SYLLABLE_PRECISION", {
  name: "Syllable Precision", desc: "Kill 10 monsters with spells",
  flavor: "Enunciation kills.",
  on: "kill", when: p => p.how === "spell",
  unlockAt: 10, mods: { spellPower: 1 },
});

// -------------------------------------------------------------- exploration
defSkill("DOOR_SHOULDERER", {
  name: "Door Shoulderer", desc: "Go through 15 doors",
  flavor: "You and doors have an understanding. The understanding is violence.",
  on: "door", party: true, unlockAt: 15, mods: { toHit: 1 },
});
defSkill("DUNGEON_LEGS", {
  name: "Dungeon Legs", desc: "Walk 200 steps",
  flavor: "You've walked far enough underground to deserve a plaque. There is no plaque.",
  on: "step", party: true, unlockAt: 200, mods: { runChance: 5 },
});
defSkill("WALL_SENSE", {
  name: "Wall Sense", desc: "Walk into 25 walls",
  flavor: "After enough collisions, you and the architecture reach an accord.",
  on: "bump", party: true, unlockAt: 25, mods: { ac: 1 },
});

// -------------------------------------------------------------- larceny
defSkill("CHEST_PSYCHOLOGY", {
  name: "Chest Psychology", desc: "Inspect 10 chests",
  flavor: "You can tell what a chest is thinking. It's usually violence.",
  on: "chest", when: p => p.action === "inspect",
  unlockAt: 10, mods: { inspect: 10 },
});
defSkill("STEADY_HANDS", {
  name: "Steady Hands", desc: "Attempt 10 disarms",
  flavor: "Your fingers have opinions your brain isn't consulted on.",
  on: "chest", when: p => p.action === "disarm",
  unlockAt: 10, mods: { disarm: 10 },
});
defSkill("TRAP_SPONGE", {
  name: "Trap Sponge", desc: "Trigger 10 traps",
  flavor: "You've absorbed enough traps to legally qualify as one.",
  on: "trap", when: p => p.triggered,
  unlockAt: 10, mods: { ac: 1 },
});
defSkill("HAGGLING", {
  name: "Haggling", desc: "Complete 15 shop transactions",
  flavor: "Boltac hates you. Respectfully.",
  on: ["buy", "sell"], unlockAt: 15, mods: { goldGain: 10 },
});

// -------------------------------------------------------------- survival
defSkill("ANTIVENIN_LIFESTYLE", {
  name: "Antivenin Lifestyle", desc: "Suffer 30 ticks of poison",
  flavor: "This is not how immunity works. And yet.",
  on: "damaged", when: p => p.src.type === "poison",
  unlockAt: 30, mods: { ac: 1 },
});
defSkill("EXIT_STRATEGY", {
  name: "Exit Strategy", desc: "Successfully flee 5 battles",
  flavor: "Your best skill is leaving.",
  on: "flee", when: p => p.ok,
  unlockAt: 5, mods: { runChance: 10 },
});
defSkill("LOOT_INSTINCT", {
  name: "Loot Instinct", desc: "Open 15 chests' worth of loot",
  flavor: "You can smell gold through oak.",
  on: "loot", unlockAt: 15, mods: { goldGain: 10 },
});
defSkill("OVERACHIEVER", {
  name: "Overachiever", desc: "Win 30 battles",
  flavor: "The System has noticed you trying. It finds it adorable.",
  on: "victory", party: true, unlockAt: 30, mods: { xpGain: 5 },
});

// -------------------------------------------------------------- engine
const SKILL_INDEX = {}; // event type -> [skill ids]
for (const [id, def] of Object.entries(SKILLS)) {
  for (const ev of [].concat(def.on)) (SKILL_INDEX[ev] = SKILL_INDEX[ev] || []).push(id);
}

function skillLevelFor(def, uses) { return Math.floor(Math.sqrt(uses / def.unlockAt)); }

const Skills = {
  actorsFor(type, p) {
    if (["step", "bump", "door", "camp", "victory", "rest"].includes(type)) return Game.party.filter(isUp);
    const a = p.ch || p.by || p.from;
    return a && a.skills ? [a] : [];
  },
  train(type, p) {
    const ids = SKILL_INDEX[type];
    if (!ids) return;
    for (const id of ids) {
      const def = SKILLS[id];
      for (const ch of this.actorsFor(type, p)) {
        if (def.when && !def.when(p, ch)) continue;
        this.addUse(ch, id, def);
      }
    }
  },
  addUse(ch, id, def) {
    const entry = ch.skills.find(s => s.id === id);
    if (!entry) {
      if (!ch.prog) ch.prog = {};
      const n = (ch.prog[id] = (ch.prog[id] || 0) + 1);
      if (n >= def.unlockAt) {
        delete ch.prog[id];
        ch.skills.push({ id, level: 1, uses: n });
        UI.toast(`<b>SKILL UNLOCKED: ${esc(def.name)}</b><br>${esc(ch.name)} — ${esc(def.flavor)}`);
        UI.log(`[SYSTEM] ${ch.name} unlocks a skill: ${def.name}!`);
        Events.emit("skillUnlock", { ch, id });
      }
      return;
    }
    entry.uses++;
    const lvl = skillLevelFor(def, entry.uses);
    if (lvl > entry.level) {
      entry.level = lvl;
      UI.toast(`<b>SKILL UP: ${esc(def.name)} → L${lvl}</b><br>(${esc(ch.name)})`);
      UI.log(`[SYSTEM] ${ch.name}'s ${def.name} is now level ${lvl}.`);
      Events.emit("skillUp", { ch, id, level: lvl });
    }
  },
};
Events.onAny((type, p) => {
  if (type === "skillUnlock" || type === "skillUp") return;
  Skills.train(type, p);
});
