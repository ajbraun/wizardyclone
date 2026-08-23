"use strict";
// ---------------------------------------------------------------- depth streak
// +10% spoils per new floor (4+) entered this expedition, capped at +100%.
// Lives on Game.maze, so surfacing — by any route — ends it.
function streakCount() {
  return Game.maze && Game.maze.streakFloors ? Object.keys(Game.maze.streakFloors).length : 0;
}
function streakMult() { return 1 + 0.1 * Math.min(10, streakCount()); }
function streakVisit(level) {
  if (level <= 3 || !Game.maze) return;
  Game.maze.streakFloors = Game.maze.streakFloors || {};
  if (Game.maze.streakFloors[level]) return;
  Game.maze.streakFloors[level] = 1;
  const n = streakCount();
  UI.log(`[SYSTEM] Depth streak ${n}: spoils +${Math.min(10, n) * 10}%. Surfacing forfeits it.`);
  Events.emit("streak", { count: n });
}
// one-shot points of interest persist their spent state in Game.flags
function poiFlag(m) { return "poi" + m.level + "_" + m.x + "," + m.y; }

function findSpecial(map, type) {
  for (const [k, s] of Object.entries(map.specials)) {
    if (s.t === type) {
      const [x, y] = k.split(",").map(Number);
      return { x, y, s };
    }
  }
  return null;
}
function markSeen(level, x, y) {
  if (!Game.seen[level]) Game.seen[level] = {};
  Game.seen[level][x + "," + y] = 1;
}

