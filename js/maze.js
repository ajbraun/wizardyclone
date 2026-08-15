"use strict";
const MazeScreen = {
  draw() {
    const m = Game.maze;
    const map = LEVELS[m.level];
    Render.draw(map, m.x, m.y, m.f, m.light > 0 ? 4 : 3);
    UI.viewLabel(`MAZE  LEVEL ${m.level}  FACING ${DIRNAMES[m.f]}${m.light > 0 ? "  *LIGHT*" : ""}`);
    const spc = map.specials[m.x + "," + m.y];
    let prompt = "";
    if (spc && spc.t === "up") prompt = `\n<span class="k">There are stairs UP here. Press ENTER to climb.</span>`;
    if (spc && spc.t === "down") prompt = `\n<span class="k">There are stairs DOWN here. Press ENTER to descend.</span>`;
    if (spc && spc.t === "amulet" && Game.flags.boss && !Game.flags.won)
      prompt = `\n<span class="gold">A jeweled AMULET rests on a pedestal! Press ENTER to take it.</span>`;
    UI.panel(`<h2>THE MAZE</h2>\n<span class="dim">ARROWS/WASD move   C) Camp</span>${prompt}`);
  },
  key(k, e) {
    const m = Game.maze;
    const map = LEVELS[m.level];
    if (k === "arrowup" || k === "w") this.step();
    else if (k === "arrowleft" || k === "a") { m.f = (m.f + 3) % 4; this.draw(); }
    else if (k === "arrowright" || k === "d") { m.f = (m.f + 1) % 4; this.draw(); }
    else if (k === "arrowdown" || k === "s") { m.f = (m.f + 2) % 4; this.draw(); }
    else if (k === "c") Game.go(CampScreen);
    else if (e.key === "Enter") {
      const spc = map.specials[m.x + "," + m.y];
      if (!spc) return;
      if (spc.t === "up" && m.level === 1) {
        Game.maze = null;
        UI.log("Your party emerges into the daylight of the castle.");
        Game.save();
        Game.go(CastleScreen);
      } else if (spc.t === "up" || spc.t === "down") {
        Game.maze = { level: spc.dest.level, x: spc.dest.x, y: spc.dest.y, f: spc.dest.f, light: m.light };
        UI.log(spc.t === "down" ? `You descend to level ${spc.dest.level}...` : `You climb to level ${spc.dest.level}.`);
        this.draw();
      } else if (spc.t === "amulet" && Game.flags.boss && !Game.flags.won) {
        Game.flags.won = true;
        UI.log("*** You take the JEWELED AMULET OF THE OVERLORD! ***");
        UI.log("Return to the castle in triumph!");
        Game.save();
        this.draw();
      }
    }
  },
  step() {
    const m = Game.maze;
    const map = LEVELS[m.level];
    const w = cellWalls(map, m.x, m.y)[m.f];
    if (w === 1) { UI.log("*OUCH* You walk into a wall."); return; }
    if (w === 2) UI.log("You push open the door...");
    m.x += DIRS[m.f].dx;
    m.y += DIRS[m.f].dy;
    if (m.light > 0) m.light--;
    // poison ticks
    for (const ch of Game.party) {
      if (ch.status === "POISONED" && ch.hp > 0) {
        ch.hp--;
        if (ch.hp <= 0) { ch.hp = 0; ch.status = "DEAD"; UI.log(`${ch.name} succumbs to poison!`); }
      }
    }
    UI.renderParty();
    if (!Game.party.some(isUp)) { partyWipe(); return; }
    this.draw();
    this.onEnter(w === 2);
  },
  onEnter(throughDoor) {
    const m = Game.maze;
    const map = LEVELS[m.level];
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

function partyWipe() {
  for (const ch of Game.party) {
    if (ch.status === "OK" || ch.status === "POISONED" || ch.status === "PARALYZED") ch.status = "DEAD";
  }
  UI.log("*** YOUR PARTY HAS BEEN ANNIHILATED ***");
  UI.log("Days later, a search party drags the bodies back to the Temple of Cant.");
  Game.party = [];
  Game.maze = null;
  Game.save();
  Game.go(CastleScreen);
}

// ---------------------------------------------------------------- camp
const CampScreen = {
  mode: "menu", caster: null, spell: null, order: null,
  enter() { this.mode = "menu"; this.caster = null; this.spell = null; },
  draw() {
    UI.viewLabel("CAMP");
    if (this.mode === "menu") {
      UI.panel(`<h2>CAMP</h2>\n${UI.key("C", "Cast a spell")}\n${UI.key("I", "Inspect a member (1-" + Game.party.length + " after pressing I)")}\n${UI.key("R", "Reorder party")}\n${UI.key("Q", "Save & quit (resume here later)")}\n${UI.key("L", "Break camp")}`);
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
  if (def.kind === "heal") {
    if (!target || !isUp(target)) { UI.log("Nothing happens."); return finishCast(); }
    const amt = dice(def.dice);
    target.hp = Math.min(target.maxhp, target.hp + amt);
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
