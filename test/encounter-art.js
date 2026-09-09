"use strict";
const fs = require("fs");
const path = require("path");
const { boot, makeChecker, ROOT } = require("./harness");
const c = makeChecker("encounter-art");
const pending = [], paints = [], labels = [];
class TestImage {
  constructor() { this.naturalWidth = 1536; this.naturalHeight = 1024; pending.push(this); }
}
const context2d = new Proxy({}, { get: (_, key) => key === "drawImage" ? (...args) => paints.push(args) : key === "fillText" ? text => labels.push(text) : () => {}, set: () => true });
const g = boot({ Image: TestImage, context2d });
for (const [name, file] of [["Dire Hound", "warrens-hound"], ["Venomous Scorpion", "warrens-scorpion"], ["Iron Ogre", "warrens-ogre"], ["Iron Ghoul", "iron-ghoul"]]) {
  const asset = g.get(`Render.encounterArt({name: ${JSON.stringify(name)}}, 8)`);
  c.assert(asset === `assets/monsters/${file}.png` && fs.existsSync(path.join(ROOT, asset)), name + " resolves to an existing species asset");
}
c.assert(g.get('Render.encounterArt({name:"Iron Ghoul"}, 13)') === "assets/monsters/iron-ghoul.png", "Iron Ghoul artwork works beyond the Warrens");
c.assert(g.get('Render.encounterArt({name:"Gruzzik", base:"Iron Ghoul"}, 8)') === "assets/monsters/iron-ghoul.png", "named Iron Ghoul retains artwork");
c.assert(g.get('Render.encounterArt({name:"Feral Ghoul"}, 8)') === null, "other ghoul variants do not inherit iron armor");
c.assert(g.get('Render.encounterArt(WARDENS[8], 8)').endsWith("mother-of-thousands.png"), "Warden has bespoke artwork");
c.assert(g.get('Render.encounterArt({name:"Gruzzik", base:"Dire Hound"}, 8)').endsWith("warrens-hound.png"), "named elite retains species artwork");
c.assert(g.get('Render.encounterArt({name:"Needle Wasp"}, 8)') === null, "uncommissioned species keeps fallback");
c.assert(g.get('Render.encounterArt({name:"Dire Hound"}, 9)') === null, "Warrens backdrop stays in correct biome");
g.run('Render.monsterBox({id:"D8M0", name:"Dire Hound", art:"beast"}, 3, {floor:8})');
c.assert(paints.length === 0 && pending.length === 1, "pending image renders fallback without blocking");
g.run('Render.monsterBox({id:"D8M0", name:"Dire Hound", art:"beast"}, 2, {floor:8, intent:"CHANNELING"})');
pending[0].onload();
c.assert(paints.length === 1 && pending.length === 1, "in-flight request is shared");
c.assert(labels.includes("HOSTILE CONTACT  /  2 REMAINING") && labels.includes("! CHANNELING"), "late load uses current count and warning");
g.run('Render.monsterBox({id:"WARDEN8", name:"Mother of Thousands", art:"bug"}, 1, {floor:8}); Render.blank("CASTLE")');
const beforeTown = paints.length;
pending[1].onload();
c.assert(paints.length === beforeTown, "late image cannot overwrite town");
g.run('Render.monsterBox({id:"D8M1", name:"Iron Ogre", art:"brute"}, 1, {floor:8}); Render.monsterBox({id:"D8M2", name:"Needle Wasp", art:"bug"}, 1, {floor:8})');
pending[2].onload();
c.assert(paints.length === beforeTown, "late image cannot overwrite another monster");
g.run('Render.monsterBox({id:"D8M3", name:"Venomous Scorpion", art:"bug"}, 1, {floor:8})');
pending[3].onerror();
g.run('Render.monsterBox({id:"D8M3", name:"Venomous Scorpion", art:"bug"}, 1, {floor:8})');
c.assert(paints.length === beforeTown && pending.length === 4, "failed image retains fallback without request storm");
g.run('Render.monsterBox({id:"WARDEN8", name:"Mother of Thousands", art:"bug"}, 1, {floor:8})');
c.assert(paints.length === beforeTown + 1 && pending.length === 4, "downloaded art is cached for later encounters");
c.done();
