"use strict";
// Authored chapters use persistent flags, leaving existing layouts, parties,
// inventory IDs and generated-floor seeds intact.
const SHIFT_MONSTERS = {
  SHIFT_BELL: { name: "Kobold Bellringer", pl: "Kobold Bellringers", lvl: 1, hp: "1d4+2", ac: 10, dmg: ["1d3"], num: "1", xp: 85, art: "humanoid", scene: "kobold", tactic: "rally", lore: "Paid per alarm. Sleep or silence stops the bell; at most two reinforcements answer per battle." },
  SHIFT_MEDIC: { name: "Company Chirurgeon", pl: "Company Chirurgeons", lvl: 1, hp: "1d4+3", ac: 10, dmg: ["1d3"], num: "1", xp: 95, art: "caster", scene: "priest", tactic: "mend", lore: "Stitches injured enemies for 3 HP on alternate rounds. Interrupt the chant before the invoice arrives." },
  SHIFT_HOUND: { name: "Kennel Hound", pl: "Kennel Hounds", lvl: 1, hp: "1d6", ac: 9, dmg: ["1d3"], num: "1d2", xp: 75, art: "beast", scene: "hound", tactic: "pounce", lore: "Telegraphs a leap into your back row on alternate rounds. Parry halves the pounce damage." },
  SHIFT_SLIME: { name: "Lamp Slime", pl: "Lamp Slimes", lvl: 1, hp: "1d4+1", ac: 11, dmg: ["1d2"], num: "1d3", xp: 60, art: "blob", scene: "slime", tactic: "flare", lore: "Swallowed the emergency lighting. Its announced flare deals 2 damage to each adventurer; parry halves it." },
  SHIFT_FOREMAN: { name: "Grusk, Shift Foreman", pl: "Shift Foremen", lvl: 2, hp: "3d6+6", ac: 9, dmg: ["1d5"], num: "1", xp: 400, art: "humanoid", scene: "orc", tactic: "slam", lore: "Falsified the casualty ledger to collect a safety bonus. His announced hammer blow deals 6 damage; parry halves it." },
};
for (const [id, def] of Object.entries(SHIFT_MONSTERS)) MONSTERS[id] = Object.assign({ id }, def);

Object.assign(ITEMS, {
  Q_PATCH: { name: "Pell's Field Dressing", slot: "cloak", ac: 1, price: 100, cls: null, loot: true, unique: true, guardHeal: 2, effect: "Your first Parry each battle restores 2 HP when your turn resolves.", lore: "Washable. Allegedly." },
  Q_LANTERN: { name: "Surveyor's Lens", slot: "ring", mods: { inspect: 15, maxhp: 2 }, price: 120, cls: null, loot: true, unique: true, lore: "Finds the needle before the needle finds you." },
  Q_SPLINT: { name: "Chirurgeon's Thread", slot: "ring", mods: { healPower: 1 }, price: 120, cls: null, loot: true, unique: true, lore: "One stitch for the wound. One for the paperwork." },
  Q_SEAL: { name: "Witness Seal", slot: "ring", mods: { resist: 10, maxhp: 2 }, price: 180, cls: null, loot: true, unique: true, lore: "Proof that someone lived to disagree." },
  Q_SEVERANCE: { name: "Severance Pay", slot: "weapon", dmg: "1d6", price: 180, cls: null, loot: true, unique: true, interruptHit: true, effect: "Once per battle, a melee hit cancels the target group's pending special attack.", lore: "Negotiations end at the sharp part." },
  Q_SIGNET: { name: "Company Signet", slot: "ring", mods: { goldGain: 10 }, price: 180, cls: null, loot: true, unique: true, lore: "The company recognizes your silence as a transferable skill." },
});

