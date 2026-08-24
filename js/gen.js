"use strict";
// ================================================================ THE CRAWL
// Endless floors below level 3. Deterministic per save: same seed -> same
// layout and monsters, so generated levels never need to be persisted.
// Design law: the world is absolute — floor N has floor-N monsters no matter
// who walks in.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GEN_ADJ = ["Dire", "Feral", "Blighted", "Ancient", "Vicious", "Spectral", "Rabid", "Iron", "Venomous", "Grim", "Howling", "Abyssal"];
const GEN_ARCH = [
  { key: "brute",   nouns: ["Ogre", "Troll", "Minotaur", "Golem"], hpD: 8, dmg: 1.2, num: "1d2", ac: 0 },
  { key: "pack",    nouns: ["Stalker", "Hound", "Ghoul", "Marauder"], hpD: 6, dmg: 0.8, num: "2d3", ac: 1 },
  { key: "caster",  nouns: ["Warlock", "Hexer", "Flame Mage"], hpD: 4, dmg: 0.7, num: "1d2", ac: 2, mage: true },
  { key: "priest",  nouns: ["Cultist", "Death Priest", "Acolyte"], hpD: 6, dmg: 0.8, num: "1d2", ac: 1, priest: true },
  { key: "breather", nouns: ["Drake", "Salamander", "Wyrm"], hpD: 8, dmg: 0.9, num: "1d2", ac: 0, breath: true },
  { key: "undead",  nouns: ["Wight", "Revenant", "Bone Knight"], hpD: 8, dmg: 1.0, num: "1d3", ac: 1, undead: true },
  { key: "stinger", nouns: ["Scorpion", "Widow", "Needle Wasp"], hpD: 6, dmg: 0.7, num: "1d4", ac: 1, poison: true },
];
const GEN_LORE = {
  brute: [
    "All muscle and no small talk. Negotiations are conducted in blunt-force trauma.",
    "It solved the dungeon's puzzles by being the wall.",
    "Somewhere it has a family. They are also enormous and also angry.",
  ],
  pack: [
    "They hunt in groups because the System gives them a bulk discount.",
    "One is a nuisance. Four are a scheduling problem.",
    "It has friends. That's the whole threat model.",
  ],
  caster: [
    "Studied at an unaccredited tower. The fireballs are real, though.",
    "Its wand is licensed. Its judgment is not.",
    "It knows exactly one conversation-ender and it is on fire.",
  ],
  priest: [
    "Middle management of a faith you don't want the details on.",
    "It tithes in other people's blood.",
    "The sermon is short. The harm spell is shorter.",
  ],
  breather: [
    "A fire hazard with wings and opinions.",
    "Workplace safety regulations do not operate at this depth.",
    "It exhales what your armor merely delays.",
  ],
  undead: [
    "Retired from life, not from violence.",
    "It remembers being alive. It does not remember fondly.",
    "Grief with a weapon rating.",
  ],
  stinger: [
    "Evolution kept the worst parts and sharpened them.",
    "The venom is complimentary. The antivenin is 300 gold.",
    "It considers you a food-shaped scheduling opportunity.",
  ],
};
// Floor modifiers: one-line rules the System announces on arrival. Rolled
// deterministically with the floor (same seed -> same modifier). Crawl only.
const FLOOR_MODS = [
  { id: "BLOOD", name: "BLOOD SURCHARGE", mdmg: 2, goldMult: 1.5,
    announce: "[SYSTEM] Floor modifier: BLOOD SURCHARGE. Everything here hits harder. Hazard pay: +50% gold." },
  { id: "DARK", name: "BLACKOUT", dark: true, goldMult: 1.5,
    announce: "[SYSTEM] Floor modifier: BLACKOUT. Your map subscription does not cover this floor. Loot pays +50% for the inconvenience." },
  { id: "SWARM", name: "RUSH HOUR", rate: 18, xpMult: 1.25,
    announce: "[SYSTEM] Floor modifier: RUSH HOUR. Everyone is out today, and they are all headed toward you. XP +25%." },
  { id: "SPONSORED", name: "SPONSORED FLOOR", eliteMult: 4, goldMult: 1.25,
    announce: "[SYSTEM] This floor is brought to you by a NAMED monster. It knows you're here. It has told its friends." },
  { id: "QUIET", name: "HIRING FREEZE", rate: 4,
    announce: "[SYSTEM] Floor modifier: HIRING FREEZE. The monsters are understaffed. Enjoy the silence. Earn nothing extra." },
  { id: "GREED", name: "AUDIT SEASON", chestTrap: true, chestGoldMult: 2,
    announce: "[SYSTEM] Floor modifier: AUDIT SEASON. Every chest on this floor is trapped, and twice as rich. Choose greedily." },
];
// combat and maze code consult the current floor's modifier through this
function floorMod() {
  const map = Game.maze ? getLevel(Game.maze.level) : null;
  return (map && map.mod) || {};
}
// ================================================================ BIOME BANDS
// Every 5 floors is a place: a name, a monster leaning, a phosphor tint for
// the wireframe, and its own graffiti. The System narrates the transitions.
const BANDS = [
  { name: "The Warrens", tint: "#d8ffd8", weights: { pack: 4, stinger: 3, brute: 2 },
    layout: { loops: 100, rooms: 8, rmin: 2, rmax: 4 },  // tunnels and small chambers
    intro: "[SYSTEM] Now entering THE WARRENS (floors 4-8). Everything here is small, numerous, and personally motivated.",
    msgs: ["Something chitters in the walls. The walls chitter back.",
      "A thousand small tunnels branch off here, all rodent-sized. Some recently widened."] },
  { name: "The Drowned Court", tint: "#c2f0ff", weights: { priest: 4, caster: 2, undead: 2 },
    layout: { loops: 55, rooms: 6, rmin: 4, rmax: 7 },  // flooded halls
    intro: "[SYSTEM] Now entering THE DROWNED COURT (floors 9-13). Dress code: waterlogged. The nobility never left.",
    msgs: ["The stone weeps steadily. The ceiling has opinions about being a floor.",
      "A waterline stain runs the length of the wall, well above your head."] },
  { name: "The Bone Orchard", tint: "#f0eedd", weights: { undead: 5, priest: 2 },
    layout: { loops: 70, rooms: 6, rmin: 3, rmax: 6 },  // crypt rows
    intro: "[SYSTEM] Now entering THE BONE ORCHARD (floors 14-18). Everything here was buried properly. It didn't take.",
    msgs: ["The floor crunches underfoot. You decide not to inventory why.",
      "Someone stacked femurs here with real curatorial intent."] },
  { name: "The Furnace Levels", tint: "#ffd9a0", weights: { breather: 4, brute: 2 },
    layout: { loops: 90, rooms: 6, rmin: 4, rmax: 7 }, // open works
    intro: "[SYSTEM] Now entering THE FURNACE LEVELS (floors 19-23). Workplace safety does not operate at this depth.",
    msgs: ["The air shimmers. Your armor has become a cooking implement.",
      "Slag runs in the gutters, like the building is sweating metal."] },
  { name: "The Silent Archive", tint: "#d8d0e8", weights: { caster: 4, undead: 2, priest: 2 },
    layout: { loops: 45, rooms: 7, rmin: 2, rmax: 5 },  // stacks — deliberately the most labyrinthine
    intro: "[SYSTEM] Now entering THE SILENT ARCHIVE (floors 24-28). Some records are sealed because they are load-bearing.",
    msgs: ["Shelves of ledgers, every page blank. Or redacted. Hard to say which is worse.",
      "A sign reads QUIET PLEASE. Something underlined it. Recently. In claw."] },
  { name: "The Root", tint: "#ffc2c2", weights: { brute: 2, breather: 2, undead: 2, caster: 2, priest: 2 },
    layout: { loops: 140, rooms: 7, rmin: 4, rmax: 7 }, // caverns
    intro: "[SYSTEM] Now entering THE ROOT (floors 29-33). The dungeon stops pretending here.",
    msgs: ["The walls are warm, and slightly too regular. Like scales.",
      "Everything down here hums at a frequency your teeth dislike."] },
  { name: "The After", tint: "#b8ccb8", weights: {},
    layout: { loops: 90, rooms: 5, rmin: 3, rmax: 6 },
    intro: "[SYSTEM] There is no floor 34. Nevertheless, here you are.",
    msgs: ["There is no map for this. There was never supposed to be a here.",
      "The System's signage has given up. A hand-painted arrow points down."] },
];
function bandOf(n) { return BANDS[Math.max(0, Math.min(BANDS.length - 1, Math.floor((n - 4) / 5)))]; }