const MazeScreen = {
  draw() {
    const m = Game.maze;
    const map = getLevel(m.level);
    markSeen(m.level, m.x, m.y);
    Render.draw(map, m.x, m.y, m.f, m.light > 0 ? 4 : 3);
    const st = streakCount();
    UI.viewLabel(`MAZE  LEVEL ${m.level}${map.mod ? `  [${map.mod.name}]` : ""}${st ? `  STREAK+${Math.min(10, st) * 10}%` : ""}  FACING ${DIRNAMES[m.f]}${m.light > 0 ? "  *LIGHT*" : ""}`);
    const spc = map.specials[m.x + "," + m.y];
    let prompt = "";
    if (spc && spc.t === "up") {
      prompt = m.level === 1
        ? `\n<span class="k">Stairs UP to the castle. Press ENTER to leave the maze.</span>`
        : `\n<span class="k">Stairs UP. Press ENTER to climb.</span>`;
    } else if (spc && spc.t === "down") {
      const wd = WARDENS[m.level];
      prompt = (m.level === 3 && !Game.flags.boss)
        ? `\n<span class="dim">A sealed hatch. Something powerful holds it shut.</span>`
        : (wd && !Game.flags["warden" + m.level])
          ? `\n<span class="bad">The way down is sealed. ${esc(wd.name.toUpperCase())} holds the seal.</span>\n<span class="k">ENTER) Challenge the Warden</span>`
          : `\n<span class="k">Stairs DOWN. Press ENTER to descend.</span>`;
    } else if (spc && spc.t === "sanctum") {
      const st = streakCount();
      prompt = `\n<span class="gold">A SYSTEM SANCTUM hums here.</span>\n<span class="k">ENTER) Rest (once per expedition)   T) Elevator to castle (${elevatorToll(m.level)} gold toll${st ? `, forfeits +${Math.min(10, st) * 10}% streak` : ""})</span>`;
    } else if (spc && spc.t === "shrine" && !Game.flags[poiFlag(m)]) {
      prompt = `\n<span class="gold">A SHRINE hums with conditional love.</span>\n<span class="k">ENTER) Pray</span>`;
    } else if (spc && spc.t === "kiosk") {
      prompt = `\n<span class="gold">A SYSTEM KIOSK glows expectantly.</span>\n<span class="k">ENTER) Browse</span>`;
    } else if (spc && spc.t === "vault" && !Game.flags[poiFlag(m)]) {
      prompt = `\n<span class="gold">A SYSTEM VAULT. Something named is on retainer inside.</span>\n<span class="k">ENTER) Open it</span>`;
    } else if (spc && spc.t === "remains" && !Game.flags[poiFlag(m)]) {
      prompt = `\n<span class="k">The remains of a less fortunate crawler. ENTER) Search them</span>`;
    } else if (spc && spc.t === "amulet" && Game.flags.boss && !Game.flags.won) {
      prompt = `\n<span class="gold">A jeweled AMULET rests on a pedestal! Press ENTER to take it.</span>`;
    }
    UI.panel(`<h2>THE MAZE</h2>\n<span class="dim">ARROWS/WASD move   M) Map   C) Camp</span>${prompt}`);
  },
  key(k, e) {
    const m = Game.maze;
    const map = getLevel(m.level);
    if (k === "arrowup" || k === "w") this.step();
    else if (k === "arrowleft" || k === "a") { m.f = (m.f + 3) % 4; this.draw(); }
    else if (k === "arrowright" || k === "d") { m.f = (m.f + 1) % 4; this.draw(); }
    else if (k === "arrowdown" || k === "s") { m.f = (m.f + 2) % 4; this.draw(); }
    else if (k === "c") Game.go(CampScreen);
    else if (k === "m") Game.go(MapScreen);
    else if (k === "t") {
      const spc = map.specials[m.x + "," + m.y];
      if (spc && spc.t === "sanctum") {
        // the ride home always runs — the System takes what it can
        const toll = elevatorToll(m.level);
        const paid = Math.min(partyGold(), toll);
        spendPartyGold(paid, "toll");
        if (paid < toll) UI.log(`[SYSTEM] Toll is ${toll}. The System accepts your entire net worth (${paid}) as partial payment.`);
        else UI.log(`[SYSTEM] Toll of ${toll} gold collected.`);
        UI.log("The System elevator rattles you back to the surface. No music plays.");
        Events.emit("elevator", { from: m.level });
        Game.maze = null;
        Game.save();
        Game.go(CastleScreen);
      }
    }
    else if (e.key === "Enter") {
      const spc = map.specials[m.x + "," + m.y];
      if (!spc) return;
      if (spc.t === "up") {
        if (m.level === 1) {
          Game.maze = null;
          UI.log("Your party emerges into the daylight of the castle.");
          Events.emit("surface", {});
          Game.save();
          Game.go(CastleScreen);
        } else {
          const prev = getLevel(m.level - 1);
          const d = findSpecial(prev, "down");
          Game.maze = { level: m.level - 1, x: d.x, y: d.y, f: 0, light: m.light, sanc: m.sanc, streakFloors: m.streakFloors };
          UI.log(`You climb to level ${m.level - 1}.`);
          if (prev.mod) UI.log(prev.mod.announce);
          streakVisit(m.level - 1);
          Events.emit("ascend", { to: m.level - 1 });
          this.draw();
        }
      } else if (spc.t === "down") {
        if (m.level === 3 && !Game.flags.boss) {
          UI.log("The hatch is sealed by a will stronger than yours. For now.");
          return;
        }
        if (WARDENS[m.level] && !Game.flags["warden" + m.level]) {
          UI.log(`${WARDENS[m.level].name.toUpperCase()} rises to hold the seal!`);
          Combat.start({ warden: m.level });
          return;
        }
        const nxt = getLevel(m.level + 1);
        const u = findSpecial(nxt, "up");
        Game.maze = { level: m.level + 1, x: u.x, y: u.y, f: 2, light: m.light, sanc: m.sanc, streakFloors: m.streakFloors };
        UI.log(`You descend to level ${m.level + 1}...`);
        if (m.level + 1 > 3) UI.log("[SYSTEM] Welcome to the Crawl. The floors below are... enthusiastic.");
        if (m.level + 1 > 3 && (m.level <= 3 || bandOf(m.level + 1) !== bandOf(m.level))) UI.log(bandOf(m.level + 1).intro);
        if (nxt.mod) UI.log(nxt.mod.announce);
        streakVisit(m.level + 1);
        Events.emit("descend", { to: m.level + 1 });
        this.draw();
      } else if (spc.t === "sanctum") {
        m.sanc = m.sanc || {};
        if (m.sanc[m.level]) { UI.log("The sanctum's vending machine is empty. Come back next expedition."); return; }
        m.sanc[m.level] = true;
        for (const ch of Game.party) {
          if (!isUp(ch) && ch.status !== "PARALYZED") continue;
          if (ch.status === "POISONED" || ch.status === "PARALYZED") ch.status = "OK";
          ch.hp = ch.maxhp;
          restoreSP(ch);
        }
        if (!(Game.flags.sanctums || []).some(s => s.level === m.level)) {
          Game.flags.sanctums = Game.flags.sanctums || [];
          Game.flags.sanctums.push({ level: m.level, x: m.x, y: m.y });
        }
        UI.log("[SYSTEM] Rest stop engaged. HP and spells restored. Complimentary continental nothing.");
        Events.emit("sanctum", { level: m.level });
        Game.save();
        UI.renderParty();
        this.draw();
      } else if (spc.t === "shrine" && !Game.flags[poiFlag(m)]) {
        Game.flags[poiFlag(m)] = true;
        Events.emit("shrine", { level: m.level });
        const r = rnd(100);
        if (r < 40) {
          for (const ch of Game.party) if (isUp(ch)) { ch.hp = ch.maxhp; if (ch.status === "POISONED") ch.status = "OK"; }
          UI.log("[SYSTEM] The shrine approves of your groveling. Full restoration. No warranty.");
        } else if (r < 65) {
          const g = 40 * map.depth;
          for (const ch of Game.party) if (isUp(ch)) grantGold(ch, g, "shrine");
          UI.log(`[SYSTEM] The shrine dispenses ${g} gold apiece. Faith, monetized.`);
        } else if (r < 80) {
          UI.log("[SYSTEM] The shrine coughs up a BRONZE loot box. It expects a review.");
          openLootBox("BRONZE", map.depth);
        } else {
          const tithe = 30 * map.depth;
          spendPartyGold(Math.min(partyGold(), tithe), "shrine");
          const up = Game.party.filter(isUp);
          const victim = up.length ? pick(up) : null;
          if (victim && victim.status === "OK") { victim.status = "POISONED"; UI.log(`${victim.name} is poisoned by sanctified fumes!`); }
          UI.log(`[SYSTEM] The shrine was a donations audit. ${tithe} gold, collected with prejudice.`);
        }
        Game.save(); UI.renderParty(); this.draw();
      } else if (spc.t === "kiosk") {
        Game.go(KioskScreen);
      } else if (spc.t === "vault" && !Game.flags[poiFlag(m)]) {
        UI.log("The vault door grinds open. The guardian was told you'd come.");
        Combat.start({ vault: true, vaultKey: poiFlag(m) });
      } else if (spc.t === "remains" && !Game.flags[poiFlag(m)]) {
        Game.flags[poiFlag(m)] = true;
        Events.emit("remains", { level: m.level });
        UI.log(spc.note || "The remains have nothing left to say.");
        const gold = dice("2d10") * 5 * map.depth;
        const up = Game.party.filter(isUp);
        const share = Math.floor(gold / Math.max(1, up.length));
        for (const ch of up) grantGold(ch, share, "remains");
        UI.log(`You recover ${gold} gold. (${share} each)`);
        if (pct(35) && up.length) {
          const entry = generateItem(map.depth, 1);
          up[0].items.push(entry);
          UI.log(`${up[0].name} pries loose: ${IT(entry).name}!`);
        }
        Game.save(); UI.renderParty(); this.draw();
      } else if (spc.t === "amulet" && Game.flags.boss && !Game.flags.won) {
        Game.flags.won = true;
        Events.emit("won", {});
        UI.log("*** You take the JEWELED AMULET OF THE OVERLORD! ***");
        UI.log("Return to the castle in triumph! (The hatch below stays open...)");
        Game.save();
        this.draw();
      }
    }
  },
  step() {
    const m = Game.maze;
    const map = getLevel(m.level);
    const w = cellWalls(map, m.x, m.y)[m.f];
    if (w === 1) { UI.log("*OUCH* You walk into a wall."); Events.emit("bump", { level: m.level }); return; }
    if (w === 2) { UI.log("You push open the door..."); Events.emit("door", { level: m.level }); }
    m.x += DIRS[m.f].dx;
    m.y += DIRS[m.f].dy;
    if (m.light > 0) m.light--;
    markSeen(m.level, m.x, m.y);
    Events.emit("step", { level: m.level, x: m.x, y: m.y });
    for (const ch of Game.party) {
      if (ch.status === "POISONED" && ch.hp > 0) {
        if (applyDamage(ch, 1, { type: "poison" })) UI.log(`${ch.name} succumbs to poison!`);
      }
    }
    UI.renderParty();
    if (!Game.party.some(isUp)) { partyWipe(); return; }
    this.draw();
    this.onEnter(w === 2);
  },
  onEnter(throughDoor) {
    const m = Game.maze;
    const map = getLevel(m.level);
    const key = m.x + "," + m.y;
    const spc = map.specials[key];
    if (spc) {
      if (spc.t === "msg") UI.log(spc.msg);
      else if (spc.t === "lair") {
        const flagKey = "lair" + m.level + "_" + key;
        if (!Game.flags[flagKey]) {
          Game.flags[flagKey] = true;
          UI.log("A monster lair!");
          Combat.start({ lair: true });
          return;
        }
      } else if (spc.t === "boss") {
        if (!Game.flags.boss) {
          UI.log('"WHO DARES DISTURB MY STUDIES?" bellows a robed figure!');
          Combat.start({ boss: true });
          return;
        }
      }
    }
    const rate = map.rate + (throughDoor ? 8 : 0);
    if (pct(rate)) Combat.start({});
  },
};

