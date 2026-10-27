const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'i18n.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const baseline=require('./preserved-content.json');
function boot(saved,blocked=false) {
 let click;
 const values={};
 const keys=[...html.matchAll(/data-i18n="([^"]+)"/g)].map(m=>m[1]);
 const els=keys.map(key=>({dataset:{i18n:key},set innerHTML(v){values[key]=v}}));
 const attrKeys=[...html.matchAll(/data-i18n-attr="([^"]+)"/g)].map(m=>m[1]);
 const attrEls=attrKeys.map(key=>({dataset:{i18nAttr:key},setAttribute(k,v){values[key]=v}}));
 const titles=[...html.matchAll(/data-player-title="([^"]+)"/g)].map(m=>m[1]);
 const players=titles.map(title=>({dataset:{playerTitle:title},setAttribute(k,v){this[k]=v}}));
 const buttons=['en','de','fr'].map(language=>({dataset:{language},setAttribute(k,v){this[k]=v}}));
 const root={};
 const doc={documentElement:root,title:'',querySelectorAll:s=>s==='[data-i18n]'?els:s==='[data-i18n-attr]'?attrEls:s==='[data-player-title]'?players:s==='[data-language]'?buttons:[],addEventListener:(n,f)=>{click=f}};
 vm.runInNewContext(source,{document:doc,localStorage:{getItem(){if(blocked)throw Error();return saved},setItem(k,v){if(blocked)throw Error();saved=v}}});
 return {root,values,buttons,players,click:language=>click({target:{closest:()=>buttons.find(b=>b.dataset.language===language)}}),saved:()=>saved};
}
test('English default, switching to DE/FR, persistence and active state',()=>{
 const app=boot(null);assert.equal(app.root.lang,'en');assert.match(app.values.bioLead,/virtual AI artist/);
 app.click('fr');assert.equal(app.root.lang,'fr');assert.equal(app.saved(),'fr');assert.match(app.values.bioLead,/artiste virtuelle/);
 assert.equal(boot(app.saved()).root.lang,'fr');
 app.click('de');assert.equal(app.root.lang,'de');assert.match(app.values.bioLead,/KI-Künstlerin/);
 assert.deepEqual(app.buttons.map(b=>b['aria-pressed']),['false','true','false']);
});
test('invalid saved language and denied browser storage',()=>{
 for(const invalid of ['ar-TN','__proto__','constructor','',null])assert.equal(boot(invalid).root.lang,'en');
 const app=boot(null,true);app.click('fr');assert.equal(app.root.lang,'fr');
});
test('complete messages, metadata and accessible player labels in every language',()=>{
 for(const language of ['en','de','fr']){
  const app=boot(language);
  assert.equal(app.root.dir,'ltr');
  for(const [key,value] of Object.entries(app.values)){assert.equal(typeof value,'string',key);assert.ok(value.length,key);assert.ok(!value.includes('undefined'),key)}
  assert.equal(app.players.length,7);
  assert.ok(app.players.every(p=>p.title.endsWith(p.dataset.playerTitle)));
 }
 assert.equal(boot('en').values.paused,'Temporarily discontinued');
 assert.equal(boot('de').values.paused,'Vorübergehend eingestellt');
 assert.equal(boot('fr').values.paused,'Suspendu temporairement');
});
test('all existing links, media URLs, song titles and seven players are preserved',()=>{
 const urls=[...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(m=>m[1]).filter(url=>url!=='./i18n.js');
 assert.deepEqual(urls,baseline.urls);
 assert.deepEqual([...html.matchAll(/<h3>(0[1-7] [^<]+)<\/h3>/g)].map(m=>m[1]),baseline.titles);
 assert.equal((html.match(/<iframe /g)||[]).length,7);
 const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
 for(const url of urls.filter(url=>url.startsWith('#')))assert.ok(ids.has(url.slice(1)),url);
});