// ---------------------------------------------------------------- wardens
// A hand-built boss seals the last floor of each band. Killing it opens the
// band below and extends the elevator. The System sells this as a promotion.
const WARDENS = {
  8: { name: "Mother of Thousands", art: "bug", lvl: 9, hp: "12d8+20", ac: 2, dmg: ["2d6", "2d6", "1d6"], xp: 4000,
    poison: true, affix: { key: "FRENZIED", trait: "attacks in brooding fury" }, base: "brood-mother",
    lore: "Every rat and wasp you've killed had a mother. Statistically, this is her." },
  13: { name: "The Magistrate Below", art: "caster", lvl: 14, hp: "16d8+40", ac: 0, dmg: ["2d8", "2d8"], xp: 9000,
    priest: 2, affix: { key: "REGENERATING", trait: "regenerates every round" }, base: "drowned judge",
    lore: "It presides over a court of the drowned. Attendance is mandatory and posthumous." },
  18: { name: "The Grand Ossuary", art: "undead", lvl: 19, hp: "20d8+60", ac: -3, dmg: ["3d6", "3d6"], xp: 16000,
    undead: true, affix: { key: "ARMORED", trait: "absurdly armored" }, base: "walking reliquary",
    lore: "A cathedral that gave up on holding still. It collects donations by force." },
  23: { name: "Slagmaw", art: "drake", lvl: 24, hp: "24d10+80", ac: -2, dmg: ["3d8", "3d8"], xp: 26000,
    breath: "fire", affix: { key: "GILDED", trait: "worth triple gold" }, base: "furnace drake",
    lore: "It eats gold and is, at this point, mostly gold. The System calls this an incentive structure." },
  28: { name: "The Redacted", art: "caster", lvl: 29, hp: "28d10+120", ac: -4, dmg: ["3d8", "3d8"], xp: 40000,
    mage: 3, affix: { key: "ARMORED", trait: "half-erased (absurdly hard to hit)" }, base: "expunged librarian",
    lore: "[EXPUNGED] at its own request. The request was granted mid-sentence." },
  33: { name: "The Custodian", art: "brute", lvl: 34, hp: "33d10+160", ac: -6, dmg: ["4d8", "4d8", "2d8"], xp: 60000,
    affix: { key: "REGENERATING", trait: "regenerates every round" }, base: "maintenance engine",
    lore: "It maintains the bottom of the world. You are filed under 'debris.'" },
};
for (const [floor, wd] of Object.entries(WARDENS)) {
  wd.id = "WARDEN" + floor;
  wd.pl = wd.name;
  wd.num = "1";
  wd.elite = true;
  wd.sleepResist = 100;
  MONSTERS[wd.id] = wd;
}