// ---------------------------------------------------------------- kiosk
// A System vending machine in the deep: two potions per kiosk, convenience
// pricing. The party's pooled gold pays; the first able member carries.
const KioskScreen = {
  stock() {
    const m = Game.maze;
    const base = "kiosk" + m.level + "_" + m.x + "," + m.y + "_";
    return [
      { id: "P_DIOS", price: 750, flag: base + "DIOS" },
      { id: "P_LATUMOFIS", price: 450, flag: base + "LATU" },
    ];
  },
  draw() {
    UI.viewLabel("SYSTEM KIOSK");
    const rows = this.stock().map((s, i) => {
      if (Game.flags[s.flag]) return `<span class="dim">${i + 1}) ${pad(ITEMS[s.id].name, 22)} SOLD OUT</span>`;
      return UI.key(String(i + 1), `${pad(ITEMS[s.id].name, 22)} ${s.price} gold`);
    }).join("\n");
    UI.panel(`<h2>SYSTEM KIOSK</h2>\n<span class="dim">"Convenience is a service. Services have fees." — The System</span>\n\n${rows}\n\n<span class="dim">Party gold: ${partyGold()}</span>\n\n${UI.key("L", "Leave")}`);
  },
  key(k) {
    if (k === "l") { Game.go(MazeScreen); return; }
    const i = parseInt(k, 10) - 1;
    const s = this.stock()[i];
    if (!s || Game.flags[s.flag]) return;
    if (partyGold() < s.price) { UI.log("[SYSTEM] Insufficient funds. The kiosk's sympathy module was never installed."); return; }
    spendPartyGold(s.price, "kiosk");
    const holder = Game.party.filter(isUp)[0];
    holder.items.push({ id: s.id });
    Game.flags[s.flag] = true;
    UI.log(`${holder.name} buys a ${ITEMS[s.id].name}. The kiosk thanks no one.`);
    Events.emit("kiosk", { id: s.id, price: s.price });
    Game.save(); UI.renderParty(); this.draw();
  },
};