const SHIFT_SITES = {
  mara: { x: 9, y: 17, title: "Mara's supply desk" },
  pell: { x: 1, y: 9, title: "The west storeroom" },
  ledger: { x: 19, y: 7, title: "The east records room" },
  cache: { x: 10, y: 11, title: "An emergency supply chest" },
  foreman: { x: 9, y: 2, title: "The foreman's hall" },
};
for (const [site, p] of Object.entries(SHIFT_SITES)) sp(L1, p.x, p.y, { t: "story", site });
L1.band = "The Missing Shift";
// Keep familiar encounters, but let authored enemies define the first floor.
L1.table = [["KOBOLD", 2], ["SHIFT_BELL", 2], ["SHIFT_HOUND", 2], ["SHIFT_SLIME", 2], ["SHIFT_MEDIC", 1], ["GIANTRAT", 1], ["ORC", 1]];

const Story = {
  state() { return Game.flags.missingShift || (Game.flags.missingShift = {}); },
  objective() {
    const q = this.state();
    if (q.outcome) return "Chapter complete. The stairs in the northeast lead to level 2.";
    if (q.defeated) return "Return to Mara near the entrance to collect your reward.";
    if (!q.met) return "Speak to Mara one step north of the level 1 entrance.";
    if (!q.rescued) return "Find Pell in the west storeroom (1, 9).";
    if (!q.ledger) return "Search the east records room (19, 7).";
    return "Confront Grusk in the northern hall (9, 2).";
  },
  save() { Game.save(); UI.renderParty(); },
  give(id) {
    const ch = Game.party.find(isUp);
    if (!ch) return false;
    ch.items.push({ id, eq: false });
    UI.log(`${ch.name} receives ${ITEMS[id].name}. Equip it from Camp → Inspect.`);
    return true;
  },
  open(site) {
    const q = this.state();
    q.visited = q.visited || {};
    q.visited[site] = true;
    StoryScreen.site = site;
    this.save();
    Game.go(StoryScreen);
  },
  journal(back) { JournalScreen.back = back; Game.go(JournalScreen); },
  scene(site) {
    const q = this.state();
    const result = (title, paragraphs, choices = []) => ({ title, paragraphs, choices });
    const choice = (key, label) => ({ key, label });
    if (site === "mara") {
      if (q.outcome) return result("Mara remembers", [q.outcome === "coverup"
        ? "Mara reads the official report. ‘Voluntary departure. Even their disappearance belongs to the company now.’ She closes the supply book."
        : "Mara writes the missing workers' names back into the roster. ‘They were people before they were statistics. Thank you.’",
      "Behind her, a receiver crackles: TRANSFER ORDER — LEVEL TWO. The signature has been scraped away."]);
      if (q.defeated) return result("The end of the shift", ["Grusk's office is silent. Mara waits for your account of what happened.", q.approach === "coverup"
        ? "The System offers a Company Signet (+10% combat gold) and 120 gold for filing the crew as volunteers."
        : q.approach === "expose" ? "The workers offer a Witness Seal (+10% spell resistance, +2 max HP) for putting the truth on record."
          : "Mara offers Grusk's blade, Severance Pay. Once per battle, a hit interrupts a pending enemy special attack."], [choice("1", "File the report and receive your reward")]);
      return result("Mara, quartermaster", ["Mara sits beneath a sign reading ZERO WORKPLACE FATALITIES. Someone has painted over the second digit.",
        "‘The night shift never came back. Pell was checking the west storeroom. The records are kept in the east. Grusk has locked himself in the northern hall.’",
        "[SYSTEM] Missing personnel are presumed to be enjoying their unpaid leave.",
        q.met ? "‘Bring me something the System can't explain away.’" : "She offers a healing potion and asks you to find out what happened. The stairs remain open if you choose to move on."], q.met ? [] : [choice("1", "Help Mara — take a healing potion")]);
    }
    if (site === "pell") return q.rescued
      ? result("Pell, off the clock", [q.outcome === "coverup" ? "‘Volunteers?’ Pell stares at your signet. ‘I was trapped under a cabinet.’" : "Pell rests beside a pried-open cabinet. ‘If Grusk draws back his hammer, brace yourself. He always announces the overtime.’", "The worker has disconnected Grusk's alarm. His bellringer will stay out of the confrontation."])
      : result("Someone beneath the shelves", ["‘If you're here for inventory, put me down as damaged.’ A maintenance worker is pinned beneath a fallen supply cabinet.", "Helping costs no supplies. Pell knows how to disable the foreman's alarm and carries a field dressing: your first Parry each battle heals 2 HP."], [choice("1", "Lift the cabinet and rescue Pell")]);
    if (site === "ledger") return result("A ledger with two totals", [q.ledger
      ? "You have copied both pages. The crew were transferred below; their deaths were entered before the shift began."
      : "The public page lists an accident. The carbon copy lists a transfer to level 2, signed before anyone went missing.",
    "[SYSTEM] Carbon paper has been discontinued for its adversarial attitude toward editing."], q.ledger ? [] : [choice("1", "Copy the evidence — unlock a confrontation choice")]);
    if (site === "cache") return result("Break glass for employees", [q.cache ? `You took ${ITEMS[q.cache].name}. The remaining supplies are reserved for the injured crew.`
      : "One sealed kit remains. Take a Surveyor's Lens (+15% trap inspection, +2 max HP) or Chirurgeon's Thread (+1 healing power)."], q.cache ? [] : [choice("1", "Take the Surveyor's Lens"), choice("2", "Take the Chirurgeon's Thread")]);
    if (site === "foreman") {
      if (q.defeated) return result("An empty supervisor's chair", ["Grusk's hammer lies across a broken desk. A dispatch tube leads deeper into the dungeon.", this.objective()]);
      const choices = [choice("1", "Fight Grusk — claim his interrupting blade")];
      if (q.ledger) choices.push(choice("2", "Read the evidence aloud — claim the Witness Seal"), choice("3", "Accept the System's cover-up — claim gold and a signet"));
      return result("Grusk, shift foreman", ["‘Those people were transferred,’ Grusk says. ‘Whether they arrived is a different department.’ He reaches for a hammer.",
        q.rescued ? "Pell has cut the alarm wire. Grusk's bellringer will not answer." : "A kobold waits beside an alarm bell. Rescuing Pell in the west can prevent that reinforcement.",
        q.ledger ? "Reading the copied ledger will make Grusk's chirurgeon abandon him. The System instead offers to buy your silence after you remove its inconvenient foreman."
          : "A company chirurgeon stands behind him. Evidence from the east records room could turn the healer against Grusk.",
        "Optional fight, intended for an equipped party around character level 2. You can leave, prepare, or continue downstairs."], choices);
    }
    return result("The Missing Shift", [this.objective()]);
  },
  choose(site, k) {
    const q = this.state();
    // All rewards are granted with their completion flag in the same save.
    if (site === "mara" && k === "1") {
      if (q.outcome) return;
      if (q.defeated) {
        const id = q.approach === "coverup" ? "Q_SIGNET" : q.approach === "expose" ? "Q_SEAL" : "Q_SEVERANCE";
        if (!this.give(id)) return;
        q.outcome = q.approach;
        if (q.outcome === "coverup") {
          const up = Game.party.filter(isUp);
          const share = Math.floor(120 / up.length);
          up.forEach(ch => grantGold(ch, share, "story"));
        }
        UI.log(q.outcome === "coverup" ? "[SYSTEM] Report accepted. Your discretion has been compensated." : "[SYSTEM] Report amended under protest. The Missing Shift is now a matter of record.");
      } else if (!q.met) { if (!this.give("P_DIOS")) return; q.met = true; }
    } else if (site === "pell" && k === "1" && !q.rescued) {
      if (!this.give("Q_PATCH")) return;
      q.rescued = true;
      UI.log("Pell cuts the foreman's alarm wire. ‘Consider that my resignation.’");
    } else if (site === "ledger" && k === "1" && !q.ledger) {
      q.ledger = true;
      UI.log("Journal updated: the missing crew were transferred to level 2. Grusk falsified the accident report.");
    } else if (site === "cache" && ["1", "2"].includes(k) && !q.cache) {
      const id = k === "1" ? "Q_LANTERN" : "Q_SPLINT";
      if (!this.give(id)) return;
      q.cache = id;
    } else if (site === "foreman" && !q.defeated && (["1"].includes(k) || (q.ledger && ["2", "3"].includes(k)))) {
      q.approach = { 1: "fight", 2: "expose", 3: "coverup" }[k];
      this.save();
      const encounter = [["SHIFT_FOREMAN", 1]];
      if (!q.rescued) encounter.push(["SHIFT_BELL", 1]);
      if (q.approach !== "expose") encounter.push(["SHIFT_MEDIC", 1]);
      Combat.start({ story: "missingShift", encounter });
      return;
    } else return;
    this.save();
    StoryScreen.draw();
  },
  victory() {
    const q = this.state();
    if (q.defeated) return;
    q.defeated = true;
    UI.log("Grusk falls. Return to Mara near the level 1 entrance to finish The Missing Shift.");
    this.save();
  },
};

