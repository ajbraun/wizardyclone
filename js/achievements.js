"use strict";
// ================================================================ THE SYSTEM
// Achievements: definitions, counter wiring, awards, and the System screen.
// Counters persist in Game.counters; earned ids in Game.achievements;
// earned titles in Game.titles. The System sees all. It judges most.

const ACHIEVEMENTS = [];
function ach(id, name, counter, at, desc, flavor, reward, secret) {
  ACHIEVEMENTS.push({ id, name, counter, at, desc, flavor, reward: reward || {}, secret: !!secret });
}

// -------------------------------------------------------------- combat
ach("FIRST_BLOOD", "First Blood", "kills", 1, "Kill a monster",
  "Your first kill. The bar was on the floor, and you cleared it.", { gold: 25 });
ach("KILLS_10", "Pest Control", "kills", 10, "Kill 10 monsters",
  "Ten down. The dungeon has not noticed.", { gold: 50 });
ach("KILLS_100", "Exterminator", "kills", 100, "Kill 100 monsters",
  "One hundred kills. The dungeon has noticed. It sent more.", { gold: 250 });
ach("KILLS_500", "Massacre Artist", "kills", 500, "Kill 500 monsters",
  "Five hundred. At this point it's less 'adventure' and more 'policy.'", { gold: 1000, title: "Massacre Artist", box: "SILVER" });
ach("KILLS_2000", "Walking Apocalypse", "kills", 2000, "Kill 2,000 monsters",
  "Two thousand souls. The System has started a memorial wall. It's a big wall.", { xp: 2000, title: "Walking Apocalypse", box: "GOLD" });
ach("CRITS_10", "Lucky Strike", "crits", 10, "Land 10 critical hits",
  "Ten crits. Luck is a skill if you refuse to examine it.", { gold: 50 });
ach("CRITS_100", "Surgeon of Violence", "crits", 100, "Land 100 critical hits",
  "One hundred critical hits. Do you hear the anatomy textbook weeping?", { gold: 500, title: "Surgeon of Violence" });
ach("CRIT_KILLS_25", "Overkill Enthusiast", "critKills", 25, "Kill 25 monsters with critical hits",
  "They were already going to die. You made it personal.", { gold: 250 });
ach("SLEEP_KILLS_20", "Nightmare Fuel", "sleepKills", 20, "Kill 20 sleeping monsters",
  "They were having such a nice dream.", { gold: 200 }, true);
ach("SPELL_KILLS_50", "Arcane Artillery", "spellKills", 50, "Kill 50 monsters with spells",
  "Fifty kills by syllable. Words hurt.", { gold: 300 });
ach("WHIFF_100", "Swing and a Miss", "whiffs", 100, "Miss 100 attacks",
  "One hundred misses. The monsters politely waited.", { gold: 50 });
ach("WHIFF_1000", "Air Conditioner", "whiffs", 1000, "Miss 1,000 attacks",
  "A thousand swings hit nothing but air. The air is considering pressing charges.", { title: "Air Conditioner" }, true);
ach("DMG_DEALT_1000", "Damage Dealer", "dmgDealt", 1000, "Deal 1,000 total damage",
  "One thousand points of persuasion.", { gold: 100 });
ach("DMG_DEALT_10000", "Number Goes Up", "dmgDealt", 10000, "Deal 10,000 total damage",
  "Ten thousand damage. The System admires a growth mindset applied to violence.", { gold: 500 });
ach("DMG_TAKEN_1000", "Human Shield", "dmgTaken", 1000, "Take 1,000 total damage",
  "Tanking: technically a strategy.", { gold: 100 });
ach("DMG_TAKEN_5000", "Professional Victim", "dmgTaken", 5000, "Take 5,000 total damage",
  "Five thousand damage absorbed. Your body is a temple. A condemned one.", { gold: 500, title: "Professional Victim" });
ach("UNDEAD_50", "Grave Disagreement", "kills:undead", 50, "Destroy 50 undead",
  "They were already dead. You clarified the matter.", { gold: 300 });
ach("SLIME_50", "Slime Minister", "kill:SLIME", 50, "Kill 50 Bubbly Slimes",
  "Fifty slimes. Your sword is disgusting and your enemies are jello.", { gold: 150 });
ach("BOSS_1", "Overqualified Intern", "bossKills", 1, "Defeat Werdna's Apprentice",
  "You beat the apprentice. Somewhere, a wizard is updating a job posting.", { box: "SILVER" });
