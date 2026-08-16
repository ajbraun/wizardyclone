"use strict";
const SAVE_KEY = "wizardy_save_v2";
const SAVE_KEY_V1 = "wizardy_save_v1";
const Game = {
  roster: [], party: [], maze: null, flags: {}, counters: {}, achievements: {}, titles: [], state: null,
  go(screen) {
    this.state = screen;
    if (screen.enter) screen.enter();
    screen.draw();
    UI.renderParty();
  },
  count(key, n) { this.counters[key] = (this.counters[key] || 0) + (n === undefined ? 1 : n); },
  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        version: 2,
        roster: this.roster,
        party: this.party.map(c => c.id),
        maze: this.maze,
        flags: this.flags,
        counters: this.counters,
        achievements: this.achievements,
        titles: this.titles,
        nextId: _charId,
      }));
    } catch (e) { /* private mode etc. */ }
  },
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY) || localStorage.getItem(SAVE_KEY_V1);
      if (!raw) return false;
      const data = JSON.parse(raw);
      this.roster = data.roster || [];
      // migrate older saves: default any fields added since
      for (const ch of this.roster) {
        if (!ch.skills) ch.skills = [];
      }
      this.party = (data.party || []).map(id => this.roster.find(c => c.id === id)).filter(Boolean);
      this.maze = data.maze || null;
      this.flags = data.flags || {};
      this.counters = data.counters || {};
      this.achievements = data.achievements || {};
      this.titles = data.titles || [];
      _charId = data.nextId || (Math.max(0, ...this.roster.map(c => c.id)) + 1);
      return true;
    } catch (e) { return false; }
  },
  hasSave() {
    try { return !!(localStorage.getItem(SAVE_KEY) || localStorage.getItem(SAVE_KEY_V1)); }
    catch (e) { return false; }
  },
  newGame() {
    this.roster = []; this.party = []; this.maze = null; this.flags = {}; this.counters = {};
    this.achievements = {}; this.titles = [];
    _charId = 1;
    try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(SAVE_KEY_V1); } catch (e) {}
    Events.emit("newGame", {});
  },
};
// e:* counters and achievement checks are wired in achievements.js

const TitleScreen = {
  draw() {
    Render.blank("");
    UI.viewLabel("");
    const art =
` __      __ ___ ______  _    ____  ____  __   __
 \\ \\    / /|_ _||_   /  / \\  |  _ \\|  _ \\ \\ \\ / /
  \\ \\/\\/ /  | |   / /  / _ \\ | |_) | | | | \\ V /
   \\_/\\_/  |___| /___|/_/ \\_\\|_| \\_\\|____/   |_|`;
    UI.panel(`<div class="title-art">${art}</div>\n<span class="dim">   PROVING GROUNDS OF THE CODE OVERLORD</span>\n\n\n` +
      (Game.hasSave() ? `${UI.key("C", "Continue")}\n` : "") +
      `${UI.key("N", "New Game")}\n\n<span class="dim">A tribute to the 1981 classic. Make characters at the Training\nGrounds (Edge of Town), form a party at Gilgamesh's Tavern,\nand brave the maze. Find the Amulet on level 3 to win.</span>`);
  },
  key(k) {
    if (k === "c" && Game.hasSave()) {
      Game.load();
      UI.log("The tale resumes...");
      Game.go(Game.maze ? MazeScreen : CastleScreen);
    } else if (k === "n") {
      if (Game.hasSave() && !this.confirmed) {
        this.confirmed = true;
        UI.log("This will ERASE the saved game. Press N again to confirm.");
        return;
      }
      this.confirmed = false;
      Game.newGame();
      UI.clearLog();
      UI.log("Welcome, overlord of nothing. Go make some adventurers.");
      Game.go(CastleScreen);
    }
  },
  enter() { this.confirmed = false; },
};

document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
  if (Game.state && Game.state.key) Game.state.key(e.key.toLowerCase(), e);
});

window.addEventListener("load", () => {
  Game.go(TitleScreen);
});