// found on the remains of less fortunate crawlers
const REMAINS_NOTES = [
  "A final journal entry: 'The vault was a mimic. The mimic was also—'",
  "Their map is meticulous until this floor, where it just says 'NO.'",
  "They died holding a receipt. The System honors receipts.",
  "A note: 'Tell Steve the elevator was NOT faster.'",
  "Their last words, carved neatly: 'Almost had him.'",
  "An unsent letter home. It's mostly apologies and loot coordinates.",
];
const GEN_MSGS = [
  "A scrawl on the wall: 'THE SYSTEM THANKS YOU FOR YOUR CONTINUED DESCENT.'",
  "Claw marks on the floor, all pointing down.",
  "Someone carved 'TURN BACK' here. Someone else carved 'DON'T LISTEN TO STEVE.'",
  "The air is colder here. The dark is more professional.",
  "A tally scratched into stone stops abruptly at 847.",
];

function genMonster(depth, rng, idx) {
  // archetype pick weighted by the floor's band (default weight 1)
  const band = bandOf(depth);
  const ws = GEN_ARCH.map(a => (band.weights && band.weights[a.key]) || 1);
  let r = rng() * ws.reduce((a, v) => a + v, 0);
  let arch = GEN_ARCH[0];
  for (let i = 0; i < GEN_ARCH.length; i++) { r -= ws[i]; if (r < 0) { arch = GEN_ARCH[i]; break; } }
  const lvl = Math.max(1, depth - 1 + Math.floor(rng() * 3));
  const name = `${GEN_ADJ[Math.floor(rng() * GEN_ADJ.length)]} ${arch.nouns[Math.floor(rng() * arch.nouns.length)]}`;
  const dmgDice = Math.max(1, Math.round(lvl * arch.dmg / 3.5));
  const def = {
    id: `D${depth}M${idx}`,
    name, pl: name + "s",
    lvl,
    hp: `${lvl}d${arch.hpD}`,
    ac: 8 - Math.floor(depth * 0.7) + arch.ac,
    dmg: lvl >= 10 ? [`${dmgDice}d6`, `${dmgDice}d6`] : [`${dmgDice}d6`],
    num: arch.num,
    xp: Math.floor(30 * Math.pow(1.5, Math.min(lvl, 24)) + 25 * lvl),
    sleepResist: arch.undead ? 100 : Math.min(90, lvl * 5),
    lore: GEN_LORE[arch.key][Math.floor(rng() * GEN_LORE[arch.key].length)],
    art: { brute: "brute", pack: "beast", caster: "caster", priest: "caster", breather: "drake", undead: "undead", stinger: "bug" }[arch.key],
  };
  if (arch.mage) def.mage = depth >= 6 ? 3 : 1;
  if (arch.priest) def.priest = 2;
  if (arch.breath) def.breath = "fire";
  if (arch.undead) def.undead = true;
  if (arch.poison) def.poison = true;
  MONSTERS[def.id] = def;
  return def.id;
}

