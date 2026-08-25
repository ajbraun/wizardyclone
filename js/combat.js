"use strict";
// the System's bestiary card: stats, traits, kill count, and editorial
function monsterCard(def) {
  const traits = [];
  if (def.elite) traits.push(`NAMED — ${def.affix.trait}`);
  if (def.undead) traits.push("technically deceased (immune to sleep)");
  else if ((def.sleepResist || 0) >= 90) traits.push("does not sleep");
  if (def.poison) traits.push("venomous");
  if (def.paralyze) traits.push("paralytic touch");
  if (def.breath) traits.push("breathes fire (worse at full health)");
  if (def.mage) traits.push(`casts mage spells (rank ${def.mage})`);
  if (def.priest) traits.push(`casts priest spells (rank ${def.priest})`);
  const kills = Game.counters["kill:" + def.id] || 0;
  const alive = Game.party.filter(isUp);
  const avg = alive.length ? alive.reduce((a, c) => a + c.level, 0) / alive.length : 1;
  const diff = def.lvl - avg;
  const assess = diff <= -5 ? "Beneath you. The XP will reflect that."
    : diff <= -2 ? "A warm-up. Try not to make it weird."
    : diff <= 1 ? "A fair fight. Someone here is about to be surprised."
    : diff <= 4 ? "Punching up. Premium XP, premium funeral risk."
    : "This will end poorly for someone. Statistically, you.";
  return `<span class="hi">${esc(def.name.toUpperCase())}</span>  <span class="dim">[Level ${def.lvl}]</span>\n` +
    `<span class="dim">"${esc(def.lore || "The System has no notes. It is as surprised as you are.")}"</span>\n\n` +
    `AC ${def.ac}   HITS ${def.hp}   ATTACKS ${def.dmg.join(" / ")}\n` +
    `TRAITS: ${traits.length ? esc(traits.join(", ")) : "none worth respecting"}\n` +
    `XP VALUE ${def.xp} each   <span class="dim">SLAIN BY YOU: ${kills}</span>\n\n` +
    `<span class="k">[SYSTEM ASSESSMENT]</span> ${esc(assess)}`;
}

// ---------------------------------------------------------------- named elites
// A rare promoted monster: its own name, one affix, real hp, and a guaranteed
// chest. The System introduces it like a fight announcer, because it is one.
const ELITE_AFFIXES = [
  { key: "REGENERATING", trait: "regenerates every round", lore: "It heals faster than your accusations can land." },
  { key: "ARMORED", trait: "absurdly armored", lore: "Somewhere, a castle is missing a wall." },
  { key: "FRENZIED", trait: "attacks in a frenzy", lore: "It bills by the swing, and it is highly motivated." },
  { key: "VENOMOUS", trait: "venomous", lore: "The bite is free. The antivenin is not." },
  { key: "GILDED", trait: "worth triple gold", lore: "It swallowed its hoard for safekeeping. Safekeeping has ended." },
];
const ELITE_SYL1 = ["Gruz", "Mor", "Thak", "Vel", "Skar", "Bram", "Naz", "Kro", "Zab", "Dren"];
const ELITE_SYL2 = ["zik", "gath", "maw", "rek", "dun", "gore", "lok", "nash", "vex", "tul"];
const ELITE_EPITHETS = ["the Damp", "the Unpaid", "the Twice-Banished", "the Recently Promoted", "the Peckish", "the Overdue", "the Unlicensed", "the Load-Bearing", "the Semi-Retired", "the Adequate"];

