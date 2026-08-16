"use strict";
// ---------------------------------------------------------------- helpers
function partyGold() { return Game.party.reduce((a, c) => a + c.gold, 0); }
function spendPartyGold(amt, src) {
  for (const ch of Game.party) {
    const take = Math.min(ch.gold, amt);
    if (take > 0) spendGold(ch, take, src || "party");
    amt -= take;
    if (amt <= 0) break;
  }
}
// selection alphabet for lettered lists — deliberately no "l", it's reserved
// for Leave/Back on every screen
const LETTERS = "abcdefghijkmnopqrstu";

// ---------------------------------------------------------------- castle
const CastleScreen = {
  draw() {
    Render.blank("CASTLE");
    UI.viewLabel("");
    let extra = "";
    if (Game.flags.won) {
      extra = `\n<span class="gold">*** The Amulet has been returned! The realm is saved. ***</span>\n<span class="dim">(You may keep adventuring for glory.)</span>\n`;
    }
    UI.panel(`<h2>CASTLE</h2>${extra}\n${UI.key("G", "Gilgamesh's Tavern")}\n${UI.key("A", "Adventurer's Inn")}\n${UI.key("B", "Boltac's Trading Post")}\n${UI.key("T", "Temple of Cant")}\n${UI.key("S", "The System")}\n${UI.key("E", "Edge of Town")}`);
  },
  key(k) {
    if (k === "g") Game.go(TavernScreen);
    else if (k === "a") Game.go(InnScreen);
    else if (k === "b") Game.go(ShopScreen);
    else if (k === "t") Game.go(TempleScreen);
    else if (k === "s") openSystem(CastleScreen);
    else if (k === "e") Game.go(EdgeScreen);
  },
};

// ---------------------------------------------------------------- edge of town
const EdgeScreen = {
  mode: "menu",
  enter() { this.mode = "menu"; },
  deepestSanctum() {
    const s = Game.flags.sanctums || [];
    return s.length ? s.reduce((a, b) => (b.level > a.level ? b : a)) : null;
  },
  draw() {
    Render.blank("EDGE OF TOWN");
    if (this.mode === "enter") {
      const s = this.deepestSanctum();
      UI.panel(`<h2>ENTER THE MAZE</h2>\n${UI.key(1, "The stairs (Level 1)")}\n${UI.key(2, `System elevator to the Floor ${s.level} sanctum`)}\n\n${UI.key("L", "Back")}`);
      return;
    }
    UI.panel(`<h2>EDGE OF TOWN</h2>\n${UI.key("T", "Training Grounds")}\n${UI.key("M", "The Maze")}\n${UI.key("C", "Castle")}\n${UI.key("L", "Leave Game (save)")}`);
  },
  enterMaze(start) {
    UI.log("Your party descends into the maze...");
    Game.maze = start;
    Game.go(MazeScreen);
  },
  key(k) {
    if (this.mode === "enter") {
      if (k === "l") { this.mode = "menu"; this.draw(); return; }
      const s = this.deepestSanctum();
      if (k === "1") { const st = LEVELS[1].start; this.enterMaze({ level: 1, x: st.x, y: st.y, f: st.f, light: 0 }); }
      else if (k === "2" && s) {
        getLevel(s.level); // ensure the floor (and its monsters) exist
        UI.log(`[SYSTEM] Elevator descending to floor ${s.level}. Mind the everything.`);
        this.enterMaze({ level: s.level, x: s.x, y: s.y, f: 0, light: 0 });
      }
      return;
    }
    if (k === "t") Game.go(TrainingScreen);
    else if (k === "c") Game.go(CastleScreen);
    else if (k === "m") {
      if (!Game.party.some(isUp)) { UI.log("You need an able-bodied party to enter the maze."); return; }
      if (Game.maze) { Game.go(MazeScreen); return; } // resume saved expedition
      if (this.deepestSanctum()) { this.mode = "enter"; this.draw(); return; }
      const st = LEVELS[1].start;
      this.enterMaze({ level: 1, x: st.x, y: st.y, f: st.f, light: 0 });
    } else if (k === "l") { Game.save(); Game.go(TitleScreen); }
  },
};

