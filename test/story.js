"use strict";
const { boot, makeChecker } = require("./harness");
const { assert, done } = makeChecker("story");
function party(g) {
  g.click("n");
  g.run(`
    for (let i = 0; i < 6; i++) {
      const ch = newChar('Crew' + i, 'Human', 'Good', {STR:16,IQ:12,PIE:12,VIT:14,AGI:12,LUK:10}, 'Fighter');
      ch.level = 2; ch.hp = ch.maxhp = 22;
      ch.items.push({id:'LONGSWORD',eq:true}, {id:'CHAINMAIL',eq:true});
      Game.party.push(ch); Game.roster.push(ch);
    }
    Game.maze = {level:1,x:9,y:18,f:0,light:0};
    Game.go(MazeScreen);
  `);
}
function visit(g, id) {
  g.run(`Object.assign(Game.maze, SHIFT_SITES[${JSON.stringify(id)}]); Game.go(MazeScreen)`);
  g.click("enter");
  assert(g.get("Game.state === StoryScreen"), id + " opens by touch");
}
const g = boot();
party(g);
g.click("arrowup");
assert(g.get("Game.state === StoryScreen && StoryScreen.site === 'mara'"), "walking north discovers Mara");
g.click("1");
assert(g.get("Story.state().met && Game.party[0].items.some(i => i.id === 'P_DIOS')"), "accepting quest supplies the party");
g.click("1");
assert(g.get("Game.party[0].items.filter(i => i.id === 'P_DIOS').length") === 1, "supply reward cannot repeat");
g.click("j");
assert(g.els.panel.innerHTML.includes("west storeroom"), "journal gives an actionable objective");
g.click("l"); g.click("l");

// Story placements are reachable on the unchanged map; no stair is replaced.
g.run(`
  var reachable = new Set(['9,18']), queue = [[9,18]];
  while (queue.length) {
    const [x,y] = queue.shift();
    cellWalls(L1,x,y).forEach((wall,dir) => {
      const nx=x+DIRS[dir].dx, ny=y+DIRS[dir].dy, key=nx+','+ny;
      if (wall !== 1 && nx >= 0 && nx < 20 && ny >= 0 && ny < 20 && !reachable.has(key)) {
        reachable.add(key); queue.push([nx,ny]);
      }
    });
  }
`);
assert(g.get("Object.values(SHIFT_SITES).every(p => reachable.has(p.x+','+p.y))"), "every chapter location is reachable");
assert(g.get("L1.specials['18,1'].t === 'down' && L1.specials['9,18'].t === 'up'"), "both stairs remain accessible");

visit(g, "pell"); g.click("1"); g.click("1");
assert(g.get("Story.state().rescued && Game.party[0].items.filter(i => i.id === 'Q_PATCH').length === 1"), "rescue grants exactly one dressing");
visit(g, "ledger"); g.click("1");
visit(g, "cache"); g.click("2"); g.click("1");
assert(g.get("Story.state().cache === 'Q_SPLINT' && !Game.party[0].items.some(i => i.id === 'Q_LANTERN')"), "supply choice excludes the other reward");

// Continue from the saved chapter with flags and inventory intact.
const restored = boot({store:g.store}); restored.click("c");
assert(restored.get("Story.state().rescued && Story.state().ledger && Story.state().cache === 'Q_SPLINT'"), "chapter state survives a fresh browser boot");
visit(restored, "foreman"); restored.click("2");
assert(restored.get("Combat.groups.length === 1 && Combat.groups[0].def.id === 'SHIFT_FOREMAN'"), "rescue and evidence remove both supporters");
assert(!restored.get("Story.state().defeated"), "starting the fight does not complete the quest");
// Play the authored fight through real touch controls, including message screens.
for (let turn=0; turn<400 && restored.get("Game.state === CombatScreen"); turn++) {
  const phase = restored.get("Combat.phase"), sub=restored.get("Combat.sub");
  if (phase === "msg") restored.click("enter");
  else if (phase === "chest") restored.click("l");
  else if (sub !== "action") restored.click("1");
  else restored.click(restored.get("Combat.inputIdx < 3") ? "f" : "p");
}
assert(restored.get("Story.state().defeated && Game.state === MazeScreen"), "equipped level 2 party finishes the fight by touch");
visit(restored, "mara"); restored.click("1"); restored.click("1");
assert(restored.get("Story.state().outcome === 'expose' && Game.party[0].items.filter(i => i.id === 'Q_SEAL').length === 1"), "exposure ending gives its unique reward once");

// Alternative choices, fleeing/retrying, and existing saves.
for (const [approach, key, item] of [["fight","1","Q_SEVERANCE"],["coverup","3","Q_SIGNET"]]) {
  const h=boot(); party(h);
  h.run("Game.flags.boss=true; Game.flags.warden8=true; Game.flags.seed=123; Story.state().ledger=true;");
  visit(h,"foreman"); h.click(key);
  assert(h.get("Combat.groups.length") === 3, "unrescued worker leaves both supporters");
  h.run("Combat.endTo='maze'; Combat.afterMsgs();");
  assert(!h.get("Story.state().defeated"), "escaping leaves the quest retryable");
  visit(h,"foreman"); h.click(key);
  h.run("Combat.groups.forEach(g => g.members.forEach(m => m.hp=0)); Combat.victory();");
  visit(h,"mara"); h.click("1");
  assert(h.get(`Story.state().outcome === '${approach}' && Game.party[0].items.some(i=>i.id==='${item}')`), approach + " has its own reward");
  h.run("Game.save(); Game.load();");
  assert(h.get("Game.flags.boss && Game.flags.warden8 && Game.flags.seed === 123"), "legacy progress remains intact");
  h.click("1");
  assert(h.get(`Game.party[0].items.filter(i=>i.id==='${item}').length`) === 1, "reloaded reward cannot be duplicated");
}

