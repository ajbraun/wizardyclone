"use strict";
// ---------------------------------------------------------------- races
const STATS = ["STR", "IQ", "PIE", "VIT", "AGI", "LUK"];
const RACES = {
  Human:  { STR: 8, IQ: 8,  PIE: 5,  VIT: 8,  AGI: 8,  LUK: 9 },
  Elf:    { STR: 7, IQ: 10, PIE: 10, VIT: 6,  AGI: 9,  LUK: 6 },
  Dwarf:  { STR: 10, IQ: 7, PIE: 10, VIT: 10, AGI: 5,  LUK: 6 },
  Gnome:  { STR: 7, IQ: 7,  PIE: 10, VIT: 8,  AGI: 10, LUK: 7 },
  Hobbit: { STR: 5, IQ: 7,  PIE: 7,  VIT: 6,  AGI: 10, LUK: 12 },
};
// ---------------------------------------------------------------- classes
// req: minimum stats. align: allowed alignments. hd: hit die.
// books: which spellbooks, learnAt(s) = char level at which spell-level s opens.
const CLASSES = {
  Fighter: { req: { STR: 11 }, align: ["Good", "Neutral", "Evil"], hd: 10, xp: 1000, books: {} },
  Mage:    { req: { IQ: 11 }, align: ["Good", "Neutral", "Evil"], hd: 4, xp: 1100, books: { mage: s => s * 2 - 1 } },
  Priest:  { req: { PIE: 11 }, align: ["Good", "Evil"], hd: 8, xp: 1050, books: { priest: s => s * 2 - 1 } },
  Thief:   { req: { AGI: 11 }, align: ["Neutral", "Evil"], hd: 6, xp: 900, books: {} },
  Bishop:  { req: { IQ: 12, PIE: 12 }, align: ["Good", "Evil"], hd: 6, xp: 1200, books: { mage: s => s * 4 - 3, priest: s => s * 4 - 1 } },
  Samurai: { req: { STR: 15, IQ: 11, PIE: 10, VIT: 14, AGI: 10 }, align: ["Good", "Neutral"], hd: 8, xp: 1250, books: { mage: s => s * 2 + 2 } },
  Lord:    { req: { STR: 15, IQ: 12, PIE: 12, VIT: 15, AGI: 14, LUK: 15 }, align: ["Good"], hd: 10, xp: 1300, books: { priest: s => s * 2 + 2 } },
  Ninja:   { req: { STR: 17, IQ: 17, PIE: 17, VIT: 17, AGI: 17, LUK: 17 }, align: ["Evil"], hd: 6, xp: 1450, books: {} },
};
const FIGHTER_TYPES = ["Fighter", "Samurai", "Lord", "Ninja"];
// ---------------------------------------------------------------- spells
// book, sl: spell level, kind + params. where: 'combat', 'camp', 'any', 'chest'
const SPELLS = {
  HALITO:   { book: "mage", sl: 1, where: "combat", kind: "damage", dice: "1d8", target: "foe", desc: "Flame dart, 1-8 dmg to one foe" },
  KATINO:   { book: "mage", sl: 1, where: "combat", kind: "sleep", target: "group", desc: "Puts a group of foes to sleep" },
  MOGREF:   { book: "mage", sl: 1, where: "combat", kind: "acself", amt: 2, desc: "Caster AC -2 for this battle" },
  DUMAPIC:  { book: "mage", sl: 1, where: "camp", kind: "locate", desc: "Reveals your location in the maze" },
  DILTO:    { book: "mage", sl: 2, where: "combat", kind: "acfoe", amt: 2, target: "group", desc: "Foe group easier to hit" },
  SOPIC:    { book: "mage", sl: 2, where: "combat", kind: "acself", amt: 4, desc: "Caster AC -4 for this battle" },
  MAHALITO: { book: "mage", sl: 3, where: "combat", kind: "damage", dice: "4d6", target: "group", desc: "Firestorm, 4-24 dmg to a group" },
  MOLITO:   { book: "mage", sl: 3, where: "combat", kind: "damage", dice: "3d6", target: "group", desc: "Sparks, 3-18 dmg to a group" },
  DIOS:     { book: "priest", sl: 1, where: "any", kind: "heal", dice: "1d8", target: "ally", desc: "Heals an ally 1-8 HP" },
  BADIOS:   { book: "priest", sl: 1, where: "combat", kind: "damage", dice: "1d8", target: "foe", desc: "Harm, 1-8 dmg to one foe" },
  KALKI:    { book: "priest", sl: 1, where: "combat", kind: "acparty", amt: 1, desc: "Party AC -1 for this battle" },
  MILWA:    { book: "priest", sl: 1, where: "any", kind: "light", amt: 40, desc: "Magical light (extends sight)" },
  PORFIC:   { book: "priest", sl: 1, where: "combat", kind: "acself", amt: 4, desc: "Caster AC -4 for this battle" },
  MATU:     { book: "priest", sl: 2, where: "combat", kind: "acparty", amt: 2, desc: "Party AC -2 for this battle" },
  MANIFO:   { book: "priest", sl: 2, where: "combat", kind: "paralyze", target: "group", desc: "Freezes a group of foes" },
  MONTINO:  { book: "priest", sl: 2, where: "combat", kind: "silence", target: "group", desc: "Silences a group's spellcasters" },
  CALFO:    { book: "priest", sl: 2, where: "chest", kind: "calfo", desc: "Reveals a chest's trap (95%)" },
  DIAL:     { book: "priest", sl: 3, where: "any", kind: "heal", dice: "2d8", target: "ally", desc: "Heals an ally 2-16 HP" },
  BADIAL:   { book: "priest", sl: 3, where: "combat", kind: "damage", dice: "2d8", target: "foe", desc: "Harm, 2-16 dmg to one foe" },
  LOMILWA:  { book: "priest", sl: 3, where: "any", kind: "light", amt: 200, desc: "Great light (lasts a long time)" },
  DIALKO:   { book: "priest", sl: 3, where: "any", kind: "cureparalyze", target: "ally", desc: "Cures paralysis" },
  LATUMOFIS:{ book: "priest", sl: 3, where: "any", kind: "curepoison", target: "ally", desc: "Cures poison" },
};
// ---------------------------------------------------------------- items
// slot: weapon | armor | shield | helm | potion. ac = AC improvement.
const ITEMS = {
  DAGGER:      { name: "Dagger", slot: "weapon", dmg: "1d4", price: 15, cls: ["Fighter","Mage","Thief","Bishop","Samurai","Lord","Ninja"] },
  STAFF:       { name: "Staff", slot: "weapon", dmg: "1d5", price: 10, cls: null },
  SHORTSWORD:  { name: "Short Sword", slot: "weapon", dmg: "1d6", price: 15, cls: ["Fighter","Thief","Samurai","Lord","Ninja"] },
  LONGSWORD:   { name: "Long Sword", slot: "weapon", dmg: "1d8", price: 25, cls: ["Fighter","Samurai","Lord"] },
  MACE:        { name: "Anointed Mace", slot: "weapon", dmg: "2d3", price: 30, cls: ["Fighter","Priest","Bishop","Lord"] },
  FLAIL:       { name: "Anointed Flail", slot: "weapon", dmg: "1d8+1", price: 150, cls: ["Fighter","Priest","Bishop","Lord"] },
  ROBES:       { name: "Robes", slot: "armor", ac: 1, price: 15, cls: null },
  LEATHER:     { name: "Leather Armor", slot: "armor", ac: 2, price: 50, cls: ["Fighter","Priest","Thief","Bishop","Samurai","Lord","Ninja"] },
  CHAINMAIL:   { name: "Chain Mail", slot: "armor", ac: 3, price: 90, cls: ["Fighter","Priest","Samurai","Lord"] },
  BREASTPLATE: { name: "Breast Plate", slot: "armor", ac: 4, price: 200, cls: ["Fighter","Samurai","Lord"] },
  PLATEMAIL:   { name: "Plate Mail", slot: "armor", ac: 5, price: 750, cls: ["Fighter","Samurai","Lord"] },
  SMALLSHIELD: { name: "Small Shield", slot: "shield", ac: 1, price: 20, cls: ["Fighter","Priest","Thief","Bishop","Samurai","Lord"] },
  LARGESHIELD: { name: "Large Shield", slot: "shield", ac: 2, price: 40, cls: ["Fighter","Samurai","Lord"] },
  HELM:        { name: "Helm", slot: "helm", ac: 1, price: 100, cls: ["Fighter","Samurai","Lord"] },
  // accessories — for the party members who die to fireballs in the back row
  CLOAK:       { name: "Traveler's Cloak", slot: "cloak", ac: 1, price: 120, cls: null },
  CLOAKVIT:    { name: "Constitution Cloak", slot: "cloak", ac: 1, mods: { maxhp: 8 }, price: 900, cls: null },
  RINGVIT:     { name: "Vitality Ring", slot: "ring", mods: { maxhp: 5 }, price: 400, cls: null },
  RINGWARD:    { name: "Ring of Warding", slot: "ring", mods: { resist: 30 }, price: 600, cls: null },
  P_DIOS:      { name: "Potion of Dios", slot: "potion", use: "heal", dice: "1d8", price: 500, cls: null },
  P_LATUMOFIS: { name: "Potion of Latumofis", slot: "potion", use: "curepoison", price: 300, cls: null },
  // treasure only
  LONGSWORD1:  { name: "Long Sword +1", slot: "weapon", dmg: "1d8+2", price: 1000, cls: ["Fighter","Samurai","Lord"], loot: true },
  MACE1:       { name: "Mace +1", slot: "weapon", dmg: "2d3+2", price: 900, cls: ["Fighter","Priest","Bishop","Lord"], loot: true },
  CHAINMAIL1:  { name: "Chain Mail +1", slot: "armor", ac: 4, price: 900, cls: ["Fighter","Priest","Samurai","Lord"], loot: true },
  SHIELD1:     { name: "Shield +1", slot: "shield", ac: 2, price: 700, cls: null, loot: true },
  JEWELEDAMULET: { name: "Jeweled Amulet", slot: "potion", use: "heal", dice: "1d8", price: 5000, cls: null, loot: true },
};
const SHOP_STOCK = ["DAGGER","STAFF","SHORTSWORD","LONGSWORD","MACE","FLAIL","ROBES","LEATHER","CHAINMAIL","BREASTPLATE","PLATEMAIL","SMALLSHIELD","LARGESHIELD","HELM","P_DIOS","P_LATUMOFIS","CLOAK","CLOAKVIT","RINGVIT","RINGWARD"];
const LOOT_TABLE = {
  1: ["P_DIOS","LEATHER","SMALLSHIELD","MACE","P_LATUMOFIS"],
  2: ["P_DIOS","P_LATUMOFIS","CHAINMAIL","LARGESHIELD","FLAIL","HELM"],
  3: ["LONGSWORD1","MACE1","CHAINMAIL1","SHIELD1","P_DIOS","BREASTPLATE","JEWELEDAMULET"],
};
// ---------------------------------------------------------------- monsters
// hp/dmg dice; ac descending (lower = harder to hit); num = group size.
const MONSTERS = {
  SLIME:     { name: "Bubbly Slime", pl: "Bubbly Slimes", lvl: 1, hp: "1d4", ac: 11, dmg: ["1d3"], num: "1d6", xp: 55 },
  KOBOLD:    { name: "Kobold", pl: "Kobolds", lvl: 1, hp: "1d6", ac: 10, dmg: ["1d4"], num: "2d3", xp: 60 },
  GIANTRAT:  { name: "Giant Rat", pl: "Giant Rats", lvl: 1, hp: "1d4", ac: 9, dmg: ["1d3"], num: "1d6", xp: 70, poison: true },
  ORC:       { name: "Orc", pl: "Orcs", lvl: 1, hp: "1d8", ac: 9, dmg: ["1d6"], num: "1d4+1", xp: 90 },
  ROGUE:     { name: "Rogue", pl: "Rogues", lvl: 2, hp: "2d6", ac: 8, dmg: ["1d6"], num: "1d3", xp: 130 },
  SKELETON:  { name: "Skeleton", pl: "Skeletons", lvl: 2, hp: "2d8", ac: 8, dmg: ["1d6"], num: "1d4", xp: 150, undead: true },
  ZOMBIE:    { name: "Zombie", pl: "Zombies", lvl: 2, hp: "2d8", ac: 9, dmg: ["1d8"], num: "1d4", xp: 140, undead: true },
  CRUD:      { name: "Creeping Crud", pl: "Creeping Cruds", lvl: 2, hp: "3d4", ac: 9, dmg: ["1d6"], num: "1d4", xp: 120, poison: true },
  MAGE1:     { name: "Lvl 1 Mage", pl: "Lvl 1 Mages", lvl: 2, hp: "2d4", ac: 10, dmg: ["1d4"], num: "1d3", xp: 160, mage: 1 },
  PRIEST1:   { name: "Lvl 1 Priest", pl: "Lvl 1 Priests", lvl: 2, hp: "2d6", ac: 9, dmg: ["1d6"], num: "1d2", xp: 170, priest: 1 },
  WOLF:      { name: "Wolf", pl: "Wolves", lvl: 3, hp: "2d8", ac: 8, dmg: ["1d4", "1d4"], num: "1d4", xp: 200 },
  BUSHWACKER:{ name: "Bushwacker", pl: "Bushwackers", lvl: 3, hp: "3d6", ac: 7, dmg: ["1d8"], num: "1d4", xp: 240 },
  SPIDER:    { name: "Huge Spider", pl: "Huge Spiders", lvl: 3, hp: "3d8", ac: 6, dmg: ["1d6"], num: "1d3", xp: 280, poison: true },
  PRIEST3:   { name: "Lvl 3 Priest", pl: "Lvl 3 Priests", lvl: 3, hp: "3d8", ac: 7, dmg: ["1d6"], num: "1d2", xp: 320, priest: 2 },
  SAMURAI3:  { name: "Lvl 3 Samurai", pl: "Lvl 3 Samurai", lvl: 4, hp: "4d8", ac: 6, dmg: ["1d8", "1d8"], num: "1d2", xp: 420, sleepResist: 50 },
  GARGOYLE:  { name: "Gargoyle", pl: "Gargoyles", lvl: 4, hp: "4d8", ac: 5, dmg: ["1d4", "1d4", "1d6"], num: "1d2", xp: 470, sleepResist: 100 },
  DRAGONFLY: { name: "Dragon Fly", pl: "Dragon Flies", lvl: 4, hp: "4d6", ac: 6, dmg: ["1d4"], num: "1d3", xp: 450, breath: "fire" },
  BEETLE:    { name: "Boring Beetle", pl: "Boring Beetles", lvl: 5, hp: "5d8", ac: 5, dmg: ["2d6"], num: "1d3", xp: 550, sleepResist: 50 },
  WEREWOLF:  { name: "Werewolf", pl: "Werewolves", lvl: 5, hp: "5d8", ac: 5, dmg: ["2d4", "2d4"], num: "1d2", xp: 650, sleepResist: 50 },
  SHADE:     { name: "Shade", pl: "Shades", lvl: 5, hp: "4d8", ac: 4, dmg: ["1d8"], num: "1d2", xp: 700, undead: true, paralyze: true, sleepResist: 100 },
  MAGE5:     { name: "Lvl 5 Mage", pl: "Lvl 5 Mages", lvl: 5, hp: "5d4", ac: 8, dmg: ["1d6"], num: "1d2", xp: 750, mage: 3 },
  APPRENTICE:{ name: "Werdna's Apprentice", pl: "Werdna's Apprentices", lvl: 7, hp: "8d8+16", ac: 2, dmg: ["2d8", "2d8"], num: "1", xp: 3200, mage: 3, sleepResist: 100, boss: true },
};
// give every monster def its own id (used by kill counters and achievements)
for (const k of Object.keys(MONSTERS)) MONSTERS[k].id = k;
// the System's bestiary notes — it sees all, it respects little
const MONSTER_LORE = {
  SLIME: "The dungeon's entry-level exam. It is somehow still killing people.",
  KOBOLD: "Small, angry, and unionized. They get a group rate on ambushes.",
  GIANTRAT: "A rodent of unusual size and unremarkable hygiene. The poison is complimentary.",
  ORC: "Standard-issue dungeon muscle. Comes with a sword and a grudge it can't articulate.",
  ROGUE: "Chose violence as a career and mediocrity as a specialty.",
  SKELETON: "Someone's grandfather, weaponized. Sleep spells bounce off — the dead have had enough rest.",
  ZOMBIE: "Slow, rotting, persistent. Like email.",
  CRUD: "It's called Creeping Crud and it still wins fights. Reflect on that.",
  MAGE1: "Owns one spell and the confidence of ten. The confidence is the dangerous part.",
  PRIEST1: "Preaches briefly, harms immediately. Tithing is not optional.",
  WOLF: "A dog that gave up on people. Two bites per opinion.",
  BUSHWACKER: "A professional ambusher. The bush was never the point.",
  SPIDER: "Eight legs, one agenda. The venom is included at no extra charge.",
  PRIEST3: "Middle management of an unpleasant faith. Casts harm with a straight face.",
  SAMURAI3: "Honor, discipline, and two attacks per round. Mostly the two attacks.",
  GARGOYLE: "Architecture with a grudge. Three attacks, zero interest in your feelings.",
  DRAGONFLY: "A flying grudge with a fire budget. Its breath scales with its health, which you will come to resent.",
  BEETLE: "The 'Boring' refers to what it does to armor, not to conversation. Mostly.",
  WEREWOLF: "A commitment issue with claws.",
  SHADE: "What's left when a person subtracts the body. Its touch files your muscles under 'later.'",
  MAGE5: "Finished the whole spellbook. MAHALITO is its love language.",
  APPRENTICE: "Werdna's intern: unpaid, overpowered, and auditioning for the job. End the interview.",
};
for (const k of Object.keys(MONSTER_LORE)) if (MONSTERS[k]) MONSTERS[k].lore = MONSTER_LORE[k];
// portrait archetype for the combat monster window (see Render.monsterBox)
const MONSTER_ART = {
  SLIME: "blob", CRUD: "blob",
  KOBOLD: "humanoid", ORC: "humanoid", ROGUE: "humanoid", BUSHWACKER: "humanoid", SAMURAI3: "humanoid",
  MAGE1: "caster", PRIEST1: "caster", PRIEST3: "caster", MAGE5: "caster", APPRENTICE: "caster",
  SKELETON: "undead", ZOMBIE: "undead", SHADE: "undead",
  GIANTRAT: "beast", WOLF: "beast", WEREWOLF: "beast",
  SPIDER: "bug", BEETLE: "bug",
  DRAGONFLY: "drake",
  GARGOYLE: "brute",
};
for (const k of Object.keys(MONSTER_ART)) if (MONSTERS[k]) MONSTERS[k].art = MONSTER_ART[k];
// ---------------------------------------------------------------- skills
// Registry of skill definitions (populated in phase 3). Characters store
// {id, level, uses}; effects contribute through the mod() pipeline.
const SKILLS = {};
// cumulative XP needed to reach a level
function xpForLevel(cls, level) {
  if (level <= 1) return 0;
  return Math.floor(CLASSES[cls].xp * Math.pow(1.72, level - 2));
}
