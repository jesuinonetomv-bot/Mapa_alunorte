const fs=require('fs'),vm=require('vm'),assert=require('assert');const source=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
function fn(name){const start=source.indexOf('function '+name+'('),next=source.indexOf('\n}',start);return source.slice(start,next+2)}
// Helpers with single-line bodies can be read as complete lines.
const line=name=>source.split('\n').find(x=>x.startsWith('function '+name+'('));
const node=()=>({children:[],append(...a){this.children.push(...a)},textContent:'',className:''});
let writes=0,stored=null,deny=false;const ctx={console,accessGate:{allowed:true,admin:true},editor:{authorized:true},state:{points:[]},pointOverrides:{},firebaseReady:()=>true,refreshSharedPoints(){},renderPoints(){},document:{createElement:node},window:{fbMap:{user:{uid:'admin',isAnonymous:false},db:{},ref:(_,path)=>path,serverTimestamp:()=>({'.sv':'timestamp'}),runTransaction:async(path,update)=>{writes++;assert(path.startsWith('mapa/base/pointOverrides/'));if(deny)throw Error('PERMISSION_DENIED');const result=update(stored);if(result===undefined)return {committed:false};stored=result;return {committed:true,snapshot:{val:()=>stored}}}}}};vm.createContext(ctx);
for(const name of ['canManagePoints','pointOverrideKey','mergedPoints','validatePointEdit'])vm.runInContext(line(name),ctx);
vm.runInContext(fn('createPointPopup'),ctx);vm.runInContext('async '+fn('writePointOverride'),ctx);
const point={id:'seed.1',name:'SE antiga',category:'Subestação',lat:1,lon:2},remote={id:'fb-shared',firebaseId:'shared',name:'Ponto',category:'Local',lat:3,lon:4};
ctx.state.points=[point];assert.equal(ctx.createPointPopup(point.id).children[2].children.length,3);ctx.editor.authorized=false;assert.equal(ctx.createPointPopup(point.id).children[2].children.length,1);ctx.editor.authorized=true;
assert(!ctx.pointOverrideKey('a.b/c#$[]').match(/[.#$\[\]\/]/));
assert.throws(()=>ctx.validatePointEdit({name:' ',category:'Local',lat:0,lon:0}));assert.throws(()=>ctx.validatePointEdit({name:'Teste',category:'Local',lat:'',lon:0}));assert.throws(()=>ctx.validatePointEdit({name:'Teste',category:'Local',lat:91,lon:0}));
const fields=ctx.validatePointEdit({name:'  Ambulatório  ',category:'Ambulatório',lat:'1.1',lon:'2.2'});assert.equal(fields.name,'Ambulatório');assert.equal(fields.lat,1.1);
(async()=>{
ctx.editor.authorized=false;await assert.rejects(ctx.writePointOverride(point.id,fields,0));assert.equal(writes,0);ctx.editor.authorized=true;
await ctx.writePointOverride(point.id,fields,0);assert.equal(stored.revision,1);let merged=ctx.mergedPoints([point],[remote],ctx.pointOverrides);assert.equal(merged[0].name,'Ambulatório');assert.equal(merged[0].pointRevision,1);assert.equal(merged[1].firebaseId,'shared');
await assert.rejects(ctx.writePointOverride(point.id,{name:'stale'},0),/outro administrador/);assert.equal(stored.name,'Ambulatório');
await ctx.writePointOverride(point.id,{deleted:true},1);assert.equal(ctx.mergedPoints([point],[remote],ctx.pointOverrides).length,1,'deleted seed must not return on a fresh base read');
stored=null;await ctx.writePointOverride(remote.id,{deleted:true},0);assert.equal(ctx.mergedPoints([point],[remote],ctx.pointOverrides).length,0,'remote point must also stay deleted across reloads');
deny=true;const before=JSON.stringify(ctx.pointOverrides);await assert.rejects(ctx.writePointOverride('new',fields,0));assert.equal(JSON.stringify(ctx.pointOverrides),before,'server rejection cannot change local data');
const rules=JSON.parse(fs.readFileSync(require('path').join(__dirname,'../security/database.rules.json'),'utf8'));assert(rules.rules.mapa.base['.write'].includes("administradores"));assert(!rules.rules.mapa.base['.write'].includes('presencasMapa'));
console.log('PASS: admin-only popup/actions and write path; seed/shared edits and persistent deletion; input validation; stale edit conflict; denied write rollback; existing server admin rule');
})().catch(e=>{console.error(e);process.exitCode=1});