// ---------------------------------------------------------------- tavern
const TavernScreen = {
  mode: "menu",
  draw() {
    Render.blank("GILGAMESH'S TAVERN");
    if (this.mode === "menu") {
      UI.panel(`<h2>GILGAMESH'S TAVERN</h2>\n${UI.key("A", "Add a member")}\n${UI.key("R", "Remove a member")}\n${UI.key("I", "Inspect a member")}\n${UI.key("D", "Divvy gold")}\n${UI.key("L", "Leave")}`);
    } else if (this.mode === "add") {
      const avail = this.available();
      const list = avail.length
        ? avail.map((ch, i) => `${UI.key(LETTERS[i], `${pad(esc(ch.name), 14)} L${ch.level} ${ch.align[0]}-${ch.cls} ${ch.status}`)}`).join("\n")
        : '<span class="dim">(no one suitable is waiting)</span>';
      UI.panel(`<h2>ADD WHO?</h2>\n${list}\n\n${UI.key("L", "Back")}`);
    } else if (this.mode === "remove") {
      UI.panel(`<h2>REMOVE WHO?</h2>\n<span class="dim">Press member number 1-${Game.party.length}</span>\n\n${UI.key("L", "Back")}`);
    } else if (this.mode === "inspect") {
      UI.panel(`<h2>INSPECT WHO?</h2>\n<span class="dim">Press member number 1-${Game.party.length}</span>\n\n${UI.key("L", "Back")}`);
    }
  },
  available() {
    const partyAligns = new Set(Game.party.map(c => c.align));
    return Game.roster.filter(ch => {
      if (Game.party.includes(ch)) return false;
      if (Game.party.length >= 6) return false;
      if (ch.align === "Good" && partyAligns.has("Evil")) return false;
      if (ch.align === "Evil" && partyAligns.has("Good")) return false;
      return true;
    });
  },
  key(k) {
    if (this.mode === "menu") {
      if (k === "a") { this.mode = "add"; this.draw(); }
      else if (k === "r") { this.mode = "remove"; this.draw(); }
      else if (k === "i") { this.mode = "inspect"; this.draw(); }
      else if (k === "d") {
        if (Game.party.length) {
          const total = partyGold();
          const each = Math.floor(total / Game.party.length);
          Game.party.forEach((c, i) => c.gold = each + (i === 0 ? total - each * Game.party.length : 0));
          UI.log("The party's gold is divided evenly.");
          UI.renderParty();
        }
      }
      else if (k === "l") Game.go(CastleScreen);
    } else if (this.mode === "add") {
      if (k === "l") { this.mode = "menu"; this.draw(); return; }
      const idx = LETTERS.indexOf(k);
      const avail = this.available();
      if (idx >= 0 && idx < avail.length) {
        Game.party.push(avail[idx]);
        UI.log(`${avail[idx].name} joins the party.`);
        UI.renderParty();
        this.draw();
      }
    } else if (this.mode === "remove" || this.mode === "inspect") {
      if (k === "l") { this.mode = "menu"; this.draw(); return; }
      const i = parseInt(k, 10) - 1;
      if (i >= 0 && i < Game.party.length) {
        if (this.mode === "remove") {
          UI.log(`${Game.party[i].name} heads back to the tavern.`);
          Game.party.splice(i, 1);
          UI.renderParty();
          this.draw();
        } else {
          Game.go(inspectScreen(Game.party[i], () => { TavernScreen.mode = "menu"; Game.go(TavernScreen); }));
        }
      }
    }
  },
  enter() { this.mode = "menu"; },
};

