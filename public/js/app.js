let map, currentUser=null, currentEvent=null, heatLayer=null;
let userMarkers={}, vendorMarkers={}, spotMarkers={}, pollingTimers=[];
let showingNearby=false, locationWatchId=null, myLocation=null;

const $=s=>document.querySelector(s), show=el=>el.style.display='block', hide=el=>el.style.display='none';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);

function handleLogin(role){
  var email=$('#loginEmail').value.trim();
  if(!email||email.length<3){var u=role+'_'+Math.random().toString(36).slice(2,8);email=u+'@demo.com'}
  var eid=currentEvent?.id||'demo-event-1';
  $('#loginError').textContent='';
  fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:email.split('@')[0],role,event_id:eid})})
  .then(r=>r.json()).then(data=>{
    if(data.error){$('#loginError').textContent=data.error;return}
    currentUser={username:data.username,role:data.role,event_id:data.event.id};
    currentEvent=data.event;
    hide($('#loginScreen'));
    if(currentUser.role==='admin'){show($('#dashboardView'));loadDashboardEvents();initDashboardControls()}
    else{show($('#app'));initMap()}
  }).catch(()=>{$('#loginError').textContent='Login failed'});
}

function initLogin(){
  $('#loginBtn').addEventListener('click',()=>handleLogin('user'));
  $('#loginEmail').addEventListener('keydown',e=>{if(e.key==='Enter')handleLogin('user')});
  ['admin','organizer','sponsor','vendor','vip','registered_user','user'].forEach(r=>{$('.login-'+r).addEventListener('click',()=>handleLogin(r))});
}

function showError(msg){
  var el=document.createElement('div');
  el.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#18181b;border:1px solid #27272a;border-radius:12px;padding:20px;z-index:9999;color:#f4f4f5;text-align:center;font-size:14px';
  el.innerHTML='<p>'+msg+'</p><button onclick="this.parentElement.remove()" style="margin-top:8px;padding:6px 14px;border-radius:8px;background:#4f46e5;color:#fff;border:none;cursor:pointer">OK</button>';
  document.body.appendChild(el);
}

function initMap(){
  try{
    var ev=currentEvent;
    if(!ev){showError('No event data');return}
    if(typeof L==='undefined'){showError('Map library not loaded');return}
    if(map){try{map.remove()}catch(e){}map=null}
    $('#eventId').textContent=ev.name;$('#eventLoc').textContent=ev.location_name;
    document.title=ev.name+' — CarShow';
    map=L.map('map',{zoomControl:false,attributionControl:false}).setView([ev.lat,ev.lng],16);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:19}).addTo(map);
    L.marker([ev.lat,ev.lng],{icon:L.divIcon({className:'',html:'<div style="width:24px;height:24px;border-radius:50%;background:#4f46e5;border:3px solid #818cf8;box-shadow:0 0 16px rgba(99,102,241,0.6)"></div>',iconSize:[24,24],iconAnchor:[12,12]})}).addTo(map);
    if(ev.radius_meters) L.circle([ev.lat,ev.lng],{radius:ev.radius_meters,color:'#6366f1',fillColor:'#6366f1',fillOpacity:0.05,weight:1}).addTo(map);
    setupHeatmap();
    loadVendors();loadSpots();setupLocation();setupPolling();initControls();
  }catch(e){showError('Map error: '+e.message)}
}

