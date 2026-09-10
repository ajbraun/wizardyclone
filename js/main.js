"use strict";
const SAVE_KEY = "wizardy_save_v2";
const SAVE_KEY_V1 = "wizardy_save_v1";
const Game = {
  roster: [], party: [], maze: null, flags: {}, counters: {}, achievements: {}, titles: [], seen: {}, state: null,
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
        seen: this.seen,
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
        if (!ch.prog) ch.prog = {};
      }
      this.party = (data.party || []).map(id => this.roster.find(c => c.id === id)).filter(Boolean);
      this.maze = data.maze || null;
      this.flags = data.flags || {};
      this.counters = data.counters || {};
      this.achievements = data.achievements || {};
      this.titles = data.titles || [];
      this.seen = data.seen || {};
      if (!this.flags.seed) this.flags.seed = 1 + rnd(2147483646);
      clearGeneratedLevels();
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
    this.achievements = {}; this.titles = []; this.seen = {};
    this.flags.seed = 1 + rnd(2147483646);
    clearGeneratedLevels();
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
    UI.panel(`<div class="intro"><span class="eyebrow">A CLASSIC CRAWL. A CRUEL NEW SYSTEM.</span><h2>Enter the dungeon.<br>Entertain the System.</h2><p>Six adventurers. An endless descent. An all-seeing overlord with a deeply unhealthy interest in your survival.</p><div class="intro-actions">` +
      (Game.hasSave() ? `${UI.key("C", "Continue your descent")}\n` : "") +
      `${UI.key("N", "Begin a new game")}</div><div class="field-guide"><span class="eyebrow">YOUR FIRST EXPEDITION</span><ol><li>Create adventurers at the Training Grounds, beyond the Edge of Town.</li><li>Assemble your party at Gilgamesh’s Tavern.</li><li>Enter the maze. Find the Amulet on level 3. Discover what waits below.</li></ol></div><p class="system-note">“Your survival is optional. Your participation is appreciated.”<br><span class="dim">— The System</span></p></div>`);
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

// Route pointer actions through the same state handlers as keyboard commands.
document.addEventListener("click", (e) => {
  const button = e.target.closest("button[data-key]");
  if (button && Game.state && Game.state.key) {
    Game.state.key(button.dataset.key, e);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  // Native form fields own their text editing. Without this guard, a name
  // typed on a phone is applied once by the input and again by the game key
  // handler.
  if (e.target && e.target.matches && e.target.matches("input, textarea, select")) return;
  // Let native button activation handle Enter/Space once, via click.
  if (e.target && e.target.closest("button") && ["Enter", " "].includes(e.key)) return;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
  if (Game.state && Game.state.key) Game.state.key(e.key.toLowerCase(), e);
});

window.addEventListener("load", () => {
  Game.go(TitleScreen);
});