ach("VICTORIES_25", "Winner", "e:victory", 25, "Win 25 battles",
  "Twenty-five victories. Participation was never in question. Trophies were.", { gold: 100 });
ach("VICTORIES_100", "Serial Winner", "e:victory", 100, "Win 100 battles",
  "One hundred wins. The System has stopped acting surprised.", { gold: 400 });
ach("FLEES_10", "Tactical Repositioning", "flees", 10, "Successfully flee 10 battles",
  "Running away ten times is called cardio.", { gold: 50 });
ach("ENCOUNTERS_100", "Popular", "e:encounter", 100, "Get into 100 encounters",
  "Everything in this dungeon wants to meet you. Briefly.", { gold: 100 });

// -------------------------------------------------------------- exploration
ach("STEPS_100", "Baby Steps", "e:step", 100, "Walk 100 steps",
  "One hundred steps without dying. Statistically notable.", { gold: 25 });
ach("STEPS_1000", "Cartographer's Nightmare", "e:step", 1000, "Walk 1,000 steps",
  "A thousand steps, most of them in circles. Graph paper exists.", { gold: 100 });
ach("STEPS_10000", "Marathon Crawler", "e:step", 10000, "Walk 10,000 steps",
  "Ten thousand steps underground. Your watch is very proud. It's dark down here.", { gold: 500, title: "Marathon Crawler" });
ach("BUMPS_10", "Face, Meet Wall", "e:bump", 10, "Walk into 10 walls",
  "The wall wins. The wall always wins.", { gold: 10 });
ach("BUMPS_100", "Wall Magnet", "e:bump", 100, "Walk into 100 walls",
  "One hundred collisions. The dungeon didn't move. It never moves.", { gold: 100, title: "Wall Magnet" });
ach("DOORS_50", "Door-to-Door", "e:door", 50, "Open 50 doors",
  "Fifty doors opened. Zero knocked on.", { gold: 50 });
ach("DOORS_250", "Unwelcome Guest", "e:door", 250, "Open 250 doors",
  "You've barged into 250 rooms. Etiquette is dead and you killed it too.", { gold: 200 });
ach("DEPTH_2", "Going Down", "maxDepth", 2, "Reach dungeon level 2",
  "Deeper. Where the monsters keep their better monsters.", { gold: 100 });
ach("DEPTH_3", "Rock Bottom", "maxDepth", 3, "Reach dungeon level 3",
  "The bottom of the dungeon. For now.", { gold: 250 });
ach("DEPTH_5", "Spelunker Extraordinaire", "maxDepth", 5, "Reach floor 5 of the Crawl",
  "Below the map. Below the sequel's map.", { box: "SILVER" });
ach("DEPTH_10", "Sunlight Is a Memory", "maxDepth", 10, "Reach floor 10",
  "Floor ten. Your vitamin D has filed a missing persons report.", { box: "GOLD", title: "Deep One" });
ach("DEPTH_20", "No Bottom in Sight", "maxDepth", 20, "Reach floor 20",
  "Twenty floors down and still descending. The System has stopped taking bets.", { box: "PLATINUM", title: "The Descent Itself" });
ach("CAMPS_10", "Outdoorsy", "e:camp", 10, "Make camp 10 times",
  "Ten naps on a dungeon floor. The inn misses you. The floor does not.", { gold: 50 });

// -------------------------------------------------------------- death & misfortune
ach("DEATH_1", "Everybody Dies Once", "deaths", 1, "Lose a party member",
  "Your first death! The temple has started a punch card.", { gold: 50 });
ach("DEATHS_10", "Frequent Dier", "deaths", 10, "Suffer 10 party deaths",
  "Ten deaths. The priests know your party by name. And blood type.", { gold: 200 });
ach("DEATHS_25", "Temple VIP", "deaths", 25, "Suffer 25 party deaths",
  "Twenty-five deaths. The Temple of Cant has named a pew after you.", { gold: 500, title: "Temple VIP" });
ach("WIPE_1", "Total Party Kill", "e:wipe", 1, "Lose the entire party at once",
  "Everyone. At once. The System is almost impressed.", { gold: 100 });
ach("RES_5", "Recycled", "e:resurrect", 5, "Resurrect 5 times",
  "Reduce. Reuse. Resurrect.", { gold: 150 });
ach("TRAPS_TRIG_10", "Hands-On Learner", "trapsTriggered", 10, "Trigger 10 chest traps",
  "Ten traps, all discovered the honest way.", { gold: 100 });
ach("TRAPS_DISARM_10", "Delicate Fingers", "trapsDisarmed", 10, "Disarm 10 chest traps",
  "Ten traps disarmed. Your fingers thank you for not delegating to your face.", { gold: 150 });