// ---------------------------------------------------------------- automap
const MapScreen = {
  draw() {
    const m = Game.maze;
    const map = getLevel(m.level);
    if (map.mod && map.mod.dark) {
      Render.blank("SIGNAL LOST");
      UI.viewLabel(`MAP  LEVEL ${m.level}  [${map.mod.name}]`);
      UI.panel(`<h2>AUTOMAP — LEVEL ${m.level}</h2>\n<span class="bad">SIGNAL LOST.</span>\n<span class="dim">[SYSTEM] This floor is a BLACKOUT zone. The map knows nothing.\nYour legs will have to remember for it.</span>\n\n${UI.key("M", "Close map")}  ${UI.key("L", "Close map")}`);
      return;
    }
    Render.drawMap(map, Game.seen[m.level] || {}, m.x, m.y, m.f);
    UI.viewLabel(`MAP  LEVEL ${m.level}`);
    UI.panel(`<h2>AUTOMAP — LEVEL ${m.level}${map.band ? ` — ${esc(map.band.toUpperCase())}` : ""}</h2>\n<span class="dim">Only where you've walked. The rest is the dark's business.\n\n^ you   &lt; up   &gt; down   S sanctum   + shrine   $ kiosk   V vault   † remains</span>\n\n${UI.key("M", "Close map")}  ${UI.key("L", "Close map")}`);
  },
  key(k, e) {
    if (k === "m" || k === "l" || e.key === "Escape") Game.go(MazeScreen);
  },
};

