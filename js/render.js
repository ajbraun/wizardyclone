"use strict";
const Render = (() => {
  const CX = 280, CY = 196, KX = 270, KY = 190;
  let ctx = null;
  const encounterImages = new Map();
  let activeEncounter = null;
  function clearEncounter(label) {
    activeEncounter = null;
    activeMaze = null;
    document.getElementById("view").ariaLabel = label;
  }
  function init() { ctx = document.getElementById("view").getContext("2d"); }
  function px(x, t) { return CX + (x * KX) / t; }
  function py(y, t) { return CY + (y * KY) / t; }
  let activeMaze = null;
  let stoneTexture = null;
  let stoneReady = false;
  let mazeTint = "#d8ffd8";
  function loadStone() {
    if (stoneTexture || typeof Image === "undefined") return;
    stoneTexture = new Image();
    stoneTexture.onload = () => {
      stoneReady = true;
      if (activeMaze) draw(...activeMaze);
    };
    stoneTexture.onerror = () => { stoneReady = false; };
    stoneTexture.src = "assets/environment/dungeon-stone.png";
  }
  function polygon(pts, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }
  function faceRect(project, u, v, w, h, fill, stroke) {
    polygon([project(u,v), project(u+w,v), project(u+w,v+h), project(u,v+h)], fill, stroke);
  }
  function visibleFace(pts) {
    return Math.max(...pts.map(p => p[0])) > 0 && Math.min(...pts.map(p => p[0])) < 560;
  }
  function masonry(project, depth, side) {
    const pts = [project(0,0), project(1,0), project(1,1), project(0,1)];
    if (!visibleFace(pts)) return false;
    polygon(pts, "#353730");
    if (stoneReady) {
      if (!side) {
        ctx.drawImage(stoneTexture, pts[0][0], pts[0][1], pts[1][0]-pts[0][0], pts[3][1]-pts[0][1]);
      } else {
        // Vertical pixel strips provide perspective-correct texture sampling:
        // depth is reciprocal in screen x, not linear across the trapezoid.
        const x0 = pts[0][0], x1 = pts[1][0];
        const start = Math.max(0, Math.ceil(Math.min(x0,x1)));
        const end = Math.min(560, Math.ceil(Math.max(x0,x1)));
        for (let sx = start; sx < end; sx++) {
          const q = (sx + 0.5 - CX);
          if (Math.abs(q) < 0.01) continue;
          const t = side.edge * KX / q;
          const u = Math.max(0, Math.min(0.999, (t - side.t0) / (side.t1 - side.t0)));
          const top = py(-0.5,t), bottom = py(0.5,t);
          const texX = u * (stoneTexture.naturalWidth-1);
          ctx.drawImage(stoneTexture, texX, 0, 1, stoneTexture.naturalHeight, sx, top, 1.05, bottom-top);
        }
      }
    } else {
      // Shaded masonry remains usable offline and during the first download.
      for (let row = 0; row < 4; row++) {
        for (let col = -1; col < 3; col++) {
          const u0 = Math.max(0, col / 3 + (row % 2) / 6);
          const u1 = Math.min(1, (col+1) / 3 + (row % 2) / 6);
          if (u1 <= u0) continue;
          const n = 80 + ((row * 17 + col * 13 + 39) % 24);
          faceRect(project,u0+.005,row/4+.006,u1-u0-.01,.238,`rgb(${n},${n},${n-8})`,"#262923");
        }
      }
    }
    ctx.save();
    ctx.globalAlpha = 0.09;
    polygon(pts, mazeTint);
    ctx.restore();
    polygon(pts, `rgba(5,9,8,${Math.min(.84,.20 + depth*.16 + (side ? .09 : 0))})`);
    return true;
  }
  function timberDoor(project, depth) {
    // Recessed iron-bound oak, framed by individual stone blocks. All details
    // use the wall's own projection, including doors seen obliquely.
    faceRect(project,.13,.12,.74,.88,"#171b17","#777969");
    for (let row=0; row<5; row++) {
      for (const u of [.13,.78]) faceRect(project,u,.12+row*.176,.09,.17,"#656659","#34372f");
    }
    for (let col=0; col<5; col++) faceRect(project,.22+col*.112,.12,.107,.10,"#777668","#34372f");
    faceRect(project,.22,.225,.56,.775,"#171511");
    for (let plank=0; plank<7; plank++) {
      const u=.229+plank*.078;
      const n=57+(plank*13)%18;
      faceRect(project,u,.233,.071,.767,`rgb(${n+24},${n+5},${n-17})`,"#30271c");
      for (let grain=0;grain<3;grain++) faceRect(project,u+.012+grain*.019,.25,.003,.73,"#31291d55");
    }
    for (const v of [.37,.77]) {
      faceRect(project,.224,v,.552,.046,"#282d2a","#777b69");
      for (const u of [.25,.39,.60,.73]) faceRect(project,u,v+.014,.012,.013,"#aaa18a");
    }
    faceRect(project,.67,.54,.038,.10,"#282b26","#8a8269");
    const ring=[];
    for(let i=0;i<16;i++) {const a=i*Math.PI/8;ring.push(project(.689+Math.cos(a)*.028,.607+Math.sin(a)*.034));}
    polygon(ring,"#171a15","#b6a77c");
    const pts=[project(.13,.12),project(.87,.12),project(.87,1),project(.13,1)];
    polygon(pts,`rgba(5,9,8,${Math.min(.8,depth*.15)})`);
  }
  function frontWall(j, dpt, v) {
    const t=dpt+.5;
    const project=(u,v)=>[px(j-.5+u,t),py(v-.5,t)];
    if (masonry(project,dpt,null) && v===2) timberDoor(project,dpt);
  }
  function sideWall(xEdge, dpt, v) {
    const t0=Math.max(dpt-.5,.28),t1=dpt+.5;
    const project=(u,v)=>[px(xEdge,t0+(t1-t0)*u),py(v-.5,t0+(t1-t0)*u)];
    if (masonry(project,dpt,{edge:xEdge,t0,t1}) && v===2) timberDoor(project,dpt);
  }
  function floorAndCeiling(md) {
    ctx.fillStyle="#090e0d";ctx.fillRect(0,0,560,392);
    for(let dd=md+1;dd>=0;dd--) {
      const near=Math.max(.28,dd-.5),far=dd+.5;
      for(let j=-4;j<=4;j++) {
        const n=Math.round(64/(1+dd*.34))+((j+dd+20)%3)*3;
        for(const sign of [-1,1]) {
          const shade=sign===1?n:Math.round(n*.42);
          const pts=[[px(j-.5,near),py(sign*.5,near)],[px(j+.5,near),py(sign*.5,near)],
            [px(j+.5,far),py(sign*.5,far)],[px(j-.5,far),py(sign*.5,far)]];
          polygon(pts,`rgb(${shade+3},${shade+3},${shade-2})`,"#1b211c");
          if(sign===1) {
            // A worn inset slab gives the floor thickness, rather than a grid.
            polygon([[px(j-.47,near+.025),py(.5,near+.025)],[px(j+.47,near+.025),py(.5,near+.025)],
              [px(j+.47,far-.025),py(.5,far-.025)],[px(j-.47,far-.025),py(.5,far-.025)]],
              `rgba(146,137,110,${.07/(1+dd)})`);
          }
        }
      }
    }
  }
  function atmosphere() {
    const light=ctx.createRadialGradient(280,170,40,280,190,350);
    if (!light || typeof light.addColorStop!=="function") return;
    light.addColorStop(0,"rgba(224,181,108,.04)");
    light.addColorStop(.55,"rgba(24,22,12,.03)");
    light.addColorStop(1,"rgba(0,5,4,.62)");
    ctx.fillStyle=light;ctx.fillRect(0,0,560,392);
  }
  function draw(map, x, y, dir, maxDepth) {
    clearEncounter("First-person dungeon view");
    if (!ctx) init();
    activeMaze=[map,x,y,dir,maxDepth];
    loadStone();
    mazeTint=map.tint || "#d8ffd8";
    const md=maxDepth || 3;
    floorAndCeiling(md);
    ctx.lineJoin="round";
    const f=DIRS[dir],r=DIRS[(dir+1)%4];
    const left=(dir+3)%4,right=(dir+1)%4;
    const cell=(dd,j)=>({x:x+f.dx*dd+r.dx*j,y:y+f.dy*dd+r.dy*j});
    for(let dd=md;dd>=0;dd--) {
      const order=[-3,3,-2,2,-1,1,0];
      for(const j of order) {
        const c=cell(dd,j),w=cellWalls(map,c.x,c.y);
        if(w[dir]) frontWall(j,dd,w[dir]);
      }
      for(const j of order) {
        const c=cell(dd,j),w=cellWalls(map,c.x,c.y);
        if(j>0 && w[left]) sideWall(j-.5,dd,w[left]);
        if(j<0 && w[right]) sideWall(j+.5,dd,w[right]);
        if(j===0) {
          if(w[left]) sideWall(-.5,dd,w[left]);
          if(w[right]) sideWall(.5,dd,w[right]);
        }
      }
    }
    atmosphere();
  }
  function blank(text) {
    clearEncounter(text || "Dungeon gate");
    if (!ctx) init();
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 560, 392);
    // A quiet, geometric gate into the dungeon. Canvas-native, no asset downloads.
    ctx.fillStyle = "#0c140f";
    ctx.fillRect(0, 0, 560, 392);
    for (let i = 0; i < 7; i++) {
      const inset = 28 + i * 27;
      const top = 32 + i * 14;
      ctx.fillStyle = i % 2 ? "#152219" : "#1b2b20";
      ctx.fillRect(inset, top, 560 - inset * 2, 392 - top);
      ctx.strokeStyle = "#344b36";
      ctx.lineWidth = 1;
      ctx.strokeRect(inset, top, 560 - inset * 2, 392 - top);
    }
    ctx.fillStyle = "#060c08";
    ctx.fillRect(217, 144, 126, 248);
    ctx.strokeStyle = "#5e7651";
    ctx.strokeRect(217, 144, 126, 248);
    // A descending stair disappearing into the doorway.
    for (let i = 0; i < 8; i++) {
      const y = 292 + i * i * 2;
      ctx.strokeStyle = "#314632";
      ctx.beginPath(); ctx.moveTo(217, y); ctx.lineTo(343, y); ctx.stroke();
    }
    for (const x of [157, 397]) {
      ctx.fillStyle = "#635234"; ctx.fillRect(x, 206, 6, 37);
      ctx.fillStyle = "#ad8548"; ctx.fillRect(x - 3, 194, 12, 17);
      ctx.fillStyle = "#efd59a"; ctx.fillRect(x, 190, 6, 15);
    }
    ctx.fillStyle = "#0a110dee";
    ctx.fillRect(0, 0, 560, 72);
    ctx.textAlign = "center";
    ctx.fillStyle = "#e0d5b9";
    ctx.font = "20px Georgia, serif";
    ctx.fillText(text || "THE DESCENT AWAITS", 280, 39);
    ctx.fillStyle = "#a1b29a";
    ctx.font = "10px Menlo, monospace";
    ctx.fillText("ABANDON CERTAINTY. BRING A PARTY.", 280, 59);
  }

  // automap: draw only cells the party has visited
  function drawMap(map, seen, px0, py0, pf) {
    clearEncounter("Automap of visited dungeon cells");
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
        const mark = spc && { up: "<", down: ">", sanctum: "S", shrine: "+", kiosk: "$", vault: "V", remains: "†" }[spc.t];
        if (mark) {
          ctx.fillStyle = "#ffd700";
          ctx.font = "12px Menlo, monospace";
          ctx.textAlign = "center";
          ctx.fillText(mark, cx + s / 2, cy + s - 4);
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
  // Artwork selection never consumes RNG or changes generated monster data.
  const CAMPAIGN_SCENES = {
    SLIME:"slime", KOBOLD:"kobold", GIANTRAT:"giant-rat", ORC:"orc",
    ROGUE:"rogue", BUSHWACKER:"rogue", SKELETON:"skeleton", ZOMBIE:"zombie", CRUD:"crud",
    MAGE1:"mage", MAGE5:"mage", PRIEST1:"priest", PRIEST3:"priest", WOLF:"hound",
    SPIDER:"spider", SAMURAI3:"samurai", GARGOYLE:"gargoyle", DRAGONFLY:"dragon-fly",
    BEETLE:"beetle", WEREWOLF:"werewolf", SHADE:"shade", APPRENTICE:"apprentice",
  };
  const SPECIES_SCENES = [
    ["iron ghoul","iron-ghoul"], ["bone knight","bone-knight"], ["death priest","priest"],
    ["flame mage","mage"], ["needle wasp","needle-wasp"],
    ["ogre","ogre"], ["troll","troll"], ["minotaur","minotaur"], ["golem","golem"],
    ["stalker","stalker"], ["hound","hound"], ["ghoul","ghoul"], ["marauder","rogue"],
    ["warlock","mage"], ["hexer","mage"], ["mage","mage"], ["cultist","priest"], ["acolyte","priest"], ["priest","priest"],
    ["spider","spider"], ["beetle","beetle"], ["dragon fly","dragon-fly"], ["dragonfly","dragon-fly"],
    ["drake","drake"], ["salamander","salamander"], ["wyrm","wyrm"],
    ["wight","wight"], ["revenant","revenant"], ["scorpion","scorpion"], ["widow","spider"],
  ];
  function encounterArt(def) {
    let name;
    if (def.id === "WARDEN8") name = "mother-of-thousands";
    else if (/^WARDEN(13|18|23|28|33)$/.test(def.id || "")) name = def.id.toLowerCase();
    else name = CAMPAIGN_SCENES[def.id];
    if (!name) {
      const species = def.base || def.name || "";
      const match = SPECIES_SCENES.find(([word]) => new RegExp("\\b"+word+"\\b", "i").test(species));
      name = match ? match[1] : ({blob:"slime",humanoid:"rogue",caster:"mage",undead:"wight",beast:"stalker",bug:"beetle",drake:"drake",brute:"golem"}[def.art] || "stalker");
    }
    return "assets/monsters/" + name + ".jpg";
  }
  const chestArt = opened => "assets/monsters/chest-" + (opened ? "open" : "closed") + ".jpg";
  const imageQueue = [];
  let imageLoads = 0;
  let preloadedMap = null;
  let preloadTargets = new Set();
  function pruneImages() {
    // Keep decoded-image memory bounded while retaining the current floor.
    for (const [path, entry] of encounterImages) {
      if (encounterImages.size <= 18) break;
      if ((entry.status === "ready" || entry.status === "failed") &&
          (!activeEncounter || activeEncounter.path !== path) && !preloadTargets.has(path)) encounterImages.delete(path);
    }
  }
  function pumpImages() {
    while (imageLoads < 3 && imageQueue.length) {
      const entry = imageQueue.shift();
      entry.status = "loading";
      imageLoads++;
      const complete = ok => {
        entry.status = ok ? "ready" : "failed";
        imageLoads--;
        entry.image.onload = entry.image.onerror = null;
        if (activeEncounter && activeEncounter.path === entry.path) {
          if (ok) paintEncounter(entry.image, activeEncounter);
          else pendingScene(activeEncounter, true);
        }
        pruneImages();
        pumpImages();
      };
      entry.image.onload = () => complete(true);
      entry.image.onerror = () => complete(false);
      entry.image.src = entry.path;
    }
  }
  function sceneImage(path, priority = false) {
    if (typeof Image === "undefined") return null;
    let entry = encounterImages.get(path);
    if (!entry) {
      entry = { path, image:new Image(), status:"queued" };
      encounterImages.set(path,entry);
      if (priority) imageQueue.unshift(entry); else imageQueue.push(entry);
    } else {
      encounterImages.delete(path); encounterImages.set(path,entry);
      if (priority && entry.status === "queued") {
        imageQueue.splice(imageQueue.indexOf(entry),1); imageQueue.unshift(entry);
      }
    }
    pumpImages();
    pruneImages();
    return entry;
  }
  function preloadFloor(map, floor) {
    if (typeof Image === "undefined" || preloadedMap === map) return;
    preloadedMap = map;
    const defs = (map.table || []).map(([id]) => MONSTERS[id]).filter(Boolean);
    if (WARDENS[floor]) defs.push(WARDENS[floor]);
    if (floor === 3) defs.push(MONSTERS.APPRENTICE);
    preloadTargets = new Set([...defs.map(encounterArt),chestArt(false),chestArt(true)]);
    // Discard queued work for a floor the player has already left.
    for (let i=imageQueue.length-1;i>=0;i--) {
      const entry=imageQueue[i];
      if (!preloadTargets.has(entry.path) && (!activeEncounter || activeEncounter.path!==entry.path)) {
        imageQueue.splice(i,1); encounterImages.delete(entry.path);
      }
    }
    for (const path of preloadTargets) sceneImage(path);
  }
  function preloadEncounter(defs) {
    for (const def of defs) sceneImage(encounterArt(def), true);
    sceneImage(chestArt(false)); sceneImage(chestArt(true));
  }
  function encounterCaption(scene) {
    const { def, count, options } = scene;
    ctx.fillStyle = "#09100dec";
    ctx.fillRect(0, 316, 560, 76);
    ctx.textAlign = "left";
    ctx.fillStyle = "#e7bc74";
    ctx.font = "10px Menlo, monospace";
    let heading, title;
    if (scene.kind === "chest") {
      heading = scene.opened ? "SPOILS RECOVERED / CONTINUE EXPLORING" : "TREASURE FOUND / APPROACH WITH CAUTION";
      title = scene.opened ? "The chest is yours." : "A guarded treasure chest";
    } else {
      const rank = /^WARDEN/.test(def.id) ? "FLOOR WARDEN" : def.boss ? "DUNGEON BOSS" : def.elite ? "NAMED ELITE" : "HOSTILE CONTACT";
      heading = `${rank}  /  ${count} REMAINING`; title = def.name;
    }
    ctx.fillText(heading,20,337,520);
    ctx.fillStyle = "#fff2da";
    ctx.font = "23px Georgia, serif";
    ctx.fillText(title,20,370,520);
    if (options.intent) {
      ctx.fillStyle = "#321611f2";
      ctx.fillRect(12,268,536,36);
      ctx.strokeStyle = "#e49370";ctx.lineWidth=1;
      ctx.strokeRect(12,268,536,36);
      ctx.fillStyle = "#ffd8b0";ctx.font="13px Menlo, monospace";
      ctx.fillText("! "+options.intent,24,291,510);
    }
  }
  function paintEncounter(image, scene) {
    const ratio = 560 / 392;
    const sw = Math.min(image.naturalWidth,image.naturalHeight*ratio), sh=sw/ratio;
    ctx.drawImage(image,(image.naturalWidth-sw)/2,(image.naturalHeight-sh)/2,sw,sh,0,0,560,392);
    encounterCaption(scene);
  }
  function pendingScene(scene, failed) {
    // Never flash a pixel portrait, another creature, or the previous screen.
    ctx.fillStyle="#101813";ctx.fillRect(0,0,560,392);
    ctx.fillStyle="#e7bc74";ctx.fillRect(250,157,60,2);
    ctx.textAlign="center";ctx.fillStyle="#b6c2b4";ctx.font="14px Georgia, serif";
    ctx.fillText(scene.kind === "chest" ? "Something worth finding." : "Something moves in the dark.",280,195);
    ctx.fillStyle="#95a394";ctx.font="11px Menlo, monospace";
    ctx.fillText(failed ? "Illustration unavailable. You can keep playing." : "Loading illustration…",280,221);
    encounterCaption(scene);
  }
  function showScene(scene) {
    if (!ctx) init();
    activeEncounter=scene;activeMaze=null;
    document.getElementById("view").ariaLabel=scene.kind === "chest"
      ? (scene.opened ? "Opened treasure chest; loot recovered" : "Closed treasure chest; contents unknown")
      : `${scene.def.name}, ${scene.count} remaining${scene.options.intent ? ", "+scene.options.intent : ""}`;
    const entry=sceneImage(scene.path,true);
    if (entry && entry.status === "ready") paintEncounter(entry.image,scene);
    else pendingScene(scene,entry && entry.status === "failed");
  }
  function monsterBox(def,count,options={}) {
    showScene({kind:"monster",def,count,options,path:encounterArt(def)});
  }
  function chestBox(opened=false) {
    showScene({kind:"chest",opened,options:{},path:chestArt(opened)});
  }
  return { draw, blank, drawMap, monsterBox, encounterArt, chestBox, preloadFloor, preloadEncounter };
})();
