const accessGate={allowed:false,admin:false,identityReady:false,generation:0,watch:null,lastFix:null,lastFixAt:0,lastGrantAt:0,grantedCell:null,pending:false,unsubscribers:[]};
function gateStatus(message){document.getElementById('gateStatus').textContent=message}
function disconnectMapData(){for(const unsubscribe of accessGate.unsubscribers.splice(0))try{unsubscribe()}catch(e){}firebaseListening=false}
function clearPrivateMap(){
 closePointEditor();pointOverrides={};disconnectMapData();
 if(typeof clearRoute==='function')clearRoute();
 recording=false;activeTraceIndex=null;studio.dirty=false;studio.selected=null;studio.points=[];studio.roads={};studio.layers=[];studio.handles=[];studio.undo=[];studio.redo=[];studio.base=null;studio.tool='select';editor.base=null;editor.versions=null;editor.undo=[];editor.active=false;editor.selected=null;editor.handles=[];rawRoads={};roadRevisions={};remotePlaces=[];SEED_TRACK=[];SEED_POINTS=[];
 state={traces:[],points:[],blockedEdges:[],recordedCount:0,drawnRoadIds:[],remoteRoadIds:[]};pointLayers=[];roadLayers=[];
 if(blockStartMarker)map.removeLayer(blockStartMarker);if(blockEndMarker)map.removeLayer(blockEndMarker);if(blockPreviewLayer)map.removeLayer(blockPreviewLayer);blockStartMarker=blockEndMarker=blockPreviewLayer=null;blockTraceIndex=null;blockMode=false;editingBlockGroup=null;
 document.getElementById('blockEditor').classList.remove('on');document.body.classList.remove('editing-block');
 for(const layer of [gpsNav.remainingLine,gpsNav.remainingBorder,gpsNav.travelledLine])if(layer)layer.setLatLngs([]);gpsNav.remainingLine=null;gpsNav.remainingBorder=null;gpsNav.travelledLine=null;map.dragging.enable();map.eachLayer(layer=>map.removeLayer(layer));gpsMarker=null;accuracyLayer=null;gpsNav.arrow=null;gpsNav.slowLayer=null;gpsNav.follow=false;map._gpsCenteredOnce=false;map._accessCentered=false;
 if(typeof roadView!=='undefined'){if(roadView.map)roadView.map.remove();roadView.map=null;roadView.ready=false;roadView.loading=null;roadView.places.clear();roadView.marker=null;roadView.destinationMarker=null;roadView.roadsHash=null}
 for(const id of ['pointsList','blocksList','studioRoadList','recordUsers'])document.getElementById(id).innerHTML='';
 document.getElementById('searchDest').value='';document.getElementById('searchOrigin').value='Minha localização (GPS)';for(const id of ['originSuggestions','destSuggestions']){document.getElementById(id).innerHTML='';document.getElementById(id).hidden=true}document.getElementById('studioName').value='';
 document.getElementById('origin').innerHTML='<option value="gps">Minha localização (GPS)</option>';document.getElementById('dest').innerHTML='<option value="">Escolha o destino</option><option value="gps">Minha localização (GPS)</option>';
 try{localStorage.removeItem(STORAGE_KEY);localStorage.removeItem('mapa_alunorte_last_position')}catch(e){}
}
function lockMapAccess(message,revoke=true){
 const wasAllowed=accessGate.allowed;accessGate.allowed=false;accessGate.grantedCell=null;accessGate.lastGrantAt=0;
 document.body.classList.add('access-locked');document.getElementById('accessGate').hidden=false;gateStatus(message);
 if(wasAllowed)clearPrivateMap();
 if(revoke&&window.fbMap?.ready&&!accessGate.admin)window.fbMap.remove(window.fbMap.ref(window.fbMap.db,'presencasMapa/'+window.fbMap.uid)).catch(()=>{});
}
function unlockMapAccess(){
 if(accessGate.allowed)return;accessGate.allowed=true;document.body.classList.remove('access-locked');document.getElementById('accessGate').hidden=true;document.getElementById('permissionOverlay').style.display='none';
 if(!map.hasLayer(baseMap))baseMap.addTo(map);map.invalidateSize();startFirebaseListeners();
 if(accessGate.lastFix&&Date.now()-(accessGate.lastFix.timestamp||0)<15000)acceptPosition(accessGate.lastFix,true);
}
async function verifyAccessIdentity(){
 const generation=++accessGate.generation;accessGate.admin=false;accessGate.identityReady=false;editor.authorized=false;
 lockMapAccess('Verificando autorização…',false);
 const f=window.fbMap;if(!f?.ready||!f.user){gateStatus('Conectando ao serviço de acesso…');return}
 try{const snapshot=await f.get(f.ref(f.db,'administradores/'+f.uid));if(generation!==accessGate.generation)return;
  accessGate.admin=snapshot.val()===true;accessGate.identityReady=true;editor.authorized=accessGate.admin;
  if(accessGate.admin){unlockMapAccess();return}
  gateStatus('Acesso restrito à proximidade das vias da refinaria. Valide uma localização atual para continuar.');
  if(accessGate.lastFix)authorizeMapPosition(accessGate.lastFix);
 }catch(e){if(generation===accessGate.generation)lockMapAccess('Não foi possível verificar o acesso. Conecte-se à internet e tente novamente.',false)}
}
function startAccessLocation(){
 if(!navigator.geolocation){gateStatus('Este aparelho não oferece localização. Somente o administrador pode entrar sem GPS.');return}
 gateStatus('Validando localização atual…');
 if(accessGate.watch!==null)navigator.geolocation.clearWatch(accessGate.watch);
 accessGate.watch=navigator.geolocation.watchPosition(p=>{
  accessGate.lastFix=p;accessGate.lastFixAt=performance.now();
  if(accessGate.admin){acceptPosition(p,false);return}
  authorizeMapPosition(p);
 },e=>{if(!accessGate.admin)lockMapAccess(e.code===1?'Sem permissão de localização. Acesso ao mapa bloqueado.':'Sem localização atual confirmada. Acesso ao mapa bloqueado.');},{enableHighAccuracy:true,maximumAge:0,timeout:15000});
}
async function authorizeMapPosition(p){
 if(accessGate.admin){unlockMapAccess();return}
 if(!accessGate.identityReady||!window.fbMap?.ready||accessGate.pending)return;
 const lat=p.coords.latitude,lon=p.coords.longitude,accuracy=p.coords.accuracy;
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||!Number.isFinite(accuracy)||accuracy<=0||accuracy>100||!p.timestamp||Math.abs(Date.now()-p.timestamp)>15000){lockMapAccess('GPS impreciso ou desatualizado. Aguarde uma localização atual com precisão de até 100 m.');return}
 const cell=accessCellFor(lat,lon);
 if(accessGate.allowed&&cell===accessGate.grantedCell&&performance.now()-accessGate.lastGrantAt<10000){acceptPosition(p,false);return}
 const f=window.fbMap,generation=accessGate.generation;accessGate.pending=true;
 try{
  await f.set(f.ref(f.db,'presencasMapa/'+f.uid),{lat,lon,accuracy,cell,updatedAt:f.serverTimestamp()});
  f.onDisconnect(f.ref(f.db,'presencasMapa/'+f.uid)).remove().catch(()=>{});
  if(generation!==accessGate.generation)return;
  const latest=accessGate.lastFix;if(!latest||Math.abs(Date.now()-latest.timestamp)>15000)return;
  if(accessCellFor(latest.coords.latitude,latest.coords.longitude)!==cell)return;
  accessGate.lastGrantAt=performance.now();accessGate.grantedCell=cell;unlockMapAccess();acceptPosition(latest,false);
 }catch(e){if(generation===accessGate.generation)lockMapAccess(e.code&&String(e.code).toLowerCase().includes('permission')?'Fora da área permitida. O mapa e o cálculo de rotas estão bloqueados.':'Não foi possível confirmar a proximidade no servidor. O mapa permanece bloqueado.');}
 finally{accessGate.pending=false;if(generation===accessGate.generation&&accessGate.lastFix&&accessCellFor(accessGate.lastFix.coords.latitude,accessGate.lastFix.coords.longitude)!==cell)authorizeMapPosition(accessGate.lastFix)}
}
function listenMap(path,callback){const f=window.fbMap;const unsubscribe=f.onValue(f.ref(f.db,path),snapshot=>{if(accessGate.allowed)callback(snapshot)},()=>{if(!accessGate.admin)lockMapAccess('A autorização de acesso expirou. Confirme novamente a localização.');else gateStatus('Falha de acesso ao banco. Confira as regras do administrador.')});accessGate.unsubscribers.push(unsubscribe)}
async function syncAccessCoverage(){
 if(!accessGate.admin||!editor.authorized)return;
 const paths=[SEED_TRACK,...Object.entries(rawRoads).map(([id,r])=>roadRevisions[id]?.points||r.points||[]),...Object.values(studio.roads).map(studioGeometry)];
 const cells=buildAccessCells(paths);if(!Object.keys(cells).length)throw Error('Não há vias suficientes para atualizar a área de acesso.');
 const f=window.fbMap;await f.set(f.ref(f.db,'mapaAcesso'),{cells,radius:3000,step:ACCESS_GRID_STEP,updatedAt:new Date().toISOString()});
}
document.getElementById('gateGps').onclick=startAccessLocation;
document.getElementById('gateAdminButton').onclick=()=>{document.getElementById('gateAdminForm').hidden=!document.getElementById('gateAdminForm').hidden};
document.getElementById('gateAdminForm').onsubmit=async e=>{e.preventDefault();const password=document.getElementById('gatePassword');try{if(!window.fbMap?.ready)throw Error();await window.fbMap.login(document.getElementById('gateEmail').value.trim(),password.value);await verifyAccessIdentity();if(!accessGate.admin)gateStatus('Esta conta não tem permissão de administrador. O acesso comum exige localização próxima.')}catch(e){gateStatus('Não foi possível entrar. Confira a conta, a senha e a conexão.')}finally{password.value=''}};
window.addEventListener('map-auth-changed',verifyAccessIdentity);
setInterval(()=>{if(accessGate.allowed&&!accessGate.admin&&(performance.now()-accessGate.lastFixAt>15000||performance.now()-accessGate.lastGrantAt>40000))lockMapAccess('A confirmação de localização expirou. Aguarde um novo sinal GPS.');},2000);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!accessGate.admin)lockMapAccess('Valide sua localização atual para voltar ao mapa.');else if(!document.hidden&&accessGate.watch!==null)startAccessLocation()});

