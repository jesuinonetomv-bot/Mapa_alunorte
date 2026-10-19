// Run against the local Realtime Database emulator only. Never sends mock credentials to production.
const assert=require('assert');const project='demo-alunorte-access',base='http://127.0.0.1:9000';
const jwt=uid=>{const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');return encode({alg:'none',typ:'JWT'})+'.'+encode({iss:'https://securetoken.google.com/'+project,aud:project,auth_time:Math.floor(Date.now()/1000),iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600,sub:uid,user_id:uid,firebase:{sign_in_provider:'anonymous',identities:{}}})+'.'};
async function request(path,method='GET',data,uid){const token=uid==='owner'?'owner':uid?jwt(uid):null;const response=await fetch(base+'/'+path+'.json?ns='+project+'-default-rtdb'+(token&&uid!=='owner'?'&auth='+encodeURIComponent(token):''),{method,headers:{...(uid==='owner'?{Authorization:'Bearer owner'}:{}),'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})});return {ok:response.ok,status:response.status,data:await response.json()}}
(async()=>{
 const fixture={administradores:{admin:true},mapaAcesso:{cells:{'90000_180000':{south:0,north:.001,west:0,east:.001}}},mapa:{base:{track:[[0,0],[0,.001]],points:[]},ruas:{road:{points:[[0,0],[0,.001]]}},refinamentos:{_studio:{roads:{}}}}};
 assert((await request('','PUT',fixture,'owner')).ok);
 assert(!(await request('mapa')).ok,'unauthenticated data read denied');assert(!(await request('mapa','GET',undefined,'outside')).ok,'anonymous uid alone is insufficient');
 const presence={lat:.00025,lon:.00025,accuracy:10,cell:'90000_180000',updatedAt:{'.sv':'timestamp'}};
 assert(!(await request('presencasMapa/outside','PUT',{...presence,lat:45,lon:45,cell:'90000_180000'},'outside')).ok,'coordinates cannot lie outside the nominated private cell');
 assert(!(await request('presencasMapa/outside','PUT',{...presence,cell:'unknown'},'outside')).ok,'unknown area denied');
 assert(!(await request('presencasMapa/near','PUT',{...presence,accuracy:500},'near')).ok,'imprecise GPS denied');
 assert((await request('presencasMapa/near','PUT',presence,'near')).ok,'eligible location can create a short-lived lease');
 assert((await request('mapa','GET',undefined,'near')).ok,'eligible lease can read map');
 assert(!(await request('mapaAcesso','GET',undefined,'near')).ok,'ordinary clients cannot download the private coverage');
 assert(!(await request('mapaAcesso','PUT',{},'near')).ok,'ordinary clients cannot expand their own area');
 assert(!(await request('administradores/near','PUT',true,'near')).ok,'cannot promote own admin flag');
 assert(!(await request('mapa/refinamentos/_studio','PUT',{roads:{}},'near')).ok,'only admin refines streets');
 assert((await request('mapa/bloqueios/test','PUT',{type:'test'},'near')).ok,'eligible user collaboration still works');
 assert(!(await request('presencasMapa/another','PUT',presence,'near')).ok,'cannot grant another identity a lease');
 assert(!(await request('presencasMapa/near','PUT',{...presence,updatedAt:Date.now()+1000000},'near')).ok,'cannot create future lease');
 await request('presencasMapa/near/updatedAt','PUT',Date.now()-46000,'owner');assert(!(await request('mapa','GET',undefined,'near')).ok,'expired lease blocks data');
 assert((await request('mapa','GET',undefined,'admin')).ok,'admin needs no GPS lease');assert((await request('mapa/refinamentos/_studio','PUT',{roads:{}},'admin')).ok);
 assert((await request('presencasMapa/near','DELETE',undefined,'near')).ok,'identity can revoke own lease');
 console.log('PASS: live database rules deny outside/unauthenticated/expired/imprecise/tampered access; allow nearby lease and administrator; prevent role/area escalation.');
})().catch(e=>{console.error(e);process.exit(1)});
