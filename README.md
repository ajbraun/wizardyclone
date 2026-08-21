# WIZARDY — Proving Grounds of the Code Overlord

A browser dungeon crawler that starts as a loving clone of *Wizardry: Proving
Grounds of the Mad Overlord* (1981) and descends into a Dungeon Crawler
Carl-flavored fever dream: an all-seeing snarky System, achievements for
everything, skills you learn by doing, loot boxes, and an endless procedurally
generated Crawl beneath the campaign dungeon.

**Play it:** open `index.html`. That's it — vanilla JS + Canvas, no build step,
no dependencies. Saves live in your browser's localStorage.

## The game

- **Classic core** — 5 races, 8 classes (roll a Ninja, we dare you), mage &
  priest spellbooks (HALITO, KATINO, DIOS...), a party of six, first-person
  wireframe maze, turn-based group combat, chests with traps, and a Temple
  that can fail your resurrection.
- **The System** — 60+ achievements with commentary, use-based skills
  (*Brawling*, *Door Shoulderer*, *Antivenin Lifestyle*), titles, loot boxes,
  and an obituary when it all goes wrong.
- **The Crawl** — beat the campaign boss on level 3 and a sealed hatch opens.
  Floors generate forever below, monsters scale with absolute depth (the world
  never rubber-bands to you), rewards scale with the level gap (punching down
  pays nothing), and System Sanctums every third floor offer rest and an
  elevator home.
- **Telegraphs & NAMED monsters** — drakes inhale and mages weave fire a round
  before it hurts; kill, sleep, or silence them first and the attack dies with
  them. Rare named elites (*Gruzzik the Damp*, regenerating) get a System
  introduction, an affix, and a guaranteed chest.
- **Floor modifiers** — half the Crawl runs under a house rule the System
  announces on arrival: BLOOD SURCHARGE, BLACKOUT, RUSH HOUR, AUDIT SEASON...
- **Things worth finding** — shrines with conditional love, System kiosks
  with convenience pricing, vaults with named guardians on retainer, and the
  remains of crawlers who almost made it.
- **The depth streak** — +10% spoils per new floor this expedition, up to
  double. Riding the elevator home forfeits it. The System mentions this
  every time, helpfully.
- **Automap** — press `M`. Fog-of-war: it only knows where you've walked.

## Controls

Keyboard-driven, like the ancients intended. Arrows/WASD to move, highlighted
letters for menus, `M` map, `C` camp, `S` the System (in castle or camp).

## Development

No toolchain. `js/` is plain script files loaded in order. Tests run headless
in Node against the real game code via simulated keystrokes:

```
node test/all.js
```

Built with [Claude Code](https://claude.com/claude-code). Original jokes only —
inspired by, not copied from, the works it tips its hat to.