function genLevel(n) {
  const rng = mulberry32((Game.flags.seed || 12345) * 31 + n * 7919);
  const ri = k => Math.floor(rng() * k);
  const m = M(20, 20);
  border(m);
  // fill every internal wall, then carve a perfect maze (recursive backtracker)
  for (let y = 1; y < 20; y++) bh(m, y, 0, 19);
  for (let x = 1; x < 20; x++) bv(m, x, 0, 19);
  const seen = new Set(["0,0"]);
  const stack = [[0, 0]];
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const nbrs = [];
    for (let dir = 0; dir < 4; dir++) {
      const nx = x + DIRS[dir].dx, ny = y + DIRS[dir].dy;
      if (nx >= 0 && ny >= 0 && nx < 20 && ny < 20 && !seen.has(nx + "," + ny)) nbrs.push([nx, ny, dir]);
    }
    if (!nbrs.length) { stack.pop(); continue; }
    const [nx, ny, dir] = nbrs[ri(nbrs.length)];
    if (dir === 0) m.hw[y][x] = 0;
    else if (dir === 2) m.hw[ny][x] = 0;
    else if (dir === 3) m.vw[y][x] = 0;
    else m.vw[y][nx] = 0;
    seen.add(nx + "," + ny);
    stack.push([nx, ny]);
  }
  // carve profile: the band decides how mazey this place is. Hand-built
  // floors 1-3 sit around 0.78-0.84 open internal edges; a raw backtracker
  // maze is 0.52. Bands aim for the hand-built feel with local character.
  const lay = bandOf(n).layout || { loops: 80, rooms: 6, rmin: 3, rmax: 6 };
  // loops: remove `lay.loops` actual walls (retry past already-open edges)
  for (let i = 0; i < lay.loops; i++) {
    for (let t = 0; t < 8; t++) {
      if (rng() < 0.5) { const y = 1 + ri(19), x = ri(20); if (m.hw[y][x] === 1) { m.hw[y][x] = 0; break; } }
      else { const x = 1 + ri(19), y = ri(20); if (m.vw[y][x] === 1) { m.vw[y][x] = 0; break; } }
    }
  }
  // rooms: clear interiors of rects
  for (let r = 0; r < lay.rooms; r++) {
    const w = lay.rmin + ri(lay.rmax - lay.rmin + 1), h = lay.rmin + ri(lay.rmax - lay.rmin + 1);
    const x0 = 1 + ri(20 - w - 2), y0 = 1 + ri(20 - h - 2);
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      if (y > y0) m.hw[y][x] = 0;
      if (x > x0) m.vw[y][x] = 0;
    }
  }
  // doors: convert some open internal passages to doors
  for (let i = 0; i < 14; i++) {
    if (rng() < 0.5) { const y = 1 + ri(19), x = ri(20); if (m.hw[y][x] === 0) m.hw[y][x] = 2; }
    else { const x = 1 + ri(19), y = ri(20); if (m.vw[y][x] === 0) m.vw[y][x] = 2; }
  }
  // stairs: up near one corner, down far away (BFS-farthest cell)
  const ux = 1 + ri(4), uy = 1 + ri(4);
  sp(m, ux, uy, { t: "up" });
  const far = bfsFarthest(m, ux, uy);
  sp(m, far.x, far.y, { t: "down" });
  // sanctum every 3rd floor, adjacent to the up stairs
  if (n % 3 === 0) {
    const spots = [[ux + 1, uy], [ux, uy + 1], [ux - 1, uy], [ux, uy - 1]].filter(([x, y]) => x >= 0 && y >= 0 && x < 20 && y < 20);
    const [sx, sy] = spots[ri(spots.length)];
    sp(m, sx, sy, { t: "sanctum" });
  }
  // lairs + flavor
  for (let i = 0; i < 3; i++) {
    const x = ri(20), y = ri(20);
    if (!m.specials[x + "," + y]) sp(m, x, y, { t: "lair" });
  }
  const band = bandOf(n);
  m.band = band.name;
  m.tint = band.tint;
  const msgPool = GEN_MSGS.concat(band.msgs || []);
  for (let i = 0; i < 2; i++) {
    const x = ri(20), y = ri(20);
    if (!m.specials[x + "," + y]) sp(m, x, y, { t: "msg", msg: msgPool[ri(msgPool.length)] });
  }
  // points of interest: things worth finding that aren't the stairs
  const pois = [];
  if (rng() < 0.65) pois.push({ t: "shrine" });
  if (rng() < 0.4) pois.push({ t: "kiosk" });
  if (n >= 6 && rng() < 0.35) pois.push({ t: "vault" });
  if (rng() < 0.6) pois.push({ t: "remains", note: REMAINS_NOTES[ri(REMAINS_NOTES.length)] });
  for (const p of pois) {
    for (let tries = 0; tries < 20; tries++) {
      const x = ri(20), y = ri(20);
      if (!m.specials[x + "," + y]) { sp(m, x, y, p); break; }
    }
  }
  // monsters
  const ids = [];
  for (let i = 0; i < 8; i++) ids.push(genMonster(n, rng, i));
  m.table = ids.map(id => [id, 1 + ri(3)]);
  m.depth = n;
  m.rate = 10;
  // floor modifier: half the Crawl runs under a house rule
  if (n >= 4 && rng() < 0.5) {
    m.mod = FLOOR_MODS[ri(FLOOR_MODS.length)];
    if (m.mod.rate) m.rate = m.mod.rate;
  }
  return m;
}

function bfsFarthest(m, sx, sy) {
  const dist = { [sx + "," + sy]: 0 };
  const q = [[sx, sy]];
  let best = { x: sx, y: sy, d: 0 };
  while (q.length) {
    const [x, y] = q.shift();
    const d = dist[x + "," + y];
    if (d > best.d) best = { x, y, d };
    const w = cellWalls(m, x, y);
    for (let dir = 0; dir < 4; dir++) {
      if (w[dir] === 1) continue;
      const nx = x + DIRS[dir].dx, ny = y + DIRS[dir].dy;
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
      const k = nx + "," + ny;
      if (dist[k] === undefined) { dist[k] = d + 1; q.push([nx, ny]); }
    }
  }
  return best;
}

// the one true accessor: campaign floors 1-3 are hand-built, 4+ generate on demand
function getLevel(n) {
  if (!LEVELS[n]) LEVELS[n] = genLevel(n);
  return LEVELS[n];
}
function clearGeneratedLevels() {
  for (const k of Object.keys(LEVELS)) if (+k > 3) delete LEVELS[k];
  for (const k of Object.keys(MONSTERS)) if (/^D\d+M\d+$/.test(k)) delete MONSTERS[k];
}
