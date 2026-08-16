"use strict";
// Wall grids: hw[y][x] = wall on north side of cell (x,y), y in 0..h.
//             vw[y][x] = wall on west side of cell (x,y), x in 0..w.
// Values: 0 open, 1 wall, 2 door.
const DIRS = [{ dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }];
const DIRNAMES = ["NORTH", "EAST", "SOUTH", "WEST"];

function M(w, h) {
  return {
    w, h,
    hw: Array.from({ length: h + 1 }, () => Array(w).fill(0)),
    vw: Array.from({ length: h }, () => Array(w + 1).fill(0)),
    specials: {}, table: [], rate: 8, depth: 1, start: null,
  };
}
function bh(m, y, x1, x2, v) { for (let x = x1; x <= x2; x++) m.hw[y][x] = v === undefined ? 1 : v; }
function bv(m, x, y1, y2, v) { for (let y = y1; y <= y2; y++) m.vw[y][x] = v === undefined ? 1 : v; }
function border(m) { bh(m, 0, 0, m.w - 1); bh(m, m.h, 0, m.w - 1); bv(m, 0, 0, m.h - 1); bv(m, m.w, 0, m.h - 1); }
function sp(m, x, y, obj) { m.specials[x + "," + y] = obj; }

function cellWalls(m, x, y) {
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return [1, 1, 1, 1];
  return [m.hw[y][x], m.vw[y][x + 1], m.hw[y + 1][x], m.vw[y][x]];
}

// ================================================================ LEVEL 1
const L1 = M(20, 20);
border(L1);
// entry room x7-12 y16-19, stairs up at (9,18)
bh(L1, 16, 7, 12); L1.hw[16][9] = 2;
bv(L1, 7, 16, 19); bv(L1, 13, 16, 19);
// main corridor y15: north wall (gaps at x2, x9, x17)
bh(L1, 15, 0, 1); bh(L1, 15, 3, 8); bh(L1, 15, 10, 16); bh(L1, 15, 18, 19);
// corridor south wall outside entry room, doors into SW/SE dens
bh(L1, 16, 0, 2); L1.hw[16][3] = 2; bh(L1, 16, 4, 6);
bh(L1, 16, 13, 15); L1.hw[16][16] = 2; bh(L1, 16, 17, 19);
// west corridor x2 (y5..15), door into west closet at y9
bv(L1, 2, 5, 8); L1.vw[9][2] = 2; bv(L1, 2, 10, 14);
bv(L1, 3, 5, 6); bv(L1, 3, 8, 11); bv(L1, 3, 13, 14); // gaps at y7, y12
// west closet x0-1 y8-11
bh(L1, 8, 0, 1); bh(L1, 12, 0, 1);
// NW room x0-4 y0-4, door south at x2
bh(L1, 5, 0, 1); L1.hw[5][2] = 2; bh(L1, 5, 3, 4);
bv(L1, 5, 0, 4);
// great hall x5-13 y0-4, door south at x12
bh(L1, 5, 5, 11); L1.hw[5][12] = 2; bh(L1, 5, 13, 13);
bv(L1, 14, 0, 4);
// sealed vault x14-15 y0-4
bh(L1, 5, 14, 15); bv(L1, 16, 0, 4);
// NE stairs room x16-19 y0-2, door south at x17
bh(L1, 3, 16, 16); L1.hw[3][17] = 2; bh(L1, 3, 18, 19);
// east corridor x17 (y3..15), gaps at y7
bv(L1, 17, 3, 6); bv(L1, 17, 8, 14);
bv(L1, 18, 3, 6); L1.vw[7][18] = 2; bv(L1, 18, 8, 14);
// east closet x18-19 y6-9
bh(L1, 6, 18, 19); bh(L1, 10, 18, 19);
// plaza south wall y10, door at x10
bh(L1, 10, 4, 9); L1.hw[10][10] = 2; bh(L1, 10, 11, 15);
// central room x8-11 y10-13, south door at x9
bv(L1, 8, 10, 13); bv(L1, 12, 10, 13);
bh(L1, 14, 8, 8); L1.hw[14][9] = 2; bh(L1, 14, 10, 11);
L1.vw[14][9] = 1; L1.vw[14][10] = 1; // vestibule (9,14)
// side corridor y12 x3-7, door into central room
bh(L1, 12, 3, 7); bh(L1, 13, 3, 7);
L1.vw[12][8] = 2;
// plaza pillars at (6,7) and (13,7)
L1.hw[7][6] = 1; L1.hw[8][6] = 1; L1.vw[7][6] = 1; L1.vw[7][7] = 1;
L1.hw[7][13] = 1; L1.hw[8][13] = 1; L1.vw[7][13] = 1; L1.vw[7][14] = 1;

sp(L1, 9, 18, { t: "up" });
sp(L1, 18, 1, { t: "down", dest: { level: 2, x: 18, y: 1, f: 2 } });
sp(L1, 2, 2, { t: "msg", msg: 'A sign reads: "WELCOME TO THE PROVING GROUNDS OF THE CODE OVERLORD."' });
sp(L1, 9, 2, { t: "lair" });
sp(L1, 3, 18, { t: "lair" });
sp(L1, 16, 18, { t: "lair" });
L1.start = { x: 9, y: 18, f: 0 };
L1.depth = 1; L1.rate = 8;
L1.table = [["KOBOLD", 3], ["GIANTRAT", 3], ["ORC", 3], ["SLIME", 2], ["ROGUE", 2], ["SKELETON", 1], ["MAGE1", 1], ["PRIEST1", 1]];

