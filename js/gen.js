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
const GEN_MSGS = [
  "A scrawl on the wall: 'THE SYSTEM THANKS YOU FOR YOUR CONTINUED DESCENT.'",
  "Claw marks on the floor, all pointing down.",
  "Someone carved 'TURN BACK' here. Someone else carved 'DON'T LISTEN TO STEVE.'",
  "The air is colder here. The dark is more professional.",
  "A tally scratched into stone stops abruptly at 847.",
];

function genMonster(depth, rng, idx) {
  const arch = GEN_ARCH[Math.floor(rng() * GEN_ARCH.length)];
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
  // loops: knock out extra internal walls so it isn't a strict tree
  for (let i = 0; i < 40; i++) {
    if (rng() < 0.5) { const y = 1 + ri(19), x = ri(20); m.hw[y][x] = 0; }
    else { const x = 1 + ri(19), y = ri(20); m.vw[y][x] = 0; }
  }
  // rooms: clear interiors of a few rects
  for (let r = 0; r < 4; r++) {
    const w = 3 + ri(3), h = 3 + ri(3);
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
  for (let i = 0; i < 2; i++) {
    const x = ri(20), y = ri(20);
    if (!m.specials[x + "," + y]) sp(m, x, y, { t: "msg", msg: GEN_MSGS[ri(GEN_MSGS.length)] });
  }
  // monsters
  const ids = [];
  for (let i = 0; i < 8; i++) ids.push(genMonster(n, rng, i));
  m.table = ids.map(id => [id, 1 + ri(3)]);
  m.depth = n;
  m.rate = 10;
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
