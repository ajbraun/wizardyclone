"use strict";
const Render = (() => {
  const CX = 280, CY = 196, KX = 270, KY = 190;
  let ctx = null;
  function init() { ctx = document.getElementById("view").getContext("2d"); }
  function px(x, t) { return CX + (x * KX) / t; }
  function py(y, t) { return CY + (y * KY) / t; }
  function quad(pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.stroke();
  }
  function outline(pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.stroke();
  }
  function frontWall(j, dpt, v) {
    const t = dpt + 0.5;
    const x1 = j - 0.5, x2 = j + 0.5;
    quad([[px(x1, t), py(-0.5, t)], [px(x2, t), py(-0.5, t)], [px(x2, t), py(0.5, t)], [px(x1, t), py(0.5, t)]]);
    if (v === 2) {
      const dx1 = x1 + 0.2, dx2 = x2 - 0.2;
      outline([[px(dx1, t), py(-0.22, t)], [px(dx2, t), py(-0.22, t)], [px(dx2, t), py(0.5, t)], [px(dx1, t), py(0.5, t)]]);
    }
  }
  function sideWall(xEdge, dpt, v) {
    const t0 = Math.max(dpt - 0.5, 0.28), t1 = dpt + 0.5;
    quad([[px(xEdge, t0), py(-0.5, t0)], [px(xEdge, t1), py(-0.5, t1)], [px(xEdge, t1), py(0.5, t1)], [px(xEdge, t0), py(0.5, t0)]]);
    if (v === 2) {
      const ta = t0 + (t1 - t0) * 0.25, tb = t1 - (t1 - t0) * 0.25;
      outline([[px(xEdge, ta), py(-0.22, ta)], [px(xEdge, tb), py(-0.22, tb)], [px(xEdge, tb), py(0.5, tb)], [px(xEdge, ta), py(0.5, ta)]]);
    }
  }
  function draw(map, x, y, dir, maxDepth) {
    if (!ctx) init();
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 560, 392);
    ctx.strokeStyle = "#d8ffd8";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    const f = DIRS[dir], r = DIRS[(dir + 1) % 4];
    const left = (dir + 3) % 4, right = (dir + 1) % 4;
    const md = maxDepth || 3;
    const cell = (dd, j) => ({ x: x + f.dx * dd + r.dx * j, y: y + f.dy * dd + r.dy * j });
    for (let dd = md; dd >= 0; dd--) {
      const order = [-3, 3, -2, 2, -1, 1, 0];
      // front walls first (they sit deeper than this layer's side walls)
      for (const j of order) {
        const c = cell(dd, j);
        const w = cellWalls(map, c.x, c.y);
        if (w[dir]) frontWall(j, dd, w[dir]);
      }
      for (const j of order) {
        const c = cell(dd, j);
        const w = cellWalls(map, c.x, c.y);
        if (j > 0 && w[left]) sideWall(j - 0.5, dd, w[left]);
        if (j < 0 && w[right]) sideWall(j + 0.5, dd, w[right]);
        if (j === 0) {
          if (w[left]) sideWall(-0.5, dd, w[left]);
          if (w[right]) sideWall(0.5, dd, w[right]);
        }
      }
    }
  }
  function blank(text) {
    if (!ctx) init();
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 560, 392);
    if (text) {
      ctx.strokeStyle = "#4a8a4a";
      ctx.lineWidth = 2;
      ctx.strokeRect(40, 40, 480, 312);
      ctx.strokeRect(48, 48, 464, 296);
      ctx.fillStyle = "#9fdf9f";
      ctx.font = "28px Menlo, monospace";
      ctx.textAlign = "center";
      ctx.fillText(text, 280, 205);
    }
  }
  // automap: draw only cells the party has visited
  function drawMap(map, seen, px0, py0, pf) {
    if (!ctx) init();
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 560, 392);
    const s = 17;
    const ox = (560 - map.w * s) / 2, oy = (392 - map.h * s) / 2;
    ctx.lineWidth = 2;
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        if (!seen[x + "," + y]) continue;
        const cx = ox + x * s, cy = oy + y * s;
        ctx.fillStyle = "#0d1a0d";
        ctx.fillRect(cx, cy, s, s);
        const w = cellWalls(map, x, y);
        const seg = (x1, y1, x2, y2, door) => {
          ctx.strokeStyle = door ? "#ffd700" : "#9fdf9f";
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        };
        if (w[0]) seg(cx, cy, cx + s, cy, w[0] === 2);
        if (w[1]) seg(cx + s, cy, cx + s, cy + s, w[1] === 2);
        if (w[2]) seg(cx, cy + s, cx + s, cy + s, w[2] === 2);
        if (w[3]) seg(cx, cy, cx, cy + s, w[3] === 2);
        const spc = map.specials[x + "," + y];
        if (spc && ["up", "down", "sanctum"].includes(spc.t)) {
          ctx.fillStyle = "#ffd700";
          ctx.font = "12px Menlo, monospace";
          ctx.textAlign = "center";
          ctx.fillText(spc.t === "up" ? "<" : spc.t === "down" ? ">" : "S", cx + s / 2, cy + s - 4);
        }
      }
    }
    // the party
    const cx = ox + px0 * s + s / 2, cy = oy + py0 * s + s / 2;
    const ang = [-Math.PI / 2, 0, Math.PI / 2, Math.PI][pf];
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * 6, cy + Math.sin(ang) * 6);
    ctx.lineTo(cx + Math.cos(ang + 2.5) * 5, cy + Math.sin(ang + 2.5) * 5);
    ctx.lineTo(cx + Math.cos(ang - 2.5) * 5, cy + Math.sin(ang - 2.5) * 5);
    ctx.closePath();
    ctx.fill();
  }
  // ---------------------------------------------------------------- monster art
  // Procedural wireframe portraits, one function per archetype, drawn in a
  // 100x100 space centered on 0,0. Hash of the monster id adds per-species
  // variation (horns, stingers, tatters) so a Kobold always looks like itself.
  function mhash(s) { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
  function ln(x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  function poly(pts, close) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (close) ctx.closePath();
    ctx.stroke();
  }
  function circ(x, y, r, fill) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = ctx.strokeStyle; ctx.fill(); } else ctx.stroke();
  }
  function wobble(cx, cy, a, b, bumps, phase) {
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const t = (i / 40) * Math.PI * 2;
      const r = 1 + 0.12 * Math.sin(bumps * t + phase);
      const x = cx + Math.cos(t) * a * r, y = cy + Math.sin(t) * b * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.stroke();
  }
  const MON_ART = {
    blob(h) {
      wobble(0, 10, 34, 24, 3 + (h % 3), h % 7);
      circ(-9, 2, 3, true); circ(9, 2, 3, true);
      poly([[-6, 14], [0, 17], [6, 14]]);
    },
    humanoid(h) {
      circ(0, -30, 10);
      if (h % 3 === 0) { ln(-7, -38, -12, -48); ln(7, -38, 12, -48); } // horns
      circ(-4, -31, 1.5, true); circ(4, -31, 1.5, true);
      poly([[-14, -18], [14, -18], [10, 20], [-10, 20]], true);        // torso
      ln(-14, -16, -26, 6); ln(14, -16, 24, -2);                       // arms
      ln(24, -2, 30, -34); ln(26, -28, 34, -28);                       // sword + guard
      ln(-8, 20, -10, 44); ln(8, 20, 10, 44);                          // legs
    },
    caster(h) {
      poly([[-17, -24], [17, -24], [0, -48]], true);                   // hat
      circ(0, -17, 8);
      poly([[-12, -8], [12, -8], [22, 42], [-22, 42]], true);          // robe
      ln(20, 42, 20, -38); circ(20, -42, 4);                           // staff + orb
      if (h % 2) { ln(14, -46, 10, -50); ln(26, -46, 30, -50); ln(20, -50, 20, -55); } // sparks
      ln(-12, -4, -20, 14);
    },
    undead(h) {
      circ(0, -26, 14);
      circ(-5, -28, 3.5, true); circ(5, -28, 3.5, true);
      poly([[-6, -14], [6, -14]]);
      for (let i = -4; i <= 4; i += 4) ln(i, -14, i, -10);             // teeth
      ln(0, -10, 0, 14);                                               // spine
      for (let i = 0; i < 3; i++) { const y = -4 + i * 6; ln(-11 + i * 2, y, 11 - i * 2, y); } // ribs
      ln(-4, -8, -18, 8); ln(4, -8, 18, 8);                            // arms
      if (h % 2) poly([[-8, 14], [-4, 22], [0, 15], [4, 23], [8, 14]]); // tatters
      else { ln(-3, 14, -5, 30); ln(3, 14, 5, 30); }
    },
    beast(h) {
      wobble(-2, 6, 26, 13, 2, 1);                                     // body
      poly([[16, -1], [38, -9], [19, -13]], true);                     // head wedge
      ln(24, -12, 27, -19); ln(30, -11, 34, -17);                      // ears
      circ(27, -9, 1.5, true);
      ln(32, -6, 34, -1); ln(28, -6, 29, -2);                          // fangs
      for (const x of [-18, -8, 6, 14]) ln(x, 16, x + (h % 2 ? 2 : -2), 34); // legs
      poly([[-26, 2], [-36, -8], [-40, -20]]);                         // tail
    },
    bug(h) {
      circ(0, 12, 16); circ(0, -12, 8);
      circ(-3, -14, 1.5, true); circ(3, -14, 1.5, true);
      ln(-4, -6, -7, -1); ln(4, -6, 7, -1);                            // mandibles
      for (let i = 0; i < 4; i++) {
        const y = 2 + i * 6;
        ln(-14, y, -26, y - 6); ln(-26, y - 6, -32, y + 4);
        ln(14, y, 26, y - 6); ln(26, y - 6, 32, y + 4);
      }
      if (h % 2) { poly([[0, 28], [4, 38], [-2, 44]]); ln(-2, 44, -6, 40); } // stinger
    },
    drake(h) {
      poly([[-6, -4], [-46, -28], [-12, 10]], true);                   // far wing
      poly([[6, -4], [46, -28], [12, 10]], true);                      // near wing
      poly([[-10, 34], [-4, 18], [2, 4], [4, -10], [10, -22]]);        // serpentine body
      poly([[10, -22], [26, -26], [12, -32]], true);                   // head
      circ(15, -27, 1.5, true);
      poly([[26, -26], [32, -24], [36, -28], [40, -25]]);              // flame
      if (h % 2) { ln(4, -14, -2, -18); ln(2, -6, -5, -9); }           // back spines
    },
    brute(h) {
      circ(0, -26, 9);
      if (h % 2) { ln(-6, -33, -12, -40); ln(6, -33, 12, -40); }
      poly([[-22, -14], [22, -14], [16, 26], [-16, 26]], true);        // slab torso
      ln(-22, -12, -34, 10); circ(-36, 14, 5);                         // arm + fist
      ln(22, -12, 34, 10); circ(36, 14, 5);
      ln(-10, 26, -12, 44); ln(10, 26, 12, 44);
      ln(-8, -6, 8, -2);                                               // scar
    },
  };
  function monsterBox(def, count) {
    if (!ctx) init();
    const bx = 160, by = 34, bw = 240, bh = 252;
    ctx.fillStyle = "#000";
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = "#4a8a4a"; ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.strokeRect(bx + 5, by + 5, bw - 10, bh - 10);
    ctx.save();
    ctx.translate(bx + bw / 2, by + 10 + (bh - 60) / 2);
    const s = (bh - 80) / 100;
    ctx.scale(s, s);
    ctx.strokeStyle = "#d8ffd8"; ctx.lineWidth = 2 / s;
    (MON_ART[def.art] || MON_ART.humanoid)(mhash(def.id));
    ctx.restore();
    ctx.fillStyle = "#9fdf9f";
    ctx.font = "13px Menlo, monospace";
    ctx.textAlign = "center";
    const label = `${def.name}${count > 1 ? "  x" + count : ""}`.toUpperCase();
    ctx.fillText(label.length > 30 ? label.slice(0, 29) + "…" : label, bx + bw / 2, by + bh - 14);
  }
  return { draw, blank, drawMap, monsterBox };
})();