// ---------------------------------------------------------------- inspect
function inspectScreen(ch, backFn) {
  return {
    mode: "view", tradeIdx: -1,
    draw() {
      let extra = "";
      if (this.mode === "detail") {
        UI.panel(itemCard(ch.items[this.detailIdx], ch) + `\n\n${UI.key("L", "Back")}`);
        return;
      }
      if (this.mode === "equip") extra = `\n<span class="k">Press an item number to equip/unequip.</span> ${UI.key("L", "Done")}`;
      else if (this.mode === "drop") extra = `\n<span class="k">Press an item number to DROP it.</span> ${UI.key("L", "Done")}`;
      else if (this.mode === "use") extra = `\n<span class="k">Press a potion's number to drink it.</span> ${UI.key("L", "Done")}`;
      else if (this.mode === "trade") extra = `\n<span class="k">Press an item number to give away.</span> ${UI.key("L", "Done")}`;
      else if (this.mode === "tradeTo") {
        const names = Game.party.map((p, i) => `${i + 1}=${esc(p.name)}`).join("  ");
        extra = `\n<span class="k">Give the ${esc(IT(ch.items[this.tradeIdx]).name)} to whom?</span>\n${names}\n${UI.key("L", "Cancel")}`;
      }
      else extra = `\n<span class="dim">Press an item's number for its full stats.</span>\n${UI.key("E", "Equip")}  ${UI.key("T", "Trade item")}  ${UI.key("D", "Drop item")}  ${UI.key("U", "Use potion")}  ${UI.key("L", "Leave")}`;
      UI.panel(UI.charSheet(ch) + "\n" + extra);
    },
    key(k) {
      if (this.mode === "view") {
        if (k === "e") { this.mode = "equip"; this.draw(); }
        else if (k === "t") { this.mode = "trade"; this.draw(); }
        else if (k === "d") { this.mode = "drop"; this.draw(); }
        else if (k === "u") { this.mode = "use"; this.draw(); }
        else if (k === "l") backFn();
        else {
          const n = parseInt(k, 10) - 1;
          if (n >= 0 && n < ch.items.length) { this.detailIdx = n; this.mode = "detail"; this.draw(); }
        }
        return;
      }
      if (k === "l") { this.mode = "view"; this.draw(); return; }
      const i = parseInt(k, 10) - 1;
      if (this.mode === "tradeTo") {
        if (i >= 0 && i < Game.party.length) {
          const target = Game.party[i];
          if (target === ch) { UI.log(`${ch.name} hands it to... ${ch.name}. Done?`); }
          else {
            const entry = ch.items.splice(this.tradeIdx, 1)[0];
            entry.eq = false;
            target.items.push(entry);
            Events.emit("trade", { from: ch, to: target, id: entry.id });
            UI.log(`${ch.name} gives the ${IT(entry).name} to ${target.name}.`);
          }
          this.mode = "view";
          UI.renderParty();
          this.draw();
        }
        return;
      }
      if (!(i >= 0 && i < ch.items.length)) return;
      const entry = ch.items[i];
      const def = IT(entry);
      if (this.mode === "trade") {
        if (Game.party.length < 2 || !Game.party.includes(ch)) { UI.log("No one around to trade with."); return; }
        this.tradeIdx = i;
        this.mode = "tradeTo";
        this.draw();
        return;
      }
      if (this.mode === "equip") {
        if (entry.eq) entry.eq = false;
        else if (!canUseItem(ch, entry.id)) UI.log(`${ch.name} cannot use the ${def.name}.`);
        else if (def.slot === "potion") UI.log("Potions are used, not equipped.");
        else {
          ch.items.forEach(o => { if (ITEMS[o.id].slot === def.slot) o.eq = false; });
          entry.eq = true;
        }
      } else if (this.mode === "drop") {
        ch.items.splice(i, 1);
        UI.log(`${ch.name} drops the ${def.name}.`);
      } else if (this.mode === "use") {
        if (def.slot !== "potion") { UI.log("That is not a potion."); return; }
        usePotion(ch, ch, i);
      }
      UI.renderParty();
      this.draw();
    },
  };
}
function usePotion(user, target, itemIdx) {
  const entry = user.items[itemIdx];
  const def = ITEMS[entry.id];
  if (def.use === "heal") {
    const amt = applyHeal(target, dice(def.dice), { type: "potion" });
    UI.log(`${target.name} is healed ${amt} points.`);
  } else if (def.use === "curepoison") {
    if (target.status === "POISONED") target.status = "OK";
    UI.log(`${target.name} is cured of poison.`);
  }
  user.items.splice(itemIdx, 1);
  Events.emit("potion", { ch: user, target, id: entry.id });
}