// ================================================================ LEVEL 2
const L2 = M(20, 20);
border(L2);
// corridor row y9: north wall (gaps x9, x18; doors x4, x15)
bh(L2, 9, 0, 3); L2.hw[9][4] = 2; bh(L2, 9, 5, 8); bh(L2, 9, 10, 14); L2.hw[9][15] = 2; bh(L2, 9, 16, 17); bh(L2, 9, 19, 19);
// south wall (gaps x1, x9; doors x4, x15)
bh(L2, 10, 0, 0); bh(L2, 10, 2, 3); L2.hw[10][4] = 2; bh(L2, 10, 5, 8); bh(L2, 10, 10, 14); L2.hw[10][15] = 2; bh(L2, 10, 16, 19);
// corridor column x9: west wall (door y2, gap y9, door y17)
bv(L2, 9, 0, 1); L2.vw[2][9] = 2; bv(L2, 9, 3, 8); bv(L2, 9, 10, 16); L2.vw[17][9] = 2; bv(L2, 9, 18, 19);
// east wall (door y6, gap y9, door y13)
bv(L2, 10, 0, 5); L2.vw[6][10] = 2; bv(L2, 10, 7, 8); bv(L2, 10, 10, 12); L2.vw[13][10] = 2; bv(L2, 10, 14, 19);
// four quadrant rooms
bh(L2, 4, 2, 6); bv(L2, 2, 4, 8); bv(L2, 7, 4, 8);       // NW
bh(L2, 4, 13, 17); bv(L2, 13, 4, 8); bv(L2, 18, 4, 8);   // NE
bh(L2, 15, 2, 6); bv(L2, 2, 10, 14); bv(L2, 7, 10, 14);  // SW
bh(L2, 15, 13, 17); bv(L2, 13, 10, 14); bv(L2, 18, 10, 14); // SE
// NE corner stairs-up room x16-19 y0-2
bh(L2, 3, 16, 17); L2.hw[3][18] = 2; bh(L2, 3, 19, 19); bv(L2, 16, 0, 2);
// SW corner stairs-down room x0-3 y16-19
bh(L2, 16, 0, 0); L2.hw[16][1] = 2; bh(L2, 16, 2, 3); bv(L2, 4, 16, 19);

sp(L2, 18, 1, { t: "up", dest: { level: 1, x: 18, y: 1, f: 2 } });
sp(L2, 1, 18, { t: "down", dest: { level: 3, x: 1, y: 1, f: 2 } });
sp(L2, 4, 6, { t: "lair" });
sp(L2, 15, 12, { t: "lair" });
sp(L2, 9, 0, { t: "msg", msg: "You hear faint chanting from somewhere far below." });
L2.depth = 2; L2.rate = 9;
L2.table = [["ORC", 1], ["ROGUE", 2], ["SKELETON", 2], ["ZOMBIE", 2], ["CRUD", 2], ["MAGE1", 2], ["PRIEST1", 1], ["WOLF", 2], ["BUSHWACKER", 2], ["SPIDER", 1]];

// ================================================================ LEVEL 3
const L3 = M(20, 20);
border(L3);
// inner block wall around x2-17 y2-17 with 4 doors
bh(L3, 2, 2, 8); L3.hw[2][9] = 2; bh(L3, 2, 10, 17);
bh(L3, 18, 2, 9); L3.hw[18][10] = 2; bh(L3, 18, 11, 17);
bv(L3, 2, 2, 8); L3.vw[9][2] = 2; bv(L3, 2, 10, 17);
bv(L3, 18, 2, 9); L3.vw[10][18] = 2; bv(L3, 18, 11, 17);
// boss chamber x7-12 y7-12, door north at x9
bh(L3, 7, 7, 8); L3.hw[7][9] = 2; bh(L3, 7, 10, 12);
bh(L3, 13, 7, 12); bv(L3, 7, 7, 12); bv(L3, 13, 7, 12);
// maze spurs
bh(L3, 5, 4, 8); bh(L3, 5, 11, 15);
bh(L3, 15, 4, 8); bh(L3, 15, 11, 15);
bv(L3, 5, 6, 9); bv(L3, 15, 6, 9);
bv(L3, 5, 10, 13); bv(L3, 15, 10, 13);

sp(L3, 1, 1, { t: "up", dest: { level: 2, x: 1, y: 18, f: 0 } });
sp(L3, 10, 12, { t: "down" }); // sealed hatch in the boss chamber — opens when the Apprentice falls
sp(L3, 9, 1, { t: "msg", msg: 'An inscription: "TREMBLE, MEDDLERS. THE APPRENTICE AWAITS."' });
sp(L3, 9, 7, { t: "boss" });
sp(L3, 9, 11, { t: "amulet" });
sp(L3, 3, 3, { t: "lair" });
sp(L3, 16, 3, { t: "lair" });
sp(L3, 3, 16, { t: "lair" });
sp(L3, 16, 16, { t: "lair" });
L3.depth = 3; L3.rate = 10;
L3.table = [["BUSHWACKER", 1], ["SPIDER", 2], ["SAMURAI3", 2], ["PRIEST3", 2], ["GARGOYLE", 2], ["DRAGONFLY", 2], ["BEETLE", 2], ["WEREWOLF", 2], ["MAGE5", 1], ["SHADE", 1]];

const LEVELS = { 1: L1, 2: L2, 3: L3 };