// ---------------------------------------------------------------- party wipe
function partyWipe() {
  const floor = Game.maze ? Game.maze.level : 0;
  const fallen = Game.party.map(c => `${c.name} (L${c.level} ${c.cls})`);
  for (const ch of Game.party) {
    if (ch.status === "OK" || ch.status === "POISONED" || ch.status === "PARALYZED") ch.status = "DEAD";
  }
  Events.emit("wipe", { party: Game.party.slice(), level: floor });
  Game.party = [];
  Game.maze = null;
  Game.save();
  WipeScreen.info = { floor, fallen };
  Game.go(WipeScreen);
}

const WipeScreen = {
  info: null,
  draw() {
    Render.blank("GAME OVER");
    UI.viewLabel("");
    const i = this.info || { floor: "?", fallen: [] };
    const c = Game.counters;
    UI.panel(`<h2>THE SYSTEM'S OBITUARY</h2>\n` +
      `<span class="bad">Your party has been annihilated on floor ${i.floor}.</span>\n\n` +
      i.fallen.map(f => `  † ${esc(f)}`).join("\n") + "\n\n" +
      `<span class="dim">Career to date: ${c["e:step"] || 0} steps, ${c.kills || 0} kills, ${c.deaths || 0} deaths,\n` +
      `${c.goldEarned || 0} gold earned, deepest floor ${c.maxDepth || 1}.</span>\n\n` +
      `<span class="dim">"They died doing what they loved: being outnumbered." — The System</span>\n\n` +
      `A search party drags the bodies to the Temple of Cant.\n\n<span class="k">[ press any key ]</span>`);
  },
  key() { Game.go(CastleScreen); },
};