function initControls(){
  var role=currentUser?.role;
  $('#backBtn').addEventListener('click',goBack);
  if(role==='admin'){
    show($('#adminPanelBtn'));
    $('#adminPanelBtn').addEventListener('click',toggleAdmin);
    $('#closeAdmin').addEventListener('click',()=>hide($('#adminPanel')));
    $('#newEventBtn').addEventListener('click',openEventModal);
    $('#addVendorAdminBtn').addEventListener('click',openVendorModal);
    loadAdminPanel();
  }
  $('#shareBtn').addEventListener('click',openSpotModal);
  $('#locateBtn').addEventListener('click',()=>{
    if(!navigator.geolocation){useDefaultLocation();return}
    navigator.geolocation.getCurrentPosition(p=>{
      var loc={lat:p.coords.latitude,lng:p.coords.longitude};
      myLocation=loc;updateMyMarker(loc);map.setView([loc.lat,loc.lng],15);
    },()=>{useDefaultLocation();map.setView([currentEvent.lat,currentEvent.lng],15)},{enableHighAccuracy:false,timeout:8000,maximumAge:120000})
  });
  $('#locationToggle').addEventListener('change',()=>{
    fetch('/api/location/toggle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:currentUser.username})});
  });
  $('#closeVendorPopup').addEventListener('click',()=>hide($('#vendorPopup')));
  $('#saveSpotBtn').addEventListener('click',saveSpot);
  $('#cancelSpotBtn').addEventListener('click',()=>hide($('#spotModal')));
  $('#saveVendorBtn').addEventListener('click',saveVendor);
  $('#cancelVendorBtn').addEventListener('click',()=>hide($('#vendorModal')));
  $('#saveEventBtn').addEventListener('click',saveEvent);
  $('#cancelEventBtn').addEventListener('click',()=>hide($('#eventModal')));
}

function loadVendors(){fetch('/api/vendors/'+currentEvent.id).then(r=>r.json()).then(list=>{Object.values(vendorMarkers).forEach(m=>map.removeLayer(m));vendorMarkers={};list.forEach(addVendorMarker)})}
function addVendorMarker(v){if(!v.is_active)return;var icon=L.divIcon({className:'',html:'<div style="width:40px;height:40px;border-radius:10px;background:#18181b;border:2px solid #fbbf24;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 0 12px rgba(245,158,11,0.4);overflow:hidden"><span>🏪</span></div>',iconSize:[40,40],iconAnchor:[20,20]});var m=L.marker([v.lat,v.lng],{icon}).addTo(map).bindPopup('<b>'+esc(v.business_name)+'</b><br>'+esc(v.description)+(v.tags?.length?'<br><small>'+v.tags.map(t=>'#'+t).join(' ')+'</small>':''));m.on('click',()=>{$('#vpName').textContent=v.business_name;$('#vpDesc').textContent=v.description;$('#vpTags').innerHTML=(v.tags||[]).map(t=>'<span class="tag">'+esc(t)+'</span>').join('');show($('#vendorPopup'))});vendorMarkers[v.id]=m}
function loadSpots(){fetch('/api/spots/'+currentEvent.id).then(r=>r.json()).then(list=>{Object.values(spotMarkers).forEach(m=>map.removeLayer(m));spotMarkers={};list.forEach(addSpotMarker)})}
function addSpotMarker(s){var isCar=s.spot_type==='car_spot';var icon=L.divIcon({className:'',html:'<div style="width:28px;height:28px;border-radius:50%;background:'+(isCar?'#f59e0b':'#22c55e')+';border:2px solid '+(isCar?'#fbbf24':'#4ade80')+';display:flex;align-items:center;justify-content:center;font-size:12px">'+(isCar?'🚗':'📍')+'</div>',iconSize:[28,28],iconAnchor:[14,14]});var m=L.marker([s.lat,s.lng],{icon}).addTo(map).bindPopup('<b>'+esc(s.label)+'</b>'+(s.description?'<br>'+esc(s.description):'')+'<br><small>by '+esc(s.username)+' · ❤️ '+(s.likes||0)+'</small>');m.on('click',()=>{fetch('/api/spots/'+s.id+'/like',{method:'POST'}).then(r=>r.json()).then(d=>{if(spotMarkers[s.id])s.likes=d.likes;m.setPopupContent('<b>'+esc(s.label)+'</b>'+(s.description?'<br>'+esc(s.description):'')+'<br><small>by '+esc(s.username)+' · ❤️ '+d.likes+'</small>')})});spotMarkers[s.id]=m}

function updateMyMarker(loc){
  if(!map||!loc)return;
  var rc={admin:'#dc2626',organizer:'#f59e0b',sponsor:'#f59e0b',vendor:'#22c55e',vip:'#ec4899',registered_user:'#6366f1',user:'#06b6d4',attendee:'#06b6d4'};
  var c=rc[currentUser?.role]||'#6366f1';
  var icon=L.divIcon({className:'',html:'<div style="width:20px;height:20px;border-radius:50%;background:'+c+';border:3px solid #fff;box-shadow:0 0 12px '+c+';position:relative"><div style="position:absolute;top:-16px;left:50%;transform:translateX(-50%);font-size:10px;color:#a5b4fc;white-space:nowrap;font-weight:600">YOU</div></div>',iconSize:[20,20],iconAnchor:[10,10]});
  if(userMarkers._me){map.removeLayer(userMarkers._me)}
  userMarkers._me=L.marker([loc.lat,loc.lng],{icon,zIndexOffset:200}).addTo(map);
}

function setupLocation(){
  if(!navigator.geolocation){useDefaultLocation();return}
  function gp(p){myLocation={lat:p.coords.latitude,lng:p.coords.longitude};updateMyMarker(myLocation);fetch('/api/location',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:currentUser.username,...myLocation,event_id:currentEvent.id})});locationWatchId=setInterval(function(){navigator.geolocation.getCurrentPosition(function(pp){myLocation={lat:pp.coords.latitude,lng:pp.coords.longitude};updateMyMarker(myLocation)},function(){},{enableHighAccuracy:false,timeout:15000,maximumAge:60000})},30000)}
  function tg(n){navigator.geolocation.getCurrentPosition(gp,function(){if(n>0)setTimeout(function(){tg(n-1)},5000);else useDefaultLocation()},{enableHighAccuracy:false,timeout:20000,maximumAge:0})}
  tg(2)
}
function useDefaultLocation(){var l={lat:currentEvent.lat,lng:currentEvent.lng+0.001};myLocation=l;updateMyMarker(l);fetch('/api/location',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:currentUser.username,...l,event_id:currentEvent.id})})}
function setupHeatmap(){if(typeof L.heatLayer!=='function')return;heatLayer=L.heatLayer([],{radius:30,blur:20,maxZoom:10,max:4,gradient:{0.2:'#4f46e5',0.4:'#6366f1',0.6:'#22c55e',0.8:'#f59e0b',1:'#ef4444'}}).addTo(map)}
function setupPolling(){pollingTimers.push(setInterval(pollUsers,5000));pollingTimers.push(setInterval(pollVendors,10000));pollingTimers.push(setInterval(pollSpots,10000))}
function pollUsers(){
  if(!currentEvent)return;
  fetch('/api/users/'+currentEvent.id).then(r=>r.json()).then(list=>{
    var heatPoints=[];
    var ids=new Set(list.map(u=>u.username));
    Object.keys(userMarkers).forEach(k=>{if(k!=='_me'&&!ids.has(k)){map.removeLayer(userMarkers[k]);delete userMarkers[k]}});
    var showRoles=['sponsor','vendor','vip'];
    var rc={sponsor:'#f59e0b',vendor:'#22c55e',vip:'#ec4899'};
    list.forEach(u=>{
      if(u.username===currentUser.username)return;
      if(u.lat&&u.lng&&u.heat) heatPoints.push([u.lat,u.lng,u.heat]);
      if(showRoles.includes(u.role)){
        var c=rc[u.role]||'#6366f1';
        var isVip=u.role==='vip';
        var icon=L.divIcon({className:'',html:'<div style="width:'+(isVip?36:40)+'px;height:'+(isVip?36:40)+'px;border-radius:'+(isVip?'50%':'10px')+';background:#18181b;border:2px solid '+c+';display:flex;align-items:center;justify-content:center;font-size:'+(isVip?18:20)+'px;box-shadow:0 0 8px '+c+';position:relative"><div style="position:absolute;top:-14px;left:50%;transform:translateX(-50%);font-size:9px;color:#a1a1aa;white-space:nowrap">'+esc(u.username)+'</div>'+(isVip?'👤':(u.role==='vendor'?'🏪':'⭐'))+'</div>',iconSize:[isVip?36:40,isVip?36:40],iconAnchor:[isVip?18:20,isVip?18:20]});
        if(userMarkers[u.username]){userMarkers[u.username].setLatLng([u.lat,u.lng])}else{userMarkers[u.username]=L.marker([u.lat,u.lng],{icon,zIndexOffset:100}).addTo(map)}
      }
    });
    if(heatLayer&&heatPoints.length)heatLayer.setLatLngs(heatPoints);
  });
}