// ---------------------------------------------------------------- training grounds
const TrainingScreen = {
  mode: "menu",
  draw() {
    Render.blank("TRAINING GROUNDS");
    if (this.mode === "menu") {
      UI.panel(`<h2>TRAINING GROUNDS</h2>\n<span class="dim">Adventurers on roster: ${Game.roster.length}/20</span>\n\n${UI.key("C", "Create a character")}\n${UI.key("I", "Inspect a character")}\n${UI.key("D", "Delete a character")}\n${UI.key("L", "Leave")}`);
    } else {
      const list = Game.roster.map((ch, i) =>
        UI.key(LETTERS[i], `${pad(esc(ch.name), 14)} L${ch.level} ${ch.align[0]}-${ch.cls} ${ch.status}${Game.party.includes(ch) ? ' <span class="dim">(in party)</span>' : ""}`)
      ).join("\n") || '<span class="dim">(roster is empty)</span>';
      const verb = this.mode === "inspect" ? "INSPECT" : "DELETE";
      UI.panel(`<h2>${verb} WHO?</h2>\n${list}\n\n${UI.key("L", "Back")}`);
    }
  },
  key(k) {
    if (this.mode === "menu") {
      if (k === "c") {
        if (Game.roster.length >= 20) { UI.log("The roster is full."); return; }
        Game.go(makeCreateScreen());
      }
      else if (k === "i") { this.mode = "inspect"; this.draw(); }
      else if (k === "d") { this.mode = "delete"; this.draw(); }
      else if (k === "l") Game.go(EdgeScreen);
      return;
    }
    if (k === "l") { this.mode = "menu"; this.draw(); return; }
    const idx = LETTERS.indexOf(k);
    if (idx < 0 || idx >= Game.roster.length) return;
    const ch = Game.roster[idx];
    if (this.mode === "inspect") {
      Game.go(inspectScreen(ch, () => { TrainingScreen.mode = "menu"; Game.go(TrainingScreen); }));
    } else {
      Game.roster.splice(idx, 1);
      const pi = Game.party.indexOf(ch);
      if (pi >= 0) Game.party.splice(pi, 1);
      UI.log(`${ch.name} is expunged from the roster.`);
      UI.renderParty();
      this.draw();
    }
  },
  enter() { this.mode = "menu"; },
};

