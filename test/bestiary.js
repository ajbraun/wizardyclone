"use strict";
// Monster inspection: lore coverage, the card, the combat flow (free action).
const { boot, makeChecker } = require("./harness");
const { assert, done } = makeChecker("bestiary");
const H = boot();
const { press, get, run } = H;

press("n");

// every campaign monster has hand-written lore
run('var __noLore = Object.values(MONSTERS).filter(m => !m.lore).map(m => m.id);');
for (const id of get("__noLore")) assert(false, "campaign monster missing lore: " + id);

// generated monsters get archetype lore, deterministically
run('Game.flags.seed = 31337;');
assert(get('getLevel(7).table.every(([id]) => MONSTERS[id].lore && MONSTERS[id].lore.length > 10)'), "generated monsters have lore");

// card content
run(`
  const ch = newChar("SCHOLAR", "Human", "Good", {STR:15,IQ:8,PIE:5,VIT:12,AGI:10,LUK:9}, "Fighter");
  ch.level = 8; ch.maxhp = 60; ch.hp = 60;
  Game.roster.push(ch); Game.party.push(ch);
  Game.counters["kill:SLIME"] = 12;
`);
const cardLow = get("monsterCard(MONSTERS.SLIME)");
assert(cardLow.includes("BUBBLY SLIME"), "card names the monster");
assert(cardLow.includes("entry-level exam"), "card includes lore");
assert(cardLow.includes("SLAIN BY YOU: 12"), "card shows personal kill count");
assert(cardLow.includes("Beneath you"), "L8 party vs L1 slime: punching-down assessment");
assert(get("monsterCard(MONSTERS.APPRENTICE)").includes("A fair fight"), "L7 boss vs L8 party: fair-fight assessment");
run("Game.party[0].level = 1;");
assert(get("monsterCard(MONSTERS.APPRENTICE)").includes("Statistically, you"), "L7 boss vs L1 party: outmatched assessment");
run("Game.party[0].level = 8;");
assert(get("monsterCard(MONSTERS.SHADE)").includes("paralytic touch"), "traits listed");
assert(get("monsterCard(MONSTERS.SKELETON)").includes("technically deceased"), "undead trait listed");

// combat flow: inspect is free (turn not consumed), then fight proceeds
run(`
  Game.maze = { level: 1, x: 9, y: 18, f: 0, light: 0 };
  Combat.opts = {}; Combat.groups = [];
  Combat.addGroup("ORC", 3);
  Combat.round = 0; Combat.xpTotal = 0; Combat.msgs = [];
  Combat.surprised = false; Combat.surprising = false;
  Game.go(CombatScreen);
  Combat.beginInput();
`);
const idxBefore = get("Combat.inputIdx");
press("i");
assert(get("Combat.sub") === "card", "single group inspects directly");
assert(H.els["panel"].innerHTML.includes("SYSTEM ASSESSMENT"), "card rendered in combat");
assert(H.els["panel"].innerHTML.includes("grudge it can't articulate"), "orc lore rendered");
press("l");
assert(get("Combat.sub") === "action", "card closes back to actions");
assert(get("Combat.inputIdx") === idxBefore, "inspecting costs no turn");
assert(get("Game.counters['e:inspectMonster']") === 1, "inspection counted for achievements");
// still able to act normally
press("f");
assert(get("Combat.phase") !== "input" || get("Combat.inputIdx") > idxBefore || get("Combat.round") > 0, "fight action still works after inspecting");

done();