function pollVendors(){if(!currentEvent)return;fetch('/api/vendors/'+currentEvent.id).then(r=>r.json()).then(list=>{var ids=new Set(list.filter(v=>v.is_active).map(v=>v.id));Object.keys(vendorMarkers).forEach(id=>{if(!ids.has(id)){map.removeLayer(vendorMarkers[id]);delete vendorMarkers[id]}});list.filter(v=>v.is_active).forEach(v=>{if(vendorMarkers[v.id]){var m=vendorMarkers[v.id];if(m.getLatLng().lat!==v.lat||m.getLatLng().lng!==v.lng)m.setLatLng([v.lat,v.lng])}else addVendorMarker(v)})})}
function pollSpots(){if(!currentEvent)return;fetch('/api/spots/'+currentEvent.id).then(r=>r.json()).then(list=>{var ids=new Set(list.map(s=>s.id));Object.keys(spotMarkers).forEach(id=>{if(!ids.has(id)){map.removeLayer(spotMarkers[id]);delete spotMarkers[id]}});list.forEach(s=>{if(spotMarkers[s.id]){var m=spotMarkers[s.id];if(m.getLatLng().lat!==s.lat||m.getLatLng().lng!==s.lng)m.setLatLng([s.lat,s.lng])}else addSpotMarker(s)})})}