// ---------------------------------------------------------------- character creation
function makeCreateScreen() {
  const S = {
    step: "name", name: "", race: null, align: null, stats: null, bonus: 0, cursor: 0,
    draw() {
      Render.blank("TRAINING GROUNDS");
      if (this.step === "name") {
        UI.panel(`<h2>CREATE CHARACTER</h2>\nEnter a name, then press ENTER:\n\n> <span class="hi">${esc(this.name)}</span><span class="k">_</span>\n\n<span class="dim">(ESC to cancel)</span>`);
      } else if (this.step === "race") {
        const rows = Object.keys(RACES).map((r, i) => {
          const b = RACES[r];
          return UI.key(i + 1, `${pad(r, 8)} ${STATS.map(s => pad(s, 3) + padl(b[s], 2) + " ").join("")}`);
        }).join("\n");
        UI.panel(`<h2>${esc(this.name)} — CHOOSE RACE</h2>\n${rows}`);
      } else if (this.step === "align") {
        UI.panel(`<h2>${esc(this.name)} — ALIGNMENT</h2>\n${UI.key(1, "Good")}\n${UI.key(2, "Neutral")}\n${UI.key(3, "Evil")}`);
      } else if (this.step === "bonus") {
        const rows = STATS.map((s, i) => {
          const cur = i === this.cursor;
          return `${cur ? '<span class="cursor">' : ""} ${cur ? ">" : " "} ${pad(s, 4)} ${padl(this.stats[s], 2)}${cur ? "</span>" : ""}`;
        }).join("\n");
        const elig = eligibleClasses(this.stats, this.align);
        UI.panel(`<h2>${esc(this.name)} — ALLOCATE BONUS</h2>\nBonus points left: <span class="k">${this.bonus}</span>\n\n${rows}\n\n<span class="dim">Arrows: move/adjust. ENTER when bonus is 0.</span>\nEligible now: ${elig.join(", ") || "(none)"}`);
      } else if (this.step === "class") {
        const elig = eligibleClasses(this.stats, this.align);
        const rows = elig.map((c, i) => UI.key(i + 1, c)).join("\n");
        UI.panel(`<h2>${esc(this.name)} — CHOOSE CLASS</h2>\n${rows}`);
      }
    },
    key(k, e) {
      if (this.step === "name") {
        if (e.key === "Escape") { Game.go(TrainingScreen); return; }
        if (e.key === "Enter" && this.name.length) {
          this.step = "race"; this.draw(); return;
        }
        if (e.key === "Backspace") { this.name = this.name.slice(0, -1); this.draw(); return; }
        if (/^[a-zA-Z0-9 ]$/.test(e.key) && this.name.length < 12) {
          this.name += this.name.length === 0 ? e.key.toUpperCase() : e.key;
          this.draw();
        }
        return;
      }
      if (this.step === "race") {
        const i = parseInt(k, 10) - 1;
        const names = Object.keys(RACES);
        if (i >= 0 && i < names.length) {
          this.race = names[i];
          this.step = "align"; this.draw();
        }
        return;
      }
      if (this.step === "align") {
        const a = { 1: "Good", 2: "Neutral", 3: "Evil" }[k];
        if (a) {
          this.align = a;
          this.stats = Object.assign({}, RACES[this.race]);
          this.bonus = 6 + d(4) + (pct(8) ? 10 : 0);
          this.step = "bonus"; this.draw();
        }
        return;
      }
      if (this.step === "bonus") {
        const s = STATS[this.cursor];
        if (e.key === "ArrowUp") this.cursor = (this.cursor + 5) % 6;
        else if (e.key === "ArrowDown") this.cursor = (this.cursor + 1) % 6;
        else if (e.key === "ArrowRight" || k === "+" || k === "=") {
          if (this.bonus > 0 && this.stats[s] < 18) { this.stats[s]++; this.bonus--; }
        } else if (e.key === "ArrowLeft" || k === "-") {
          if (this.stats[s] > RACES[this.race][s]) { this.stats[s]--; this.bonus++; }
        } else if (e.key === "Enter" && this.bonus === 0) {
          if (!eligibleClasses(this.stats, this.align).length) { UI.log("No class will take these stats. Re-allocate."); return; }
          this.step = "class";
        }
        this.draw();
        return;
      }
      if (this.step === "class") {
        const elig = eligibleClasses(this.stats, this.align);
        const i = parseInt(k, 10) - 1;
        if (i >= 0 && i < elig.length) {
          const ch = newChar(this.name, this.race, this.align, this.stats, elig[i]);
          Game.roster.push(ch);
          Events.emit("create", { ch });
          UI.log(`${ch.name} the ${ch.align} ${ch.race} ${ch.cls} is created! (HP ${ch.maxhp})`);
          Game.save();
          Game.go(TrainingScreen);
        }
      }
    },
  };
  return S;
}