const StoryScreen = {
  site: "mara",
  draw() {
    const scene = Story.scene(this.site);
    if (this.site === "cache") Render.chestBox(!!Story.state().cache);
    else Render.draw(L1, Game.maze.x, Game.maze.y, Game.maze.f, 3);
    UI.viewLabel("LEVEL 1 · THE MISSING SHIFT");
    UI.panel(`<div class="story-scene"><span class="eyebrow">CHAPTER ONE</span><h2>${esc(scene.title)}</h2>${scene.paragraphs.map(p => `<p>${esc(p)}</p>`).join("")}<div class="story-choices">${scene.choices.map(c => UI.key(c.key, esc(c.label))).join("")}${UI.key("J", "Quest journal")}${UI.key("L", "Back to the maze")}</div></div>`);
  },
  key(k) {
    if (k === "l" || k === "escape") Game.go(MazeScreen);
    else if (k === "j") Story.journal(StoryScreen);
    else Story.choose(this.site, k);
  },
};

const JournalScreen = {
  back: null,
  draw() {
    const q = Story.state();
    UI.viewLabel("QUEST JOURNAL");
    const locations = Object.entries(SHIFT_SITES).map(([id, p]) => {
      const done = { mara: q.outcome, pell: q.rescued, ledger: q.ledger, cache: q.cache, foreman: q.defeated }[id];
      return `<li>${done ? "✓ " : ""}${esc(p.title)} — (${p.x}, ${p.y})</li>`;
    }).join("");
    UI.panel(`<div class="story-scene"><span class="eyebrow">LEVEL 1 · ${q.outcome ? "COMPLETE" : "CHAPTER ONE"}</span><h2>The Missing Shift</h2><p class="gold">${esc(Story.objective())}</p><p>The dungeon's maintenance crew disappeared. Mara wants names, witnesses, and an explanation that survives an audit.</p><ul>${locations}</ul><p>Coordinates are (east, south), starting at 0. Your position appears above the maze and on the map.</p>${q.rescued ? "<p>Pell rescued: the foreman's alarm is disabled.</p>" : ""}${q.ledger ? "<p>Evidence copied: the crew were transferred to level 2. Read it aloud to make Grusk's healer leave.</p>" : ""}${q.outcome ? `<p>Your report: ${q.outcome === "coverup" ? "You accepted the cover-up. Mara and Pell remember." : q.outcome === "expose" ? "You exposed the falsified ledger." : "You defeated Grusk and returned to Mara."}</p>` : ""}<p>Optional chapter. Returning parties can play it without starting over; the stairs to level 2 remain open.</p><div class="story-choices">${UI.key("L", "Close journal")}</div></div>`);
  },
  key(k) { if (["l", "j", "escape"].includes(k)) Game.go(this.back || MazeScreen); },
};