function openSpotModal(){
  if(!myLocation){showError('Your location is not available yet. Please wait or allow location access.');return}
  show($('#spotModal'));$('#spotLabel').value='';$('#spotDesc').value='';
}
function saveSpot(){
  var label=$('#spotLabel').value.trim();
  if(!label||!myLocation)return;
  fetch('/api/spots',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event_id:currentEvent.id,label,description:$('#spotDesc').value.trim(),lat:myLocation.lat,lng:myLocation.lng,spot_type:$('#spotType').value,username:currentUser?.username||'anon'})});
  hide($('#spotModal'));
}

function openVendorModal(){show($('#vendorModal'));$('#vendorName').value='';$('#vendorDesc').value='';$('#vendorLat').value='';$('#vendorLng').value=''}
function saveVendor(){var name=$('#vendorName').value.trim();if(!name)return;var c=map.getCenter();fetch('/api/vendors',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event_id:currentEvent.id,business_name:name,description:$('#vendorDesc').value.trim(),lat:parseFloat($('#vendorLat').value)||c.lat,lng:parseFloat($('#vendorLng').value)||c.lng,tags:[],user_id:currentUser?.username||'anon'})}).then(()=>pollVendors());hide($('#vendorModal'))}
function openEventModal(ev){show($('#eventModal'));$('#eventTitle').textContent=ev?'Edit Event':'New Event';$('#evName').value=ev?ev.name:'';$('#evDesc').value=ev?ev.description:'';$('#evLoc').value=ev?ev.location_name:'';$('#evStart').value=ev?ev.start_date.slice(0,16):'';$('#evEnd').value=ev?ev.end_date.slice(0,16):'';$('#evLat').value=ev?ev.lat:'';$('#evLng').value=ev?ev.lng:'';$('#evCode').value=ev?ev.access_code:'';$('#evRadius').value=ev?ev.radius_meters:2000;$('#evParent').value=ev?ev.parent_event_id||'':'';$('#evActive').checked=ev?ev.is_active:true;$('#saveEventBtn').dataset.editId=ev?ev.id:''}
function saveEvent(){var data={name:$('#evName').value.trim(),description:$('#evDesc').value.trim(),location_name:$('#evLoc').value.trim(),lat:parseFloat($('#evLat').value)||40.5144,lng:parseFloat($('#evLng').value)||-111.4764,radius_meters:parseInt($('#evRadius').value)||2000,access_code:$('#evCode').value.trim()||undefined,parent_event_id:$('#evParent').value.trim()||undefined,start_date:new Date($('#evStart').value||Date.now()).toISOString(),end_date:new Date($('#evEnd').value||Date.now()+86400000*3).toISOString(),is_active:$('#evActive').checked};if(!data.name)return;var eid=$('#saveEventBtn').dataset.editId;var m=eid?'PUT':'POST';var u=eid?'/api/events/'+eid:'/api/events';fetch(u,{method:m,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}).then(()=>{hide($('#eventModal'));loadDashboardEvents();loadAdminPanel()})}
function loadAdminPanel(){fetch('/api/events').then(r=>r.json()).then(list=>{var master=list.filter(e=>!e.parent_event_id);$('#adminEventCount').textContent=master.length;$('#eventList').innerHTML=master.map(e=>'<div class="event-item"><h3>'+esc(e.name)+(e.is_active?'':' <span style="color:#f87171;font-size:11px">(inactive)</span>')+'</h3><div class="meta">'+esc(e.location_name)+' · code: '+esc(e.access_code||'')+'</div><div class="actions"><button class="btn-outline btn-sm" onclick="openEventModalById(\''+e.id+'\')">Edit</button><button class="btn-danger btn-sm" onclick="deleteEventById(\''+e.id+'\')">Delete</button><button class="btn-outline btn-sm" onclick="switchToEvent(\''+e.id+'\')">View</button></div></div>').join('')||'<p style="padding:16px;color:#71717a">No events</p>'})}
function loadDashboardEvents(){fetch('/api/events').then(r=>r.json()).then(list=>{var master=list.filter(e=>!e.parent_event_id);var sub=list.filter(e=>e.parent_event_id);$('#dashEventCount').textContent=master.length+' events';$('#dashEventList').innerHTML=master.map(e=>{var children=sub.filter(c=>c.parent_event_id===e.id);var childHtml=children.length?'<div style="margin-top:4px;padding-left:12px;border-left:2px solid #27272a">'+children.map(c=>'<div style="font-size:12px;padding:4px 0;display:flex;justify-content:space-between"><span style="color:#a1a1aa">↳ '+esc(c.name)+'</span><span style="color:#52525b;font-size:11px">'+esc(c.location_name)+'</span></div>').join('')+'</div>':'';return'<div class="event-item"><h3>'+esc(e.name)+(e.is_active?'':' <span style="color:#f87171;font-size:11px">(inactive)</span>')+'</h3><div class="meta">'+esc(e.location_name)+' · code: '+esc(e.access_code||'')+(children.length?' · '+children.length+' sub-events':'')+'</div>'+childHtml+'<div class="actions"><button class="btn-outline btn-sm" onclick="openEventModalById(\''+e.id+'\')">Edit</button><button class="btn-danger btn-sm" onclick="deleteEventById(\''+e.id+'\')">Delete</button><button class="btn-outline btn-sm" onclick="switchToEventFromDash(\''+e.id+'\')">View Map</button></div></div>';}).join('')||'<p style="padding:16px;color:#71717a">No events</p>'})}
window.openEventModalById=id=>fetch('/api/events/'+id).then(r=>r.json()).then(e=>openEventModal(e));
window.deleteEventById=id=>{if(confirm('Delete?'))fetch('/api/events/'+id,{method:'DELETE'}).then(()=>{loadDashboardEvents();loadAdminPanel()})};
window.switchToEvent=id=>fetch('/api/events/'+id).then(r=>r.json()).then(e=>{currentEvent=e;$('#eventId').textContent=e.name;$('#eventLoc').textContent=e.location_name;if(map)try{map.remove()}catch(ex){};map=null;initMap();hide($('#adminPanel'))});
window.switchToEventFromDash=id=>fetch('/api/events/'+id).then(r=>r.json()).then(e=>{currentEvent=e;hide($('#dashboardView'));show($('#app'));initMap()});
function toggleAdmin(){var p=$('#adminPanel');p.style.display=(p.style.display==='none'||p.style.display==='')?'block':'none';if(p.style.display==='block')loadAdminPanel()}
function initDashboardControls(){$('#dashRole').textContent='Signed in as '+currentUser.username;$('#dashLogoutBtn').addEventListener('click',dashLogout);$('#dashNewEventBtn').addEventListener('click',openEventModal);$('#dashAddVendorBtn').addEventListener('click',openVendorModal)}
function goBack(){if(currentUser&&currentUser.role==='admin'){hide($('#app'));show($('#dashboardView'));loadDashboardEvents();return}dashLogout()}
function dashLogout(){if(currentUser)fetch('/api/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:currentUser.username})});pollingTimers.forEach(clearInterval);if(locationWatchId)navigator.geolocation.clearWatch(locationWatchId);if(map){try{Object.values(userMarkers).forEach(m=>map.removeLayer(m));Object.values(vendorMarkers).forEach(m=>map.removeLayer(m));Object.values(spotMarkers).forEach(m=>map.removeLayer(m));map.remove()}catch(e){}}userMarkers={};vendorMarkers={};spotMarkers={};pollingTimers=[];showingNearby=false;currentUser=null;currentEvent=null;map=null;myLocation=null;hide($('#app'));hide($('#dashboardView'));show($('#loginScreen'))}
window.addEventListener('beforeunload',()=>{if(currentUser)navigator.sendBeacon('/api/logout',JSON.stringify({username:currentUser.username}));pollingTimers.forEach(clearInterval)});
window.addEventListener('load',initLogin);
