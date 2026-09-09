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
- **Biome bands & Wardens** — every five floors is a place with its own name,
  phosphor tint, and monster leanings: the Warrens, the Drowned Court, the
  Bone Orchard, the Furnace Levels, the Silent Archive, the Root. A hand-built
  Warden seals the bottom of each band; break the seal to open the next band
  and extend the elevator. Past floor 33 lies the After. Good luck.
- **Things worth finding** — shrines with conditional love, System kiosks
  with convenience pricing, vaults with named guardians on retainer, and the
  remains of crawlers who almost made it.
- **The depth streak** — +10% spoils per new floor this expedition, up to
  double. Riding the elevator home forfeits it. The System mentions this
  every time, helpfully.
- **The System Store** — spend your winnings on loot boxes priced by your
  deepest floor. "Gambling is illegal. This is a surprise mechanic."
  Elevator rides now bill a modest toll; the stairs remain free, and
  character-building.
- **Automap** — press `M`. Fog-of-war: it only knows where you've walked.

## Controls

Click highlighted menu actions or use their keyboard shortcuts. Arrows/WASD to move, `M` map, `C` camp, `S` the System (in castle or camp).

The interface adapts to narrow screens, with readable party health meters and a
System broadcast log. Character naming and some detailed selections still use
the keyboard.

## Encounter artwork

The Warrens (floors 4–8) now has illustrated encounters for hounds, scorpions,
and ogres, including their named elite variants, plus bespoke art for its Warden,
Mother of Thousands. Scenes fill the viewport and show the surviving group count
and any announced attack. Other species keep their original portraits; those also
serve as the fallback while images load or if an image fails to load.

Open `test/encounter-preview.html` to view the four scenes without touching a save.
Assets and their generation prompts are in `assets/monsters/`. Images are fetched
on demand and cached for the session. No save migration or balance changes.

## Development

No toolchain. `js/` is plain script files loaded in order. Tests run headless
in Node against the real game code via simulated keystrokes:

```
node test/all.js
```

Built with [Claude Code](https://claude.com/claude-code). Original jokes only —
inspired by, not copied from, the works it tips its hat to.