// ---------------------------------------------------------------- shop
const ShopScreen = {
  cust: 0, mode: "menu",
  enter() { this.cust = 0; this.mode = "menu"; },
  draw() {
    Render.blank("BOLTAC'S TRADING POST");
    const ch = Game.party[this.cust];
    if (!ch) { UI.panel(`<h2>BOLTAC'S TRADING POST</h2>\n<span class="dim">"No party, no business," grunts Boltac.</span>\n\n${UI.key("L", "Leave")}`); return; }
    const head = `<h2>BOLTAC'S TRADING POST</h2>Customer: <span class="hi">${esc(ch.name)}</span>  <span class="gold">GOLD ${ch.gold}</span>\n`;
    if (this.mode === "menu") {
      UI.panel(`${head}\n${UI.key("B", "Buy")}\n${UI.key("S", "Sell")}\n${UI.key("P", "Pool party gold here")}\n${UI.key("C", "Change customer (1-" + Game.party.length + ")")}\n${UI.key("L", "Leave")}`);
    } else if (this.mode === "buy") {
      const rows = SHOP_STOCK.map((id, i) => {
        const it = ITEMS[id];
        const afford = ch.gold >= it.price;
        const usable = canUseItem(ch, id);
        const label = `${pad(esc(it.name), 22)} ${padl(it.price, 5)} G${usable ? "" : "  #"}`;
        return afford ? UI.key(LETTERS[i], label) : `<span class="dim">${LETTERS[i]}) ${label}</span>`;
      }).join("\n");
      UI.panel(`${head}<span class="dim"># = ${esc(ch.name)} can't use</span>\n${rows}\n\n${UI.key("L", "Back")}`);
    } else if (this.mode === "sell") {
      const rows = ch.items.map((it, i) => {
        const st = IT(it);
        return UI.key(i + 1, `${it.eq ? "*" : " "}${pad(esc(st.name), 26)} ${padl(Math.floor(st.price / 2), 5)} G`);
      }).join("\n") || '<span class="dim">(nothing to sell)</span>';
      UI.panel(`${head}\n${rows}\n\n${UI.key("L", "Back")}`);
    }
  },
  key(k) {
    const ch = Game.party[this.cust];
    if (!ch) { if (k === "l") Game.go(CastleScreen); return; }
    if (this.mode === "menu") {
      if (k === "b") { this.mode = "buy"; this.draw(); }
      else if (k === "s") { this.mode = "sell"; this.draw(); }
      else if (k === "p") {
        for (const o of Game.party) { if (o !== ch) { ch.gold += o.gold; o.gold = 0; } }
        UI.log(`The party pools its gold with ${ch.name}.`);
        UI.renderParty(); this.draw();
      }
      else if (k === "c") { /* handled by number below */ }
      else if (k === "l") Game.go(CastleScreen);
      const n = parseInt(k, 10) - 1;
      if (n >= 0 && n < Game.party.length) { this.cust = n; this.draw(); }
      return;
    }
    if (k === "l") { this.mode = "menu"; this.draw(); return; }
    if (this.mode === "buy") {
      const idx = LETTERS.indexOf(k);
      if (idx >= 0 && idx < SHOP_STOCK.length) {
        const id = SHOP_STOCK[idx];
        const it = ITEMS[id];
        if (ch.gold < it.price) { UI.log('"You can\'t afford that," says Boltac.'); return; }
        spendGold(ch, it.price, "shop");
        const entry = { id, eq: false };
        if (it.slot !== "potion" && canUseItem(ch, id) && !equipped(ch, it.slot)) entry.eq = true;
        ch.items.push(entry);
        Events.emit("buy", { ch, id, price: it.price });
        UI.log(`${ch.name} buys the ${it.name}.${entry.eq ? " (equipped)" : ""}`);
        Game.save();
        UI.renderParty(); this.draw();
      }
    } else if (this.mode === "sell") {
      const i = parseInt(k, 10) - 1;
      if (i >= 0 && i < ch.items.length) {
        const id = ch.items[i].id;
        const st = IT(ch.items[i]);
        grantGold(ch, Math.floor(st.price / 2), "sell");
        UI.log(`Boltac buys the ${st.name} for ${Math.floor(st.price / 2)} gold.`);
        ch.items.splice(i, 1);
        Events.emit("sell", { ch, id });
        UI.renderParty(); this.draw();
      }
    }
  },
};