const Combat = {
  groups: [], phase: "input", sub: "action", inputIdx: 0, actions: [],
  msgs: [], round: 0, xpTotal: 0, opts: {}, pendingSpell: null,
  chest: null, worker: 0, intentRound: -1,

  // ------------------------------------------------------------ setup
  start(opts) {
    this.opts = opts || {};
    const map = getLevel(Game.maze.level);
    this.groups = [];
    if (this.opts.boss) {
      this.addGroup("APPRENTICE", 1);
      this.addGroup("MAGE5", d(2));
    } else if (this.opts.warden) {
      const wd = MONSTERS["WARDEN" + this.opts.warden];
      const whp = dice(wd.hp);
      this.groups.push({ def: wd, silenced: false, acMod: 0, elite: true, members: [{ hp: whp, maxhp: whp, asleep: false, para: false }] });
      this.addGroup(pickWeighted(map.table)); // the retinue
    } else if (this.opts.vault) {
      this.addGroup(pickWeighted(map.table));
      this.addElite(map);
    } else {
      this.addGroup(pickWeighted(map.table));
      const extra = this.opts.lair ? 100 : [0, 25, 40, 55][map.depth];
      if (pct(extra)) this.addGroup(pickWeighted(map.table));
      if (map.depth >= 3 && pct(20)) this.addGroup(pickWeighted(map.table));
      const eliteChance = ((this.opts.lair ? 20 : 6) + map.depth) * (map.mod && map.mod.eliteMult || 1);
      if (pct(eliteChance)) this.addElite(map);
    }
    for (const ch of Game.party) { ch.tempAC = 0; ch.asleep = false; ch.parry = false; }
    this.round = 0; this.xpTotal = 0; this.msgs = []; this.intentRound = -1;
    const names = this.groups.map(g => this.groupLabel(g)).join(" and ");
    UI.log(`You encounter ${names}!`);
    for (const g of this.groups) if (g.elite) {
      UI.log(`[SYSTEM] A NAMED monster: ${g.def.name.toUpperCase()} — a ${g.def.base}, but ${g.def.affix.trait}. Try to feel honored.`);
    }
    Events.emit("encounter", { groups: this.groups.map(g => g.def), boss: !!this.opts.boss, lair: !!this.opts.lair, level: Game.maze.level });
    this.surprised = false; this.surprising = false;
    if (!this.opts.boss && !this.opts.vault && !this.opts.warden) {
      const r = rnd(100);
      if (r < 15) { this.surprising = true; UI.log("You surprise them!"); }
      else if (r < 25) { this.surprised = true; UI.log("You are surprised!"); }
    }
    Game.go(CombatScreen);
    if (this.surprised) { this.actions = []; this.resolveRound(); }
    else this.beginInput();
  },
  addGroup(id, count) {
    const def = MONSTERS[id];
    const n = count || dice(def.num);
    this.groups.push({
      def, silenced: false, acMod: 0,
      members: Array.from({ length: n }, () => ({ hp: dice(def.hp), asleep: false, para: false })),
    });
  },
  addElite(map) {
    const base = MONSTERS[pickWeighted(map.table)];
    const affix = pick(ELITE_AFFIXES);
    const name = `${pick(ELITE_SYL1)}${pick(ELITE_SYL2)} ${pick(ELITE_EPITHETS)}`;
    const def = Object.assign({}, base, {
      name, pl: name, elite: true, affix, base: base.name,
      lvl: base.lvl + 2,
      ac: base.ac - (affix.key === "ARMORED" ? 3 : 0),
      dmg: affix.key === "FRENZIED" ? base.dmg.concat([base.dmg[0]]) : base.dmg,
      poison: base.poison || affix.key === "VENOMOUS",
      xp: base.xp * 4,
      lore: affix.lore,
    });
    const hp = dice(base.hp) + dice(base.hp) + def.lvl * 2;
    this.groups.unshift({ def, silenced: false, acMod: 0, elite: true, members: [{ hp, maxhp: hp, asleep: false, para: false }] });
  },
  aliveIn(g) { return g.members.filter(m => m.hp > 0); },
  aliveGroups() { return this.groups.filter(g => this.aliveIn(g).length > 0); },
  groupLabel(g) {
    const n = this.aliveIn(g).length;
    return `${n} ${n === 1 ? g.def.name : g.def.pl}`;
  },

  // ------------------------------------------------------------ input phase
  beginInput() {
    this.phase = "input"; this.sub = "action"; this.actions = []; this.inputIdx = 0;
    for (const ch of Game.party) ch.parry = false;
    // roll once per round, not on "take back"
    if (this.intentRound !== this.round) { this.rollIntents(); this.intentRound = this.round; }
    this.skipToNextActor();
    this.draw();
  },
  // Telegraphs: one special action per group per round, announced before input.
  // The payoff for focus fire — kill or silence the group and it never lands.
  rollIntents() {
    for (const g of this.groups) {
      g.intent = null; g.intentDone = false;
      if (!this.aliveIn(g).length) continue;
      const def = g.def;
      if (def.breath && pct(45)) {
        g.intent = { kind: "breath", label: "INHALING", warn: `The ${def.name} inhales deeply.` };
      } else if ((def.mage || def.priest) && !g.silenced && pct(55)) {
        if (def.mage >= 3 && pct(60)) g.intent = { kind: "mahalito", label: "WEAVING FIRE", warn: `A ${def.name} begins weaving fire between its hands.` };
        else if (def.mage && pct(50)) g.intent = { kind: "katino", label: "CHANTING", warn: `A ${def.name} chants something soothing. Suspiciously soothing.` };
        else g.intent = { kind: "bolt", label: "CHANNELING", warn: `A ${def.name} gathers crackling energy.` };
      }
    }
  },
  currentChar() { return Game.party[this.inputIdx]; },
  skipToNextActor() {
    while (this.inputIdx < Game.party.length) {
      const ch = Game.party[this.inputIdx];
      if (isUp(ch) && !ch.asleep) break;
      this.inputIdx++;
    }
    if (this.inputIdx >= Game.party.length) this.resolveRound();
  },
  meleeGroups() { return this.aliveGroups().slice(0, 2); },
  combatSpells(ch) {
    return knownSpells(ch).filter(s => SPELLS[s].where === "combat" || SPELLS[s].where === "any");
  },
  potions(ch) { return ch.items.map((it, i) => ({ it, i })).filter(o => ITEMS[o.it.id].slot === "potion"); },

  draw() {
    const m = Game.maze;
    Render.draw(getLevel(m.level), m.x, m.y, m.f, 3);
    UI.viewLabel("*** COMBAT ***");
    if (this.phase !== "chest") {
      const fg = (this.sub === "card" && this.inspectG) ? this.inspectG : this.aliveGroups()[0];
      if (fg) Render.monsterBox(fg.def, this.aliveIn(fg).length);
    }
    if (this.phase === "msg") {
      UI.panel(`<h2>COMBAT — ROUND ${this.round}</h2>\n${this.msgs.map(esc).join("\n")}\n\n<span class="k">[ SPACE ]</span>`);
      return;
    }
    if (this.phase === "chest") { this.drawChest(); return; }
    const enemies = this.groups.map((g, i) => {
      const n = this.aliveIn(g).length;
      const status = n === 0 ? ' <span class="dim">(slain)</span>' : g.members.some(mm => mm.hp > 0 && (mm.asleep || mm.para)) ? ' <span class="k">(incapacitated)</span>' : "";
      const label = g.elite ? `<span class="gold">${this.groupLabel(g)}</span>` : this.groupLabel(g);
      const intent = n > 0 && g.intent && !g.intentDone ? ` <span class="bad">[${g.intent.label}]</span>` : "";
      const reach = n > 0 && !this.meleeGroups().includes(g) ? ' <span class="dim">(out of melee reach)</span>' : "";
      return `  ${i + 1}) ${n === 0 ? '<span class="dim">' : ""}${label}${n === 0 ? "</span>" : ""}${status}${reach}${intent}`;
    }).join("\n");
    const warns = this.phase === "input" ? this.groups
      .filter(g => this.aliveIn(g).length && g.intent && !g.intentDone)
      .map(g => `<span class="bad">! ${esc(g.intent.warn)}</span>`).join("\n") : "";
    const ch = this.currentChar();
    let prompt = "";
    if (this.sub === "action") {
      const canMelee = this.inputIdx < 3;
      prompt = `<span class="hi">${esc(ch.name)}</span>'s options:\n` +
        (canMelee ? `${UI.key("F", "Fight")}  ` : `<span class="dim">F) Fight (back row)</span>  `) +
        `${UI.key("P", "Parry")}  ${UI.key("S", "Spell")}  ${UI.key("U", "Use potion")}  ${UI.key("I", "Inspect foe")}  ${UI.key("R", "Run")}  ${UI.key("T", "Take back")}`;
    } else if (this.sub === "inspectGroup") {
      prompt = `Inspect which group? <span class="k">(1-${this.groups.length})</span>  ${UI.key("L", "Back")}`;
    } else if (this.sub === "card") {
      UI.panel(monsterCard(this.inspectG.def) + `\n\n${UI.key("L", "Back")}`);
      return;
    } else if (this.sub === "fightGroup") {
      const nums = this.meleeGroups().map(g => this.groups.indexOf(g) + 1);
      prompt = `<span class="hi">${esc(ch.name)}</span> fights which group? <span class="k">(${nums.join(", ")} in melee reach)</span>`;
    } else if (this.sub === "spell") {
      const list = this.combatSpells(ch);
      prompt = `<span class="hi">${esc(ch.name)}</span> casts...\n` + (list.map((s, i) => {
        const def = SPELLS[s];
        const can = ch.sp[def.book][def.sl - 1] > 0;
        const lab = `${pad(s, 10)} <span class="dim">${esc(def.desc)}</span>`;
        return can ? UI.key(LETTERS[i], lab) : `<span class="dim">${LETTERS[i]}) ${lab}</span>`;
      }).join("\n") || '<span class="dim">(no combat spells)</span>') + `\n${UI.key("L", "Back")}`;
    } else if (this.sub === "spellGroup") {
      prompt = `${this.pendingSpell} at which group? <span class="k">(1-${this.groups.length})</span>`;
    } else if (this.sub === "spellAlly" || this.sub === "potionAlly") {
      prompt = `On which member? <span class="k">(1-${Game.party.length})</span>`;
    } else if (this.sub === "potion") {
      const pots = this.potions(ch);
      prompt = `Drink which?\n` + (pots.map((o, i) => UI.key(LETTERS[i], ITEMS[o.it.id].name)).join("\n") || '<span class="dim">(no potions)</span>') + `\n${UI.key("L", "Back")}`;
    }
    UI.panel(`<h2>COMBAT — ROUND ${this.round + 1}</h2>${enemies}${warns ? "\n" + warns : ""}\n\n${prompt}`);
  },

  key(k, e) {
    if (this.phase === "msg") {
      if (k === " " || e.key === "Enter" || e.key === " ") this.afterMsgs();
      return;
    }
    if (this.phase === "chest") { this.chestKey(k, e); return; }
    const ch = this.currentChar();
    if (this.sub === "action") {
      if (k === "f" && this.inputIdx < 3) {
        const mg = this.meleeGroups();
        if (mg.length > 1) { this.sub = "fightGroup"; this.draw(); }
        else { this.actions.push({ ch, type: "fight", group: mg[0] }); this.advance(); }
      } else if (k === "p") { ch.parry = true; this.actions.push({ ch, type: "parry" }); this.advance(); }
      else if (k === "s") { this.sub = "spell"; this.draw(); }
      else if (k === "u") { this.sub = "potion"; this.draw(); }
      else if (k === "i") {
        const ag = this.aliveGroups();
        if (ag.length === 1) { this.inspectG = ag[0]; this.sub = "card"; Events.emit("inspectMonster", { id: ag[0].def.id }); }
        else this.sub = "inspectGroup";
        this.draw();
      }
      else if (k === "r") { this.actions.push({ ch, type: "run" }); this.resolveRound(); }
      else if (k === "t") this.beginInput();
      return;
    }
    if (this.sub === "inspectGroup") {
      if (k === "l") { this.sub = "action"; this.draw(); return; }
      const i = parseInt(k, 10) - 1;
      if (i >= 0 && i < this.groups.length) {
        this.inspectG = this.groups[i];
        this.sub = "card";
        Events.emit("inspectMonster", { id: this.inspectG.def.id });
        this.draw();
      }
      return;
    }
    if (this.sub === "card") {
      this.sub = "action";
      this.draw();
      return;
    }
    if (this.sub === "fightGroup") {
      // numbers match the enemy list; only the first two living groups are in reach
      const i = parseInt(k, 10) - 1;
      const g = this.groups[i];
      if (!g) return;
      const mg = this.meleeGroups();
      if (mg.includes(g)) { this.actions.push({ ch, type: "fight", group: g }); this.advance(); }
      else if (!this.aliveIn(g).length) { this.actions.push({ ch, type: "fight", group: mg[0] }); this.advance(); }
      return;
    }
    if (this.sub === "spell") {
      if (k === "l") { this.sub = "action"; this.draw(); return; }
      const list = this.combatSpells(ch);
      const idx = LETTERS.indexOf(k);
      if (idx >= 0 && idx < list.length) {
        const name = list[idx];
        const def = SPELLS[name];
        if (ch.sp[def.book][def.sl - 1] <= 0) return;
        this.pendingSpell = name;
        if (def.target === "group" || def.target === "foe") {
          if (this.aliveGroups().length > 1) { this.sub = "spellGroup"; this.draw(); }
          else { this.actions.push({ ch, type: "spell", spell: name, group: this.aliveGroups()[0] }); this.advance(); }
        } else if (def.target === "ally") { this.sub = "spellAlly"; this.draw(); }
        else { this.actions.push({ ch, type: "spell", spell: name }); this.advance(); }
      }
      return;
    }
    if (this.sub === "spellGroup") {
      const i = parseInt(k, 10) - 1;
      // a dead group is accepted — castCombatSpell retargets to a live one
      if (i >= 0 && i < this.groups.length) {
        this.actions.push({ ch, type: "spell", spell: this.pendingSpell, group: this.groups[i] });
        this.advance();
      }
      return;
    }
    if (this.sub === "spellAlly") {
      const i = parseInt(k, 10) - 1;
      if (i >= 0 && i < Game.party.length) {
        this.actions.push({ ch, type: "spell", spell: this.pendingSpell, ally: Game.party[i] });
        this.advance();
      }
      return;
    }
    if (this.sub === "potion") {
      if (k === "l") { this.sub = "action"; this.draw(); return; }
      const pots = this.potions(ch);
      const idx = LETTERS.indexOf(k);
      if (idx >= 0 && idx < pots.length) {
        this.pendingSpell = pots[idx].it.id;
        this.sub = "potionAlly"; this.draw();
      }
      return;
    }
    if (this.sub === "potionAlly") {
      const i = parseInt(k, 10) - 1;
      if (i >= 0 && i < Game.party.length) {
        this.actions.push({ ch, type: "potion", itemId: this.pendingSpell, ally: Game.party[i] });
        this.advance();
      }
    }
  },
  advance() { this.sub = "action"; this.inputIdx++; this.skipToNextActor(); if (this.phase === "input") this.draw(); },

  // ------------------------------------------------------------ resolution
  say(m) { this.msgs.push(m); },
  resolveRound() {
    this.phase = "resolving";
    this.round++;
    this.msgs = [];
    const actors = [];
    for (const a of this.actions) {
      actors.push({ side: "p", init: d(8) + Math.floor(a.ch.stats.AGI / 3) + (this.surprising ? 20 : 0), a });
    }
    if (!this.surprising) {
      this.groups.forEach(g => {
        g.members.forEach(mm => {
          if (mm.hp > 0) actors.push({ side: "m", init: d(8) + g.def.lvl, g, mm });
        });
      });
    }
    actors.sort((x, y) => y.init - x.init);
    let fled = false;
    for (const act of actors) {
      if (this.aliveGroups().length === 0) break;
      if (!Game.party.some(isUp)) break;
      if (act.side === "p") {
        if (!isUp(act.a.ch) || act.a.ch.asleep) continue;
        if (act.a.type === "run") {
          const ok = pct(55 + statMod(act.a.ch.stats.AGI) * 10 + mod(act.a.ch, "runChance"));
          Events.emit("flee", { ch: act.a.ch, ok });
          if (ok) { fled = true; this.say("You flee the battle!"); break; }
          else this.say("You cannot escape!");
        } else this.partyAct(act.a);
      } else {
        if (act.mm.hp <= 0 || act.mm.asleep || act.mm.para) continue;
        this.monsterAct(act.g, act.mm);
      }
    }
    this.surprising = false; this.surprised = false;
    // telegraphed attacks that never happened — the payoff for focus fire
    if (!fled && Game.party.some(isUp)) {
      for (const g of this.groups) {
        if (!g.intent || g.intentDone) continue;
        const alive = this.aliveIn(g);
        if (!alive.length) {
          this.say(`The ${g.def.name} dies with its ${g.intent.kind === "breath" ? "breath still gathered" : "spell unfinished"}.`);
          Events.emit("interrupt", { monster: g.def, how: "killed" });
        } else if (alive.every(mm => mm.asleep || mm.para)) {
          this.say(`The ${g.def.name} sleeps through its own ${g.intent.kind === "breath" ? "inhale" : "incantation"}.`);
          Events.emit("interrupt", { monster: g.def, how: "incapacitated" });
        }
      }
    }
    for (const g of this.groups) { g.intent = null; g.intentDone = false; }
    // named regenerators knit themselves back together
    for (const g of this.groups) {
      if (!g.elite || g.def.affix.key !== "REGENERATING") continue;
      let healed = 0;
      for (const mm of g.members) {
        if (mm.hp > 0 && mm.hp < mm.maxhp) { const amt = Math.min(g.def.lvl, mm.maxhp - mm.hp); mm.hp += amt; healed += amt; }
      }
      if (healed) this.say(`${g.def.name} knits itself back together. (+${healed})`);
    }
    // wake-up rolls
    for (const g of this.groups) for (const mm of g.members) {
      if (mm.hp > 0 && mm.asleep && pct(40)) { mm.asleep = false; }
    }
    for (const ch of Game.party) if (ch.asleep && pct(50)) { ch.asleep = false; this.say(`${ch.name} wakes up.`); }
    UI.renderParty();
    if (fled) { this.msgs.push("", "You escape without reward."); this.endTo = "maze"; }
    else if (!Game.party.some(isUp)) { this.endTo = "wipe"; }
    else if (this.aliveGroups().length === 0) { this.endTo = "victory"; }
    else this.endTo = "next";
    this.phase = "msg";
    if (!this.msgs.length) this.msgs.push("(a tense standoff...)");
    this.draw();
  },
  afterMsgs() {
    if (this.endTo === "next") { this.beginInput(); return; }
    if (this.endTo === "wipe") { partyWipe(); return; }
    if (this.endTo === "maze") { this.finish(); return; }
    if (this.endTo === "victory") { this.victory(); return; }
    if (this.endTo === "chestDone") { this.finish(); return; }
  },
  finish() {
    for (const ch of Game.party) { ch.tempAC = 0; ch.asleep = false; ch.parry = false; }
    Game.save();
    Game.go(MazeScreen);
  },

  partyAct(a) {
    const ch = a.ch;
    if (a.type === "parry") return;
    if (a.type === "potion") {
      const idx = ch.items.findIndex(it => it.id === a.itemId);
      if (idx >= 0) { this.say(`${ch.name} drinks a ${ITEMS[a.itemId].name}.`); this.potionEffect(ch, a.ally, idx); }
      return;
    }
    if (a.type === "spell") { this.castCombatSpell(ch, a.spell, a); return; }
    // fight
    let g = a.group;
    if (this.aliveIn(g).length === 0) g = this.meleeGroups()[0];
    if (!g) return;
    const swings = numAttacks(ch);
    const ctx = { vs: g.def };
    let kills = 0, dmgTotal = 0, hits = 0, crits = 0;
    for (let s = 0; s < swings; s++) {
      const targets = this.aliveIn(g);
      if (!targets.length) break;
      const mm = pick(targets);
      const effAC = g.def.ac + g.acMod;
      const asleep = mm.asleep || mm.para;
      const delta = atkBonus(ch, ctx) + effAC - 9 + (asleep ? 8 : 0);
      const landed = chance(hitChance(delta));
      let dmg = 0, slain = false, crit = false;
      if (landed) {
        dmg = Math.max(1, dice(weaponDmg(ch)) + statMod(ch.stats.STR) + Math.floor(mod(ch, "dmg", ctx)));
        if (asleep) dmg *= 2;
        if (chance(critChance(ch, ctx) / 100)) { crit = true; crits++; dmg *= 2; }
        if (ch.cls === "Ninja" && pct(2 * ch.level)) { dmg = mm.hp; this.say(`${ch.name} decapitates one!`); }
        mm.hp -= dmg; hits++; dmgTotal += dmg;
        if (mm.asleep && pct(50)) mm.asleep = false;
        if (mm.hp <= 0) {
          mm.hp = 0; kills++; slain = true;
          this.xpTotal += g.def.xp;
          Events.emit("kill", { by: ch, monster: g.def, sleeping: asleep, how: "melee", crit });
        }
      }
      Events.emit("swing", { ch, monster: g.def, hit: landed, dmg, kill: slain, sleeping: asleep, crit });
    }
    if (!hits) this.say(`${ch.name} swings at a ${g.def.name} and misses.`);
    else this.say(`${ch.name} hits a ${g.def.name} for ${dmgTotal}${crits ? " *CRIT*" : ""}${kills ? ` — ${kills} slain!` : "."}`);
  },
  potionEffect(user, target, idx) {
    const id = user.items[idx].id;
    const def = ITEMS[id];
    if (def.use === "heal") {
      const amt = applyHeal(target, dice(def.dice), { type: "potion" });
      this.say(`${target.name} is healed ${amt} points.`);
    } else if (def.use === "curepoison" && target.status === "POISONED") {
      target.status = "OK"; this.say(`${target.name} is cured of poison.`);
    }
    user.items.splice(idx, 1);
    Events.emit("potion", { ch: user, target, id });
  },
  castCombatSpell(ch, name, a) {
    const def = SPELLS[name];
    if (ch.sp[def.book][def.sl - 1] <= 0) return;
    ch.sp[def.book][def.sl - 1]--;
    this.say(`${ch.name} casts ${name}!`);
    Events.emit("spell", { ch, name, combat: true });
    let g = a.group;
    if (g && this.aliveIn(g).length === 0) g = this.aliveGroups()[0];
    if (def.kind === "damage") {
      if (!g) return;
      if (def.target === "foe") {
        const mm = pick(this.aliveIn(g));
        const dmg = dice(def.dice) + Math.floor(mod(ch, "spellPower"));
        mm.hp -= dmg;
        this.say(`A ${g.def.name} takes ${dmg}${mm.hp <= 0 ? " and dies!" : "."}`);
        if (mm.hp <= 0) {
          mm.hp = 0; this.xpTotal += g.def.xp;
          Events.emit("kill", { by: ch, monster: g.def, how: "spell", spell: name });
        }
      } else {
        let kills = 0, total = 0;
        const sp = Math.floor(mod(ch, "spellPower"));
        for (const mm of this.aliveIn(g)) {
          const dmg = dice(def.dice) + sp;
          mm.hp -= dmg; total += dmg;
          if (mm.hp <= 0) {
            mm.hp = 0; kills++; this.xpTotal += g.def.xp;
            Events.emit("kill", { by: ch, monster: g.def, how: "spell", spell: name });
          }
        }
        this.say(`The ${g.def.pl} are engulfed! (${total} dmg${kills ? `, ${kills} slain` : ""})`);
      }
    } else if (def.kind === "sleep" || def.kind === "paralyze") {
      if (!g) return;
      let got = 0;
      for (const mm of this.aliveIn(g)) {
        const chance = clamp(75 - (g.def.sleepResist || (g.def.undead ? 100 : 0)) - g.def.lvl * 5, 0, 90);
        if (pct(chance)) { if (def.kind === "sleep") mm.asleep = true; else mm.para = true; got++; }
      }
      this.say(got ? `${got} of the ${g.def.pl} ${def.kind === "sleep" ? "fall asleep!" : "freeze in place!"}` : "The spell has no effect!");
    } else if (def.kind === "silence") {
      if (!g) return;
      if (pct(70)) { g.silenced = true; this.say(`The ${g.def.pl} are silenced!`); }
      else this.say("The spell fizzles.");
    } else if (def.kind === "acfoe") {
      if (!g) return;
      g.acMod += def.amt;
      this.say(`The ${g.def.pl} are easier to hit!`);
    } else if (def.kind === "acself") {
      ch.tempAC = (ch.tempAC || 0) + def.amt;
      this.say(`${ch.name} shimmers with protection.`);
    } else if (def.kind === "acparty") {
      for (const p of Game.party) p.tempAC = (p.tempAC || 0) + def.amt;
      this.say("The party is shielded!");
    } else if (def.kind === "heal") {
      const t = a.ally || ch;
      const amt = applyHeal(t, dice(def.dice) + Math.floor(mod(ch, "healPower")), { type: "spell", name });
      this.say(`${t.name} is healed ${amt} points.`);
    } else if (def.kind === "light") {
      Game.maze.light = (Game.maze.light || 0) + def.amt;
      this.say("Light floods the corridor.");
    } else if (def.kind === "cureparalyze" || def.kind === "curepoison") {
      const t = a.ally || ch;
      const want = def.kind === "curepoison" ? "POISONED" : "PARALYZED";
      if (t.status === want) { t.status = "OK"; this.say(`${t.name} recovers!`); }
      else this.say("Nothing happens.");
    } else if (def.kind === "locate") {
      const m = Game.maze;
      this.say(`You are at (${m.x} E, ${m.y} S) on level ${m.level}.`);
    }
  },

  monsterAct(g, mm) {
    const def = g.def;
    const front = Game.party.slice(0, 3).filter(isUp);
    const anyUp = Game.party.filter(isUp);
    if (!anyUp.length) return;
    const targetPool = front.length ? front : anyUp;
    // telegraphed intent: the first able member of the group carries it out
    if (g.intent && !g.intentDone) {
      const intent = g.intent;
      g.intentDone = true;
      if (intent.kind !== "breath" && g.silenced) {
        this.say(`The ${def.name}'s spell dies unspoken. Silence is golden.`);
        Events.emit("interrupt", { monster: def, how: "silence" });
        return;
      }
      if (intent.kind === "breath") {
        this.say(`The ${def.name} breathes fire!`);
        for (const ch of anyUp) {
          let dmg = Math.max(1, Math.ceil(mm.hp / 2));
          if (pct(30 + ch.stats.AGI + Math.floor(mod(ch, "resist")))) dmg = Math.floor(dmg / 2);
          this.hurt(ch, dmg, `is burned for ${dmg}`, { type: "breath", monster: def });
        }
      } else if (intent.kind === "mahalito") {
        this.say(`A ${def.name} casts MAHALITO!`);
        for (const ch of anyUp) {
          let dmg = dice("4d6");
          if (pct(30 + ch.stats.AGI + Math.floor(mod(ch, "resist")))) dmg = Math.floor(dmg / 2);
          this.hurt(ch, dmg, `is scorched for ${dmg}`, { type: "monsterSpell", monster: def });
        }
      } else if (intent.kind === "katino") {
        this.say(`A ${def.name} casts KATINO!`);
        for (const ch of front) if (!ch.asleep && pct(45)) { ch.asleep = true; this.say(`${ch.name} falls asleep!`); }
      } else if (intent.kind === "bolt") {
        const t = pick(targetPool);
        const isPriest = !!def.priest;
        let dmg = dice(isPriest ? (def.priest >= 2 ? "2d8" : "1d8") : "1d8");
        if (pct(Math.floor(mod(t, "resist")))) dmg = Math.floor(dmg / 2);
        this.say(`A ${def.name} casts ${isPriest ? (def.priest >= 2 ? "BADIAL" : "BADIOS") : "HALITO"}!`);
        this.hurt(t, dmg, `takes ${dmg}`, { type: "monsterSpell", monster: def });
      }
      return;
    }
    // melee
    const ch = pick(targetPool);
    const helpless = ch.asleep || ch.status === "PARALYZED";
    let total = 0, hits = 0;
    for (const dd of def.dmg) {
      const effAC = acOf(ch) - (ch.parry ? 2 : 0) + (helpless ? 8 : 0);
      if (chance(hitChance(def.lvl + effAC - 9))) { hits++; total += dice(dd) + (floorMod().mdmg || 0); }
    }
    if (!hits) {
      this.say(`A ${def.name} lunges at ${ch.name} and misses.`);
      Events.emit("dodge", { ch, monster: def });
      return;
    }
    this.hurt(ch, total, `is hit for ${total}`, { type: "melee", monster: def });
    if (ch.hp > 0) {
      if (def.poison && pct(30) && ch.status === "OK") { ch.status = "POISONED"; this.say(`${ch.name} is poisoned!`); }
      if (def.paralyze && pct(30) && (ch.status === "OK" || ch.status === "POISONED")) { ch.status = "PARALYZED"; this.say(`${ch.name} is paralyzed!`); }
      if (ch.asleep && pct(60)) ch.asleep = false;
    }
  },
  hurt(ch, dmg, verb, src) {
    const died = applyDamage(ch, dmg, src || { type: "combat" });
    if (died) this.say(`${ch.name} ${verb}... and DIES!`);
    else this.say(`${ch.name} ${verb}.`);
  },

  // ------------------------------------------------------------ victory & chests
  goldMult() { return this.groups.some(g => g.elite && g.def.affix.key === "GILDED") ? 3 : 1; },
  hadElite() { return this.groups.some(g => g.elite); },
  victory() {
    const alive = Game.party.filter(isUp);
    const fm = floorMod();
    const share = Math.floor(this.xpTotal * (fm.xpMult || 1) * streakMult() / Math.max(1, alive.length));
    const encLvl = Math.max(...this.groups.map(g => g.def.lvl));
    const map = getLevel(Game.maze.level);
    const gold = Math.floor(dice("2d10") * map.depth * 5 * this.goldMult() * (fm.goldMult || 1) * streakMult());
    const gshare = Math.floor(gold / Math.max(1, alive.length));
    let anyScaled = false;
    for (const ch of alive) {
      const mult = relXpMult(ch.level, encLvl);
      if (mult < 0.999) anyScaled = true;
      ch.xp += Math.floor(share * mult * (100 + mod(ch, "xpGain")) / 100);
      grantGold(ch, Math.floor(gshare * (100 + mod(ch, "goldGain")) / 100), "combat");
    }
    Events.emit("victory", { xp: this.xpTotal, gold, boss: !!this.opts.boss, lair: !!this.opts.lair, rounds: this.round, level: Game.maze.level, encLvl });
    this.msgs = [`VICTORY!`, `Spoils: ${share} XP each${anyScaled ? " (reduced — these were beneath you)" : ""} and ${gshare} gold.`];
    for (const g of this.groups) if (g.elite) this.msgs.push(`[SYSTEM] ${g.def.name} has been removed from the payroll.`);
    if (this.opts.warden && !Game.flags["warden" + this.opts.warden]) {
      Game.flags["warden" + this.opts.warden] = true;
      Events.emit("warden", { level: this.opts.warden });
      const nb = bandOf(this.opts.warden + 1);
      this.msgs.push("", "The Warden falls. The seal below shatters.",
        `[SYSTEM] ${nb.name.toUpperCase()} is now open. Elevator service extended. Condolences also extended.`);
      openLootBox("GOLD", this.opts.warden);
    }
    if (this.opts.vaultKey && !Game.flags[this.opts.vaultKey]) {
      Game.flags[this.opts.vaultKey] = true;
      Events.emit("vault", { level: Game.maze.level });
      this.msgs.push("", "The vault stands open. The guardian's severance is yours.");
    }
    if (this.opts.boss) {
      Game.flags.boss = true;
      this.msgs.push("", "The Apprentice falls! Something glitters in the chamber beyond...");
    }
    for (const ch of alive) {
      const ups = ch.xp >= xpForLevel(ch.cls, ch.level + 1);
      if (ups) this.msgs.push(`${ch.name} is ready for a level (rest at the Inn).`);
    }
    UI.renderParty();
    if (this.opts.lair || this.opts.boss || this.hadElite() || pct(40)) {
      this.phase = "msg"; this.endTo = "chest"; this.msgs.push("", "The monsters were guarding a CHEST!");
      const oldAfter = this.afterMsgs.bind(this);
      this.afterMsgs = () => { this.afterMsgs = oldAfter; this.openChestUI(); };
    } else {
      this.phase = "msg"; this.endTo = "chestDone";
    }
    this.draw();
  },
  openChestUI() {
    const traps = ["POISON NEEDLE", "GAS BOMB", "CROSSBOW BOLT", "EXPLODING BOX", "ALARM"];
    this.chest = { trap: pct(floorMod().chestTrap ? 100 : 70) ? pick(traps) : null, revealed: null, done: false };
    this.worker = Math.max(0, Game.party.findIndex(isUp));
    this.phase = "chest";
    this.draw();
  },
  drawChest() {
    const ch = Game.party[this.worker];
    UI.viewLabel("*** A CHEST ***");
    const rev = this.chest.revealed ? `\nInspection says: <span class="k">${this.chest.revealed}</span>` : "";
    UI.panel(`<h2>A CHEST!</h2>\nWorking on it: <span class="hi">${esc(ch ? ch.name : "?")}</span> <span class="dim">(press 1-${Game.party.length} to change)</span>${rev}\n\n${UI.key("O", "Open it")}\n${UI.key("I", "Inspect for traps")}\n${UI.key("C", "Cast CALFO")}\n${UI.key("D", "Disarm trap")}\n${UI.key("L", "Leave it")}`);
  },
  chestKey(k) {
    if (this.chest.done) return;
    const n = parseInt(k, 10) - 1;
    if (n >= 0 && n < Game.party.length && isUp(Game.party[n])) { this.worker = n; this.draw(); return; }
    const ch = Game.party[this.worker];
    const c = this.chest;
    if (k === "l") { UI.log("You leave the chest untouched."); Events.emit("chest", { action: "leave", ch }); this.finish(); return; }
    if (k === "i") {
      Events.emit("chest", { action: "inspect", ch });
      if (pct(10) && c.trap) { this.triggerTrap(ch); return; }
      const chance = clamp(40 + ch.stats.AGI * 2 + (ch.cls === "Thief" ? 30 : 0) + mod(ch, "inspect"), 5, 95);
      if (pct(chance)) c.revealed = c.trap || "NO TRAP — it seems safe";
      else c.revealed = pct(50) ? "NO TRAP — it seems safe" : pick(["POISON NEEDLE", "GAS BOMB", "CROSSBOW BOLT", "EXPLODING BOX", "ALARM"]);
      this.draw(); return;
    }
    if (k === "c") {
      const priest = Game.party.find(p => isUp(p) && p.sp.priest[1] > 0 && knownSpells(p).includes("CALFO"));
      if (!priest) { UI.log("No one can cast CALFO."); return; }
      priest.sp.priest[1]--;
      UI.log(`${priest.name} casts CALFO.`);
      c.revealed = pct(95) ? (c.trap || "NO TRAP — it seems safe") : "NO TRAP — it seems safe";
      UI.renderParty(); this.draw(); return;
    }
    if (k === "d") {
      Events.emit("chest", { action: "disarm", ch });
      if (!c.trap) { UI.log("Click... there was no trap. The chest opens!"); this.loot(ch); return; }
      const map = getLevel(Game.maze.level);
      const chance = clamp(30 + ch.stats.AGI * 2 + ch.level * 3 + (ch.cls === "Thief" ? 30 : 0) - map.depth * 5 + mod(ch, "disarm"), 5, 95);
      if (pct(chance)) {
        UI.log(`${ch.name} disarms the ${c.trap}!`);
        Events.emit("trap", { type: c.trap, ch, disarmed: true });
        this.loot(ch);
      }
      else if (pct(40)) this.triggerTrap(ch);
      else { UI.log(`${ch.name} fumbles but nothing happens.`); this.draw(); }
      return;
    }
    if (k === "o") {
      Events.emit("chest", { action: "open", ch });
      if (c.trap) this.triggerTrap(ch);
      else { UI.log("The chest creaks open!"); this.loot(ch); }
    }
  },
  triggerTrap(ch) {
    const c = this.chest;
    const map = getLevel(Game.maze.level);
    UI.log(`*SNAP* — ${c.trap || "a trap"}!`);
    const t = c.trap;
    c.trap = null;
    Events.emit("trap", { type: t, ch, triggered: true });
    if (t === "POISON NEEDLE") {
      if (ch.status === "OK") { ch.status = "POISONED"; UI.log(`${ch.name} is poisoned!`); }
    } else if (t === "GAS BOMB") {
      for (const p of Game.party) if (isUp(p) && pct(50) && p.status === "OK") { p.status = "POISONED"; UI.log(`${p.name} is poisoned!`); }
    } else if (t === "CROSSBOW BOLT") {
      this.trapHurt(ch, dice("1d6") * map.depth);
    } else if (t === "EXPLODING BOX") {
      for (const p of Game.party) if (isUp(p)) this.trapHurt(p, dice("1d8") * Math.max(1, map.depth - 1));
    } else if (t === "ALARM") {
      UI.log("An alarm rings through the maze!");
      UI.renderParty();
      Combat.start({});
      return;
    }
    UI.renderParty();
    if (!Game.party.some(isUp)) { partyWipe(); return; }
    this.loot(ch);
  },
  trapHurt(ch, dmg) {
    const died = applyDamage(ch, dmg, { type: "trap" });
    if (died) UI.log(`${ch.name} takes ${dmg} and DIES!`);
    else UI.log(`${ch.name} takes ${dmg} damage!`);
  },
  loot(ch) {
    this.chest.done = true;
    const map = getLevel(Game.maze.level);
    const fm = floorMod();
    const gold = Math.floor(dice("3d10") * 10 * map.depth * this.goldMult() * (fm.chestGoldMult || fm.goldMult || 1) * streakMult());
    const alive = Game.party.filter(isUp);
    const share = Math.floor(gold / Math.max(1, alive.length));
    for (const p of alive) grantGold(p, Math.floor(share * (100 + mod(p, "goldGain")) / 100), "chest");
    UI.log(`The chest holds ${gold} gold! (${share} each)`);
    let itemName = null;
    if (this.opts.lair || this.opts.boss || this.hadElite() || pct(35)) {
      const q = Math.min(3, (map.depth >= 4 ? 1 : 0) + (this.opts.lair ? 1 : 0) + (this.opts.boss ? 2 : 0) + (this.opts.vault ? 1 : 0) + (this.hadElite() ? 1 : 0) + (pct(20) ? 1 : 0));
      const entry = generateItem(map.depth, q);
      ch.items.push(entry);
      itemName = IT(entry).name;
      UI.log(`${ch.name} finds: ${itemName}!`);
    }
    Events.emit("loot", { ch, gold, item: itemName, level: Game.maze.level });
    UI.renderParty();
    this.finish();
  },
};

const CombatScreen = {
  draw() { Combat.draw(); },
  key(k, e) { Combat.key(k, e); },
};