ach("POISON_100", "Iron Stomach (Eventually)", "poisonTicks", 100, "Suffer 100 ticks of poison",
  "One hundred doses of venom, one step at a time. This is not how immunity works.", { gold: 200 }, true);

// -------------------------------------------------------------- commerce
ach("GOLD_EARN_1000", "Petty Cash", "goldEarned", 1000, "Earn 1,000 gold",
  "Your first thousand. The monsters were saving up for something.", { gold: 50 });
ach("GOLD_EARN_10000", "Dungeon Economist", "goldEarned", 10000, "Earn 10,000 gold",
  "Ten thousand gold extracted. The dungeon's GDP is you.", { gold: 500 });
ach("GOLD_SPENT_1000", "Boltac's Favorite", "goldSpent", 1000, "Spend 1,000 gold",
  "Boltac pretends not to smile when you walk in.", { gold: 50 });
ach("GOLD_SPENT_10000", "Whale", "goldSpent", 10000, "Spend 10,000 gold",
  "Ten thousand gold spent. Boltac has a boat now. It's named after you.", { gold: 500 });
ach("BUYS_10", "Retail Therapy", "e:buy", 10, "Buy 10 items",
  "Ten purchases. The dungeon is stressful. The System understands.", { gold: 50 });
ach("SELLS_10", "One Man's Trash", "e:sell", 10, "Sell 10 items",
  "Ten items fenced. Boltac asks no questions. Boltac knows the answers.", { gold: 50 });
ach("POTIONS_10", "Bottoms Up", "e:potion", 10, "Drink 10 potions",
  "Ten potions. At some point this is just a beverage preference.", { gold: 50 });

// -------------------------------------------------------------- progression
ach("SPELLS_50", "Cantrip Kid", "e:spell", 50, "Cast 50 spells",
  "Fifty spells. Somewhere a mage guild is drafting a cease-and-desist.", { gold: 100 });
ach("SPELLS_250", "Mana Battery", "e:spell", 250, "Cast 250 spells",
  "Two hundred fifty castings. Your spellbook has stress fractures.", { gold: 400 });
ach("LEVELUPS_10", "Growth Mindset", "e:levelup", 10, "Gain 10 character levels",
  "Ten level-ups. The System loves personal development. It loves the fees more.", { gold: 200 });
ach("MAXLEVEL_10", "Double Digits", "maxLevel", 10, "Get a character to level 10",
  "Level ten. You are now a medium-sized fish in a pond that goes down forever.", { gold: 300 });
ach("CREATE_5", "Fresh Meat", "e:create", 5, "Create 5 adventurers",
  "Five adventurers created. The System appreciates a reliable supply chain.", { gold: 50 });
ach("RESTS_20", "Professional Napper", "e:rest", 20, "Rest at the inn 20 times",
  "Twenty stays. The innkeeper has stopped changing your sheets.", { gold: 100 });
ach("WON", "Proving Grounds, Proven", "e:won", 1, "Recover the Amulet",
  "You did the thing. The realm is saved, pending sequel.", { gold: 2000, xp: 1000, title: "Provener", box: "GOLD" });
ach("SKILL_1", "Latent Talent", "e:skillUnlock", 1, "Unlock a skill",
  "Something clicked. Probably a joint, but the System will allow it.", { gold: 50 });
ach("SKILLS_10", "Renaissance Crawler", "e:skillUnlock", 10, "Unlock 10 skills",
  "Ten skills. A well-rounded individual, if the roundness is mostly scar tissue.", { gold: 300, title: "Renaissance Crawler", box: "SILVER" });
ach("SKILLUP_25", "Practice Makes Painful", "e:skillUp", 25, "Gain 25 skill levels",
  "Twenty-five skill-ups. Repetition is a teacher. A cruel, unlicensed teacher.", { gold: 250 });