// ---------------------------------------------------------------- temple
const TempleScreen = {
  sel: null,
  enter() { this.sel = null; },
  candidates() {
    const seen = new Set();
    const out = [];
    for (const ch of [...Game.party, ...Game.roster]) {
      if (!seen.has(ch.id) && ch.status !== "OK") { seen.add(ch.id); out.push(ch); }
    }
    return out;
  },
  cost(ch) {
    // novice mercy: raising the under-level-3 dead is on the house
    if ((ch.status === "DEAD" || ch.status === "ASHES") && ch.level < 3) return 0;
    return { POISONED: 50, PARALYZED: 100, DEAD: 250 * ch.level, ASHES: 500 * ch.level }[ch.status] || 0;
  },
  draw() {
    Render.blank("TEMPLE OF CANT");
    const cands = this.candidates();
    if (this.sel) {
      const c = this.cost(this.sel);
      const ask = c === 0
        ? 'The priests take pity on the inexperienced. <span class="gold">No donation required.</span>'
        : `Donation required: <span class="gold">${c} GOLD</span> (party has ${partyGold()})`;
      UI.panel(`<h2>TEMPLE OF CANT</h2>\n${esc(this.sel.name)} — ${this.sel.status}\n${ask}\n\n${UI.key("Y", "Pray")}  ${UI.key("N", "Never mind")}`);
      return;
    }
    const rows = cands.map((ch, i) => {
      const c = this.cost(ch);
      return UI.key(LETTERS[i], `${pad(esc(ch.name), 14)} ${pad(ch.status, 10)} ${padl(c === 0 ? "FREE" : c + " G", 8)}`);
    }).join("\n") || '<span class="dim">(no one needs the temple\'s help)</span>';
    UI.panel(`<h2>TEMPLE OF CANT</h2>\n"Who needs our aid?"\n\n${rows}\n\n${UI.key("L", "Leave")}`);
  },
  key(k) {
    if (this.sel) {
      if (k === "n") { this.sel = null; this.draw(); return; }
      if (k === "y") {
        const ch = this.sel; this.sel = null;
        const c = this.cost(ch);
        const was = ch.status;
        if (partyGold() < c) { UI.log('"The gods require a proper donation," intones the priest.'); this.draw(); return; }
        spendPartyGold(c, "temple");
        if (ch.status === "POISONED" || ch.status === "PARALYZED") {
          ch.status = "OK";
          UI.log(`${ch.name} is cured!`);
          Events.emit("temple", { ch, service: was, ok: true });
        } else if (ch.status === "DEAD") {
          const ok = pct(50 + ch.stats.VIT * 3);
          Events.emit("temple", { ch, service: was, ok });
          if (ok) { ch.status = "OK"; ch.hp = 1; UI.log(`${ch.name} rises! DI has granted life!`); Events.emit("resurrect", { ch, from: was }); }
          else { ch.status = "ASHES"; UI.log(`The ritual fails... ${ch.name} crumbles to ASHES!`); }
        } else if (ch.status === "ASHES") {
          const ok = pct(40 + ch.stats.VIT * 3);
          Events.emit("temple", { ch, service: was, ok });
          if (ok) { ch.status = "OK"; ch.hp = 1; UI.log(`KADORTO! ${ch.name} is restored to life!`); Events.emit("resurrect", { ch, from: was }); }
          else {
            UI.log(`${ch.name} is LOST forever...`);
            Events.emit("lost", { ch });
            Game.roster = Game.roster.filter(o => o !== ch);
            const pi = Game.party.indexOf(ch);
            if (pi >= 0) Game.party.splice(pi, 1);
          }
        }
        Game.save();
        UI.renderParty(); this.draw();
        return;
      }
      return;
    }
    if (k === "l") { Game.go(CastleScreen); return; }
    const idx = LETTERS.indexOf(k);
    const cands = this.candidates();
    if (idx >= 0 && idx < cands.length) { this.sel = cands[idx]; this.draw(); }
  },
};

// ---------------------------------------------------------------- inn
const InnScreen = {
  draw() {
    Render.blank("ADVENTURER'S INN");
    const n = Game.party.filter(isUp).length;
    UI.panel(`<h2>ADVENTURER'S INN</h2>\n<span class="dim">Party gold: ${partyGold()}</span>\n\n${UI.key("S", "The Stables (free — restores spells)")}\n${UI.key("C", `Cots (${10 * n} gold — full rest)`)}\n${UI.key("R", `Royal Suite (${100 * n} gold — full rest)`)}\n${UI.key("L", "Leave")}`);
  },
  rest(full, cost) {
    if (partyGold() < cost) { UI.log('"No gold, no bed," says the innkeeper.'); return; }
    spendPartyGold(cost, "inn");
    Events.emit("rest", { full, cost });
    const msgs = [];
    for (const ch of Game.party) {
      if (!isUp(ch)) continue;
      restoreSP(ch);
      if (full) ch.hp = ch.maxhp;
      msgs.push(...checkLevelUp(ch));
    }
    UI.log(full ? "The party rests well." : "The party naps in the hay. Spells return.");
    for (const m of msgs) UI.log(m);
    Game.save();
    UI.renderParty();
    this.draw();
  },
  key(k) {
    const n = Game.party.filter(isUp).length;
    if (!n && k !== "l") { UI.log("No one is fit to rest."); return; }
    if (k === "s") this.rest(false, 0);
    else if (k === "c") this.rest(true, 10 * n);
    else if (k === "r") this.rest(true, 100 * n);
    else if (k === "l") Game.go(CastleScreen);
  },
};
