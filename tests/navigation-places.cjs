const fs=require('fs'),vm=require('vm'),assert=require('assert');
const s=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
assert(/\.maplibregl-marker\.navigation-place\s*\{[^}]*position:absolute;[^}]*top:0;left:0;[^}]*transition:none!important/.test(s),'marker root must stay out of document flow with MapLibre controlling its transform');
const element=()=>({style:{},hidden:false,className:'',children:[],setAttribute(){},append(...nodes){this.children.push(...nodes)},querySelector(sel){return this.children.find(n=>'.'+n.className===sel)}});
let updates=0,options=[],moving=false;
class Marker{constructor(o){this.el=o.element;options.push(o)}setLngLat(p){this.pos={lng:p[0],lat:p[1]};updates++;return this}getLngLat(){return this.pos}getElement(){return this.el}addTo(){return this}remove(){this.removed=true}}
const points=[{id:'a',lat:1,lon:2,name:'Subestação A',category:'Subestação'},{id:'b',lat:1,lon:2,name:'Ambulatório',category:'Ambulatório'}];
const m={getCanvas:()=>({clientWidth:390,clientHeight:844}),project:()=>({x:100,y:300}),getZoom:()=>18,isMoving:()=>moving};
const ctx={roadView:{ready:true,map:m,places:new Map()},state:{points},showLocations:true,maplibregl:{Marker},document:{createElement:element,getElementById:()=>({value:'a'})}};vm.createContext(ctx);
vm.runInContext(s.slice(s.indexOf('function navigationPlaceIcon('),s.indexOf('const originalRenderPointsForNavigation=')),ctx);
ctx.syncNavigationPlaces();assert.equal(updates,2);assert(options.every(o=>o.subpixelPositioning===true));assert.equal(ctx.roadView.places.size,2);
const a=ctx.roadView.places.get('a'),b=ctx.roadView.places.get('b');assert.equal(a.el.querySelector('.navigation-place-label').hidden,false);assert.equal(b.el.querySelector('.navigation-place-label').hidden,true);
ctx.syncNavigationPlaces();assert.equal(updates,2,'stationary places must not be repositioned every GPS/camera frame');
moving=true;m.project=()=>({x:180,y:320});ctx.layoutNavigationPlaceLabels();assert.equal(a.el.querySelector('.navigation-place-label').hidden,false);assert.equal(b.el.querySelector('.navigation-place-label').hidden,true,'collision selection stays stable during camera motion');
points[0].lon=3;ctx.syncNavigationPlaces();assert.equal(updates,3,'a coordinate edit must still move its marker');assert.equal(a.pos.lng,3);
ctx.showLocations=false;ctx.syncNavigationPlaces();assert.equal(a.el.style.display,'none');assert.equal(b.el.style.display,'none');
ctx.showLocations=true;ctx.state.points=[points[0]];moving=false;ctx.syncNavigationPlaces();assert(b.removed);assert.equal(ctx.roadView.places.size,1);
console.log('PASS: absolute geographic anchoring, subpixel motion, no redundant coordinate updates, stable moving labels, coordinate edits, visibility and deletion');