// -------------------------------------------------------------- wiring
const Achievements = {
  checking: false,
  checkAll() {
    if (this.checking) return;
    this.checking = true;
    try {
      for (const def of ACHIEVEMENTS) {
        if (Game.achievements[def.id]) continue;
        if ((Game.counters[def.counter] || 0) >= def.at) this.award(def);
      }
    } finally { this.checking = false; }
  },
  award(def) {
    Game.achievements[def.id] = 1;
    const r = def.reward;
    const bits = [];
    const up = Game.party.filter(isUp);
    if (r.gold) {
      const share = Math.floor(r.gold / Math.max(1, up.length));
      up.forEach(c => grantGold(c, share, "achievement"));
      bits.push(`${r.gold} gold`);
    }
    if (r.xp) {
      up.forEach(c => c.xp += r.xp);
      bits.push(`${r.xp} XP each`);
    }
    if (r.title && !Game.titles.includes(r.title)) {
      Game.titles.push(r.title);
      bits.push(`title: "${r.title}"`);
    }
    if (r.box) {
      openLootBox(r.box);
      bits.push(`${r.box} loot box`);
    }
    UI.toast(`<b>ACHIEVEMENT: ${esc(def.name)}</b><br>${esc(def.flavor)}` +
      (bits.length ? `<br><span class="gold">Reward: ${esc(bits.join(", "))}</span>` : ""));
    UI.log(`[SYSTEM] Achievement unlocked: ${def.name}!`);
    UI.renderParty();
    Game.save();
  },
};

// detail counters (registered before the e:* onAny counter below)
Events.on("kill", p => {
  Game.count("kills");
  Game.count("kill:" + p.monster.id);
  if (p.monster.undead) Game.count("kills:undead");
  if (p.sleeping) Game.count("sleepKills");
  if (p.how === "spell") Game.count("spellKills");
  if (p.crit) Game.count("critKills");
});
Events.on("swing", p => {
  if (p.hit) Game.count("dmgDealt", p.dmg); else Game.count("whiffs");
  if (p.crit) Game.count("crits");
});
Events.on("damaged", p => {
  Game.count("dmgTaken", p.dmg);
  if (p.src.type === "poison") Game.count("poisonTicks");
});
Events.on("death", () => Game.count("deaths"));
Events.on("gold", p => { if (p.src !== "achievement") Game.count("goldEarned", p.amt); });
Events.on("spend", p => Game.count("goldSpent", p.amt));
Events.on("trap", p => Game.count(p.disarmed ? "trapsDisarmed" : "trapsTriggered"));
Events.on("flee", p => { if (p.ok) Game.count("flees"); });
Events.on("victory", p => { if (p.boss) Game.count("bossKills"); });
Events.on("descend", p => { Game.counters.maxDepth = Math.max(Game.counters.maxDepth || 1, p.to); });
Events.on("levelup", p => { Game.counters.maxLevel = Math.max(Game.counters.maxLevel || 1, p.level); });
// every event: bump the e:* counter, then evaluate achievements
Events.onAny(type => { Game.count("e:" + type); Achievements.checkAll(); });

// -------------------------------------------------------------- System screen
const SystemScreen = {
  back: null,
  draw() {
    Render.blank("THE SYSTEM");
    UI.viewLabel("");
    const c = Game.counters;
    const earned = ACHIEVEMENTS.filter(a => Game.achievements[a.id]);
    const pending = ACHIEVEMENTS.filter(a => !Game.achievements[a.id]);
    const stats =
      `STEPS ${c["e:step"] || 0}   KILLS ${c.kills || 0}   DEATHS ${c.deaths || 0}   WALLS HEADBUTTED ${c["e:bump"] || 0}\n` +
      `DMG DEALT ${c.dmgDealt || 0}   DMG TAKEN ${c.dmgTaken || 0}   GOLD EARNED ${c.goldEarned || 0}   DEEPEST FLOOR ${c.maxDepth || 1}`;
    const titles = Game.titles.length ? `\nTITLES: <span class="gold">${esc(Game.titles.join(", "))}</span>` : "";
    const eRows = earned.map(a =>
      ` <span class="gold">*</span> <span class="hi">${esc(a.name)}</span> — <span class="dim">${esc(a.flavor)}</span>`
    ).join("\n") || ' <span class="dim">(nothing yet — the System is patient)</span>';
    const pRows = pending.map(a => a.secret
      ? ' <span class="dim">? ??? — the System declines to elaborate.</span>'
      : ` <span class="dim">- ${esc(a.name)} (${Math.min(c[a.counter] || 0, a.at)}/${a.at}) — ${esc(a.desc)}</span>`
    ).join("\n");
    UI.panel(`<h2>THE SYSTEM</h2><span class="dim">It sees all. It judges most.</span>\n\n${stats}${titles}\n\nEARNED (${earned.length}/${ACHIEVEMENTS.length}):\n${eRows}\n\nPENDING:\n${pRows}\n\n${UI.key("L", "Leave")}`);
  },
  key(k) { if (k === "l") Game.go(this.back || CastleScreen); },
};
function openSystem(from) { SystemScreen.back = from; Game.go(SystemScreen); }
