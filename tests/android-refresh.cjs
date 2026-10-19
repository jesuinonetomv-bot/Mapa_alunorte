const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.join(__dirname,'..'),source=fs.readFileSync(path.join(root,'android/app/src/main/java/br/com/mapaalunorte/MainActivity.java'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),version=JSON.parse(fs.readFileSync(path.join(root,'app-version.json'),'utf8'));
assert.equal(html.match(/name="mapa-revision" content="([^"]+)"/)[1],version.revision,'app checker must match published HTML revision');
const busy=source.match(/evaluateJavascript\("(Boolean\(\(typeof cleanNav[^"\n]+)"/)[1];
const run=vars=>vm.runInNewContext(busy,vars);
assert.equal(run({}),false);assert.equal(run({cleanNav:{started:false},recording:false,studio:{dirty:false},editor:{active:false},blockMode:false}),false);
for(const vars of [{cleanNav:{started:true}},{recording:true},{studio:{dirty:true}},{editor:{active:true}},{blockMode:true}])assert.equal(run(vars),true,'automatic reload must protect live work');
assert(source.includes('WebSettings.LOAD_NO_CACHE'));assert(source.includes('Cache-Control","no-cache, no-store'));assert(!source.includes('WebStorage.getInstance().deleteAllData'));assert(!source.includes('removeAllCookies'));console.log('PASS: publication revision, idle reload and protection for navigation/recording/drafts/block editing');
