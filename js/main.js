"use strict";
const SAVE_KEY = "wizardy_save_v1";
const Game = {
  roster: [], party: [], maze: null, flags: {}, state: null,
  go(screen) {
    this.state = screen;
    if (screen.enter) screen.enter();
    screen.draw();
    UI.renderParty();
  },
  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        roster: this.roster,
        party: this.party.map(c => c.id),
        maze: this.maze,
        flags: this.flags,
        nextId: _charId,
      }));
    } catch (e) { /* private mode etc. */ }
  },
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      this.roster = data.roster || [];
      this.party = (data.party || []).map(id => this.roster.find(c => c.id === id)).filter(Boolean);
      this.maze = data.maze || null;
      this.flags = data.flags || {};
      _charId = data.nextId || (Math.max(0, ...this.roster.map(c => c.id)) + 1);
      return true;
    } catch (e) { return false; }
  },
  hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } },
  newGame() {
    this.roster = []; this.party = []; this.maze = null; this.flags = {};
    _charId = 1;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  },
};

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