// ---------------------------------------------------------------- camp
const CampScreen = {
  mode: "menu", caster: null, spell: null, order: null,
  enter() { this.mode = "menu"; this.caster = null; this.spell = null; Events.emit("camp", {}); },
  draw() {
    UI.viewLabel("CAMP");
    if (this.mode === "menu") {
      UI.panel(`<h2>CAMP</h2>\n${UI.key("C", "Cast a spell")}\n${UI.key("I", "Inspect a member (1-" + Game.party.length + " after pressing I)")}\n${UI.key("R", "Reorder party")}\n${UI.key("S", "The System")}\n${UI.key("Q", "Save & quit (resume here later)")}\n${UI.key("L", "Break camp")}`);
    } else if (this.mode === "who" || this.mode === "inspect") {
      UI.panel(`<h2>${this.mode === "who" ? "WHO CASTS?" : "INSPECT WHO?"}</h2>\n<span class="dim">Press member number 1-${Game.party.length}</span>\n\n${UI.key("L", "Back")}`);
    } else if (this.mode === "spell") {
      const ch = this.caster;
      const list = campSpells(ch);
      const rows = list.map((s, i) => {
        const def = SPELLS[s];
        const can = ch.sp[def.book][def.sl - 1] > 0;
        const label = `${pad(s, 10)} L${def.sl} ${def.book}  <span class="dim">${esc(def.desc)}</span>`;
        return can ? UI.key(LETTERS[i], label) : `<span class="dim">${LETTERS[i]}) ${label}</span>`;
      }).join("\n") || '<span class="dim">(no camp spells known)</span>';
      UI.panel(`<h2>${esc(ch.name)} CASTS...</h2>\n${rows}\n\n${UI.key("L", "Back")}`);
    } else if (this.mode === "target") {
      UI.panel(`<h2>${this.spell} ON WHOM?</h2>\n<span class="dim">Press member number 1-${Game.party.length}</span>\n\n${UI.key("L", "Back")}`);
    } else if (this.mode === "reorder") {
      UI.panel(`<h2>REORDER</h2>\nPress member numbers in the new order.\nChosen: ${this.order.map(c => esc(c.name)).join(", ") || "(none)"}\n\n${UI.key("L", "Cancel")}`);
    }
  },
  key(k, e) {
    if (this.mode === "menu") {
      if (k === "c") { this.mode = "who"; this.draw(); }
      else if (k === "i") { this.mode = "inspect"; this.draw(); }
      else if (k === "r") { this.mode = "reorder"; this.order = []; this.draw(); }
      else if (k === "s") { openSystem(CampScreen); }
      else if (k === "q") { Game.save(); UI.log("The party makes camp. Game saved."); Game.go(TitleScreen); }
      else if (k === "l") Game.go(MazeScreen);
      return;
    }
    if (k === "l") { this.mode = "menu"; this.draw(); return; }
    const i = parseInt(k, 10) - 1;
    if (this.mode === "who" || this.mode === "inspect") {
      if (i >= 0 && i < Game.party.length) {
        const ch = Game.party[i];
        if (this.mode === "inspect") {
          Game.go(inspectScreen(ch, () => { CampScreen.mode = "menu"; Game.go(CampScreen); }));
        } else {
          if (!isUp(ch)) { UI.log(`${ch.name} is in no shape to cast.`); return; }
          this.caster = ch; this.mode = "spell"; this.draw();
        }
      }
      return;
    }
    if (this.mode === "spell") {
      const list = campSpells(this.caster);
      const idx = LETTERS.indexOf(k);
      if (idx >= 0 && idx < list.length) {
        const name = list[idx];
        const def = SPELLS[name];
        if (this.caster.sp[def.book][def.sl - 1] <= 0) { UI.log("No spell points left for that level."); return; }
        if (def.target === "ally") { this.spell = name; this.mode = "target"; this.draw(); }
        else { castCampSpell(this.caster, name, null); this.mode = "menu"; this.draw(); }
      }
      return;
    }
    if (this.mode === "target") {
      if (i >= 0 && i < Game.party.length) {
        castCampSpell(this.caster, this.spell, Game.party[i]);
        this.mode = "menu"; this.draw();
      }
      return;
    }
    if (this.mode === "reorder") {
      if (i >= 0 && i < Game.party.length) {
        const ch = Game.party[i];
        if (!this.order.includes(ch)) this.order.push(ch);
        if (this.order.length === Game.party.length) {
          Game.party = this.order;
          UI.log("The marching order is changed.");
          UI.renderParty();
          this.mode = "menu";
        }
        this.draw();
      }
    }
  },
};
function campSpells(ch) {
  return knownSpells(ch).filter(s => SPELLS[s].where === "camp" || SPELLS[s].where === "any");
}
function castCampSpell(ch, name, target) {
  const def = SPELLS[name];
  ch.sp[def.book][def.sl - 1]--;
  UI.log(`${ch.name} casts ${name}!`);
  Events.emit("spell", { ch, name, combat: false });
  if (def.kind === "heal") {
    if (!target || !isUp(target)) { UI.log("Nothing happens."); return finishCast(); }
    const amt = applyHeal(target, dice(def.dice) + Math.floor(mod(ch, "healPower")), { type: "spell", name });
    UI.log(`${target.name} is healed ${amt} points.`);
  } else if (def.kind === "light") {
    Game.maze.light = (Game.maze.light || 0) + def.amt;
    UI.log("A magical light surrounds the party.");
  } else if (def.kind === "locate") {
    const m = Game.maze;
    UI.log(`You are at (${m.x} E, ${m.y} S) on level ${m.level}, facing ${DIRNAMES[m.f]}.`);
  } else if (def.kind === "curepoison") {
    if (target && target.status === "POISONED") { target.status = "OK"; UI.log(`${target.name} is cured of poison.`); }
    else UI.log("Nothing happens.");
  } else if (def.kind === "cureparalyze") {
    if (target && target.status === "PARALYZED") { target.status = "OK"; UI.log(`${target.name} can move again!`); }
    else UI.log("Nothing happens.");
  }
  finishCast();
}
function finishCast() { UI.renderParty(); }
