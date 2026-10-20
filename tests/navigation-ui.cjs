const fs=require('fs'),vm=require('vm'),assert=require('assert');
const s=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
const elements={};const node=()=>({textContent:'',innerHTML:'',children:[],append(...items){this.children.push(...items)},setAttribute(k,v){this[k]=v}});
const document={getElementById:id=>elements[id]??=node(),createElement:node};
let now=1800000000000;class Clock extends Date{static now(){return now}}
const context={document,Date:Clock,gpsNav:{path:[]},tripMetrics:{speed:5,lastFix:now},etaSummary:()=>({seconds:120,label:'ETA'}),distText:d=>d+' m',slowSpansOnPath:()=>[{distance:50}],voiceGuide:{enabled:true}};vm.createContext(context);
vm.runInContext(s.slice(s.indexOf('function updateTripEstimate('),s.indexOf('function slowSpansOnPath(')),context);
vm.runInContext(s.slice(s.indexOf('function syncQuickVoice('),s.indexOf("document.getElementById('quickVoice').onclick")),context);
context.updateTripEstimate(600);
assert.equal(elements.navProgress.children[0].textContent,'2 min');assert(elements.navProgress.children[1].textContent.includes('600 m'));assert(elements.navProgress.children[2].textContent.includes('Lentidão'));assert.equal(elements.tripSpeed.children[0].textContent,18);
context.syncQuickVoice();assert.equal(elements.quickVoice['aria-pressed'],'false');assert.equal(elements.quickVoice['aria-label'],'Silenciar orientações');
context.voiceGuide.enabled=false;context.syncQuickVoice();assert.equal(elements.quickVoice['aria-pressed'],'true');assert.equal(elements.quickVoice['aria-label'],'Ativar orientações');
context.stopTripEstimate('Você chegou');assert.equal(elements.navProgress.textContent,'Você chegou');assert.equal(elements.nextManeuver.textContent,'');assert.equal(elements.tripSpeed.textContent,'—');
console.log('PASS: trip card ETA/distance, speed conversion, partial closure warning, shared mute state and arrival clearing');
