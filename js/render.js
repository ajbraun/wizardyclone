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
  return { draw, blank, drawMap };
})();