// Enemy mechanics: predictable tells, counters, bounded summons and healing.
const h=boot(); party(h);
h.run("Combat.start({encounter:[['SHIFT_BELL',1]],story:'test'}); Combat.msgs=[];");
assert(h.get("Combat.groups[0].intent.kind === 'rally'"), "bell is announced before input");
h.run("Combat.groups[0].silenced=true; Combat.monsterAct(Combat.groups[0],Combat.groups[0].members[0]);");
assert(h.get("Combat.groups.length") === 1, "silence prevents reinforcements");
h.run(`
  Combat.groups[0].silenced=false;
  for (let round=0;round<8;round+=2) {
    Combat.round=round; Combat.rollIntents();
    Combat.monsterAct(Combat.groups[0],Combat.groups[0].members[0]);
  }
`);
assert(h.get("Combat.groups.length === 3 && Combat.reinforcements === 2"), "reinforcements cannot grow without limit");
h.run(`
  Combat.start({encounter:[['SHIFT_MEDIC',1],['SHIFT_FOREMAN',1]],story:'test'});
  var patient=Combat.groups[1].members[0]; patient.hp=patient.maxhp-1;
  Combat.monsterAct(Combat.groups[0],Combat.groups[0].members[0]);
`);
assert(h.get("patient.hp === patient.maxhp"), "healer cannot exceed rolled maximum HP");
h.run(`
  Combat.start({encounter:[['SHIFT_HOUND',1]],story:'test'});
  Game.party.forEach(c=>{c.hp=22;c.parry=true;});
  Combat.monsterAct(Combat.groups[0],Combat.groups[0].members[0]);
`);
assert(h.get("Game.party.slice(0,3).every(c=>c.hp===22) && Game.party.slice(3).some(c=>c.hp<22) && Game.party.every(c=>c.hp>=20)"), "hound targets back row and respects parry");
h.run(`
  Combat.start({encounter:[['SHIFT_SLIME',1]],story:'test'});
  Game.party.forEach(c=>{c.hp=22;c.parry=true;});
  Combat.monsterAct(Combat.groups[0],Combat.groups[0].members[0]);
`);
assert(h.get("Game.party.every(c=>c.hp===21)"), "slime flare is party-wide and defendable");

// Item abilities execute in combat and reset per battle.
h.run(`
  Game.party[0].items.push({id:'Q_PATCH',eq:true});
  Combat.start({encounter:[['SHIFT_FOREMAN',1]],story:'test'});
  Game.party[0].hp=10;
  Combat.partyAct({ch:Game.party[0],type:'parry'});
  Combat.partyAct({ch:Game.party[0],type:'parry'});
`);
assert(h.get("Game.party[0].hp") === 12, "dressing heals only once per battle");
h.run(`
  Combat.start({encounter:[['SHIFT_FOREMAN',1]],story:'test'});
  Combat.partyAct({ch:Game.party[0],type:'parry'});
  Game.party[0].items.forEach(i=>{if(ITEMS[i.id].slot==='weapon')i.eq=false;});
  Game.party[0].items.push({id:'Q_SEVERANCE',eq:true});
  var target=Combat.groups[0]; target.members[0].hp=10000;
  var oldChance=chance; chance=()=>true;
  Combat.partyAct({ch:Game.party[0],type:'fight',group:target});
  chance=oldChance;
`);
assert(h.get("Game.party[0].hp") === 14, "dressing refreshes in a new battle");
assert(h.get("target.intentDone && Combat.itemInterrupted.has(Game.party[0].id)"), "blade interrupts a pending attack on hit");
h.run(`
  target.intentDone=false;
  var oldChance2=chance; chance=()=>true;
  Combat.partyAct({ch:Game.party[0],type:'fight',group:target});
  chance=oldChance2;
`);
assert(!h.get("target.intentDone"), "blade interrupt cannot repeat within the same battle");
assert(h.get("itemCard({id:'Q_PATCH'}).includes('first Parry')"), "item inspection explains special effects");
// The entire path from camp to equipping/trading a reward is available by touch.
h.run("Game.go(MazeScreen)"); h.click("c"); h.click("i");
assert(h.els.panel.innerHTML.includes('data-key="1"'), "camp renders touch member selectors");
h.click("1"); h.click("e");
const patchKey=h.get("LETTERS[Game.party[0].items.findIndex(i=>i.id==='Q_PATCH')]");
assert(h.els.panel.innerHTML.includes(`data-key="${patchKey}"`), "equipment has a touch action for the reward");
h.click(patchKey);
assert(!h.get("Game.party[0].items.find(i=>i.id==='Q_PATCH').eq"), "touch toggles equipment");
h.click(patchKey); h.click("l"); h.click("t"); h.click(patchKey);
assert(h.els.panel.innerHTML.includes('data-key="b"'), "trade recipients are tappable");
h.click("b");
assert(h.get("Game.party[1].items.some(i=>i.id==='Q_PATCH' && !i.eq)"), "reward trades to a different member by touch");
done();
