"use strict";
const fs = require("fs");
const path = require("path");
const { boot, makeChecker, ROOT } = require("./harness");
const c = makeChecker("maze-render");
const images = [], draws = [], fills = [];
let fillStyle;
const context2d = new Proxy({}, {
  get: (_, key) => key === "drawImage" ? (...args) => draws.push(args) : key === "fill" ? () => fills.push(fillStyle) : () => {},
  set: (_, key, value) => { if (key === "fillStyle") fillStyle = value; return true; },
});
class TestImage {
  constructor() { this.naturalWidth = this.naturalHeight = 1024; images.push(this); }
}
const g = boot({ Image: TestImage, context2d });
g.run('var fixture = M(5,5); border(fixture); bv(fixture,2,0,4); bv(fixture,3,0,4); fixture.hw[1][2]=2; var before=JSON.stringify(fixture); Render.draw(fixture,2,3,0,3)');
c.assert(images.length === 1 && fs.existsSync(path.join(ROOT,images[0].src)), "stone texture loads once from a shipped asset");
c.assert(draws.length === 0 && fills.includes("#171511"), "fallback renders masonry and a timber doorway before loading");
images[0].onload();
c.assert(draws.some(a => a.length === 5) && draws.some(a => a.length === 9), "loaded texture covers front and perspective side walls");
for (let direction=0;direction<4;direction++) {
  g.run(`fixture.hw[3][2]=2; fixture.hw[4][2]=2; fixture.vw[3][2]=2; fixture.vw[3][3]=2; Render.draw(fixture,2,3,${direction},4)`);
}
c.assert(draws.every(args => args.slice(1).every(Number.isFinite)), "texture coordinates are finite in all directions including adjacent walls");
c.assert(draws.every(args => args.length===5 ? args[3]>0 && args[4]>0 : args[3]>0 && args[4]>0 && args[7]>0 && args[8]>0), "texture rectangles have positive dimensions");
c.assert(images.length === 1, "movement reuses the texture");
// A separate boot isolates a genuinely pending download from cached art.
const h = boot({ Image: TestImage, context2d });
h.run('var fixture=M(3,3); border(fixture); var before=JSON.stringify(fixture); Render.draw(fixture,1,1,0,3); Render.blank("CASTLE")');
let count=draws.length;
images[1].onload();
c.assert(draws.length===count, "late texture cannot overwrite town");
c.assert(h.get('JSON.stringify(fixture)===before'), "rendering leaves wall and door data untouched");
const k = boot({ Image: TestImage, context2d });
k.run('var fixture=M(3,3); border(fixture); Render.draw(fixture,1,1,0,3); Render.drawMap(fixture,{},1,1,0)');
count=draws.length;
images[2].onload();
c.assert(draws.length===count, "late texture cannot overwrite automap");
const l = boot({ Image: TestImage, context2d });
l.run('var fixture=M(3,3); border(fixture); Render.draw(fixture,1,1,0,3); Render.monsterBox({id:"x",name:"Needle Wasp",art:"bug"},1,{floor:8})');
count=draws.length;
images[3].onload();
c.assert(draws.length===count, "late texture cannot overwrite a combat portrait");
const failed = boot({ Image: TestImage, context2d });
failed.run('var fixture=M(3,3); border(fixture); Render.draw(fixture,1,1,0,3)');
const failedTexture=images[images.length-1];
const imageCount=images.length;
failedTexture.onerror();
failed.run('Render.draw(fixture,1,1,1,3)');
c.assert(images.length===imageCount, "failed download retains fallback without retrying every move");
c.done();
