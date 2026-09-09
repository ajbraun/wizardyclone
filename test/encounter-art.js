"use strict";
const fs = require("fs");
const path = require("path");
const { boot, makeChecker, ROOT } = require("./harness");
const c = makeChecker("encounter-art");
function fixture() {
  const images=[], paints=[], labels=[], rects=[];
  class TestImage {
    constructor() { this.naturalWidth=1536;this.naturalHeight=1024;images.push(this); }
  }
  const context2d=new Proxy({}, {get:(_,key)=>key==="drawImage"?(...a)=>paints.push(a):key==="fillText"?t=>labels.push(t):key==="fillRect"?(...a)=>rects.push(a):()=>{},set:()=>true});
  const g=boot({Image:TestImage,context2d});
  const complete=(name,ok=true)=>{
    const image=images.find(i=>i.src && i.src.endsWith(name) && i.onload);
    if (!image) throw new Error("No pending image: "+name);
    (ok?image.onload:image.onerror)();
  };
  return {g,images,paints,labels,rects,complete};
}
const f=fixture(), {g,images,paints,labels,rects,complete}=f;
// Coverage must include every campaign monster, every generated noun, every
// adjective variant, and every Warden, not merely a few seeded encounters.
const definitions=g.get('Object.values(MONSTERS).concat(GEN_ARCH.flatMap(a=>a.nouns.flatMap(n=>GEN_ADJ.map(adj=>({name:adj+" "+n,art:a.key})))) )');
for(const def of definitions) {
  const asset=g.get(`Render.encounterArt(${JSON.stringify(def)},8)`);
  c.assert(fs.existsSync(path.join(ROOT,asset)),def.name+" has a shipped illustration");
  if(!def.id) c.assert(!asset.endsWith("/stalker.jpg") || /Stalker$/.test(def.name),def.name+" has an explicit species mapping");
}
c.assert(g.get('Render.encounterArt({name:"Iron Ghoul"},13)')==="assets/monsters/iron-ghoul.jpg","Iron Ghoul works at all depths");
c.assert(g.get('Render.encounterArt({name:"Gruzzik",base:"Iron Ghoul"},8)')==="assets/monsters/iron-ghoul.jpg","elite retains base species");
c.assert(g.get('Render.encounterArt({name:"Feral Ghoul"},8)')==="assets/monsters/ghoul.jpg","ordinary ghouls have their own illustration");
c.assert(g.get('Render.encounterArt({name:"Death Priest"},8)')==="assets/monsters/priest.jpg","death priests resolve to cleric artwork");
c.assert(g.get('Render.encounterArt({name:"Venomous Mage"},8)')==="assets/monsters/mage.jpg","venomous mages resolve to spellcaster artwork");
c.assert(g.get('Render.encounterArt({name:"Huge Spider"},8)')==="assets/monsters/spider.jpg","spiders resolve to spider artwork");
c.assert(g.get('Render.encounterArt({name:"Boring Beetle"},8)')==="assets/monsters/beetle.jpg","beetles resolve to beetle artwork");
c.assert(g.get('Render.encounterArt({name:"Dragon Fly"},8)')==="assets/monsters/dragon-fly.jpg","dragon flies resolve to dragonfly artwork");
c.assert(g.get('Render.encounterArt({id:"WARDEN13",name:"The Magistrate Below"},13)')==="assets/monsters/warden13.jpg","Magistrate has bespoke warden artwork");
c.assert(!require("fs").readFileSync("assets/monsters/priest.jpg").equals(require("fs").readFileSync("assets/monsters/rogue.jpg")),"priest art is distinct from rogue art");
c.assert(!require("fs").readFileSync("assets/monsters/mage.jpg").equals(require("fs").readFileSync("assets/monsters/rogue.jpg")),"mage art is distinct from rogue art");
g.run('Render.monsterBox({id:"D8M0",name:"Dire Hound",art:"beast"},3,{floor:8})');
c.assert(paints.length===0 && images.length===1 && labels.includes("Loading illustration…"),"pending image shows neutral loading state");
c.assert(!rects.some(a=>a[0]===160 && a[1]===34 && a[2]===240 && a[3]===252),"old pixel portrait is never drawn");
g.run('Render.monsterBox({id:"D8M0",name:"Dire Hound",art:"beast"},2,{floor:8,intent:"CHANNELING"})');
complete("hound.jpg");
c.assert(paints.length===1 && images.length===1,"reuses in-flight image request");
c.assert(labels.includes("HOSTILE CONTACT  /  2 REMAINING") && labels.includes("! CHANNELING"),"late load uses latest count and intent");
g.run('Render.monsterBox({id:"WARDEN8",name:"Mother of Thousands"},1); Render.blank("CASTLE")');
let before=paints.length;
complete("mother-of-thousands.jpg");
c.assert(paints.length===before,"late image cannot overwrite town");
g.run('Render.monsterBox({name:"Iron Ogre"},1); Render.chestBox(false)');
complete("ogre.jpg");
c.assert(paints.length===before,"late monster cannot overwrite chest");
complete("chest-closed.jpg");
c.assert(paints.length===before+1 && labels.includes("A guarded treasure chest"),"closed chest has its own scene");
g.run('Render.chestBox(true)');
complete("chest-open.jpg");
c.assert(labels.includes("The chest is yours."),"opened chest has separate artwork");
g.run('Render.monsterBox({name:"Venomous Scorpion"},1)');
complete("scorpion.jpg",false);
c.assert(labels.includes("Illustration unavailable. You can keep playing."),"failure remains playable without old artwork");
const count=images.length;
g.run('Render.monsterBox({name:"Venomous Scorpion"},1)');
c.assert(images.length===count,"failure does not cause a request storm");
// Preloading starts on floor entry, is bounded, and immediately draws an image
// that finished loading before the player meets that creature.
const p=fixture();
p.g.run('Render.preloadFloor(LEVELS[1],1)');
c.assert(p.images.filter(i=>i.src).length===3,"preloading caps concurrent downloads at three");
const requested=p.images.length;
p.g.run('Render.preloadFloor(LEVELS[1],1)');
c.assert(p.images.length===requested,"walking on one floor does not requeue its artwork");
p.complete("kobold.jpg");
p.g.run('Render.monsterBox(MONSTERS.KOBOLD,2,{floor:1})');
c.assert(p.paints.length===1 && !p.labels.includes("Loading illustration…"),"preloaded encounters draw immediately");
c.done();
