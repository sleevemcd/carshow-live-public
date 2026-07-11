function loadDummyUsers(){
  var container=document.getElementById('dummyUserList');
  if(!container)return;
  fetch('/api/dummy-users').then(function(r){return r.json()}).then(function(list){
    var html='';
    for(var i=0;i<list.length;i++){
      var u=list[i];
      html+='<div style="padding:8px 0;border-bottom:1px solid #27272a">';
      html+='<div style="display:flex;justify-content:space-between;align-items:center">';
      html+='<div><span style="font-size:13px;color:#d4d4d8">'+esc(u.username)+'</span>';
      html+='<span style="font-size:11px;color:#71717a;margin-left:8px">'+esc(u.role)+'</span></div>';
      html+='<div style="display:flex;gap:4px">';
      html+='<button class="btn-outline btn-sm" style="font-size:10px;padding:2px 8px" onclick="startEditUser(\''+u.username+'\')">Edit</button>';
      html+='<button class="btn-danger btn-sm" style="font-size:10px;padding:2px 8px" onclick="delUser(\''+u.username+'\')">Del</button>';
      html+='</div></div>';
      html+='<div style="font-size:11px;color:#52525b;margin-top:2px">📍 '+u.lat+','+u.lng+(u.offering?' | 🏷 '+u.offering:'')+'</div>';
      html+='<div style="margin-top:4px">';
      html+='<button onclick="toggleLoc(\''+u.username+'\','+(u.locationEnabled!==false)+')" style="font-size:10px;padding:2px 6px;border-radius:6px;border:1px solid '+(u.locationEnabled!==false?'#22c55e':'#ef4444')+';background:transparent;color:'+(u.locationEnabled!==false?'#22c55e':'#ef4444')+';cursor:pointer;margin-right:4px">📍 '+(u.locationEnabled!==false?'Sharing':'Off')+'</button>';
      html+='<button onclick="editOfferings(\''+u.username+'\')" style="font-size:10px;padding:2px 6px;border-radius:6px;border:1px solid '+(u.offering?'#f59e0b':'#52525b')+';background:transparent;color:'+(u.offering?'#f59e0b':'#52525b')+';cursor:pointer">🏷 '+(u.offering?'Active':'Off')+'</button>';
      html+='</div></div>';
    }
    container.innerHTML=html||'<p style="color:#52525b;text-align:center;padding:10px">No dummy users</p>';
  });
}
function startEditUser(username){
  fetch('/api/dummy-users').then(function(r){return r.json()}).then(function(list){
    for(var i=0;i<list.length;i++){if(list[i].username===username){populateEditForm(list[i]);return}}
    showError('User not found: '+username);
  });
}
function populateEditForm(u){
  var m=document.getElementById('dummyUserModal');
  if(!m){m=document.createElement('div');m.id='dummyUserModal';m.className='modal-overlay';m.style.display='none';document.body.appendChild(m)}
  m.innerHTML='<div class="modal"><h2>Edit User</h2>'
    +'<label>Username</label><input type="text" id="dummyUsername" value="'+esc(u.username)+'" disabled />'
    +'<label>Role</label><select id="dummyRole"><option value="attendee"'+sel(u.role,'attendee')+'>Attendee</option><option value="user"'+sel(u.role,'user')+'>User</option><option value="registered_user"'+sel(u.role,'registered_user')+'>Registered</option><option value="vip"'+sel(u.role,'vip')+'>VIP</option><option value="super_user"'+sel(u.role,'super_user')+'>Super User</option><option value="vendor"'+sel(u.role,'vendor')+'>Vendor</option><option value="sponsor"'+sel(u.role,'sponsor')+'>Sponsor</option></select>'
    +'<label>Display Name</label><input type="text" id="dummyDisplay" value="'+esc(u.display||'')+'" />'
    +'<label>Blurb</label><input type="text" id="dummyBlurb" value="'+esc(u.blurb||'')+'" />'
    +'<label>Car</label><input type="text" id="dummyCar" value="'+esc(u.car||'')+'" />'
    +'<label>Instagram</label><input type="text" id="dummyInsta" value="'+esc(u.instagram||'')+'" />'
    +'<label>Email</label><input type="email" id="dummyEmail" value="'+esc(u.email||'')+'" />'
    +'<label>Car Photo URL</label><input type="text" id="dummyPhoto" value="'+esc(u.car_photo||'')+'" />'
    +'<label>Lat/Lng</label><div style="display:flex;gap:8px"><input type="number" id="dummyLat" step="any" value="'+u.lat+'" style="flex:1" /><input type="number" id="dummyLng" step="any" value="'+u.lng+'" style="flex:1" /></div>'
    +'<label style="display:flex;align-items:center;gap:8px;margin-top:8px"><input type="checkbox" id="dummyLocOn" '+(u.locationEnabled!==false?'checked':'')+' /> Location sharing ON</label>'
    +'<div class="btn-row" style="margin-top:12px"><button onclick="document.getElementById(\'dummyUserModal\').style.display=\'none\'" class="btn-outline">Cancel</button><button onclick="saveEditedUser()" class="btn-primary">Save</button></div>'
    +'</div>';
  m.style.display='flex';
}
function saveEditedUser(){
  var data={
    username:document.getElementById('dummyUsername').value,
    role:document.getElementById('dummyRole').value,
    display:document.getElementById('dummyDisplay').value,
    blurb:document.getElementById('dummyBlurb').value,
    car:document.getElementById('dummyCar').value,
    instagram:document.getElementById('dummyInsta').value,
    email:document.getElementById('dummyEmail').value,
    car_photo:document.getElementById('dummyPhoto').value,
    lat:parseFloat(document.getElementById('dummyLat').value)||40.5144,
    lng:parseFloat(document.getElementById('dummyLng').value)||-111.4764,
    locationEnabled:document.getElementById('dummyLocOn').checked,
    event_id:'demo-event-1'
  };
  fetch('/api/dummy-users/'+data.username,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}).then(function(){
    document.getElementById('dummyUserModal').style.display='none';
    loadDummyUsers();
  });
}
function delUser(username){if(confirm('Delete '+username+'?')){fetch('/api/dummy-users/'+username,{method:'DELETE'}).then(function(){loadDummyUsers()})}}
function toggleLoc(username,currentlyOn){fetch('/api/dummy-users/'+username,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({locationEnabled:!currentlyOn})}).then(function(){loadDummyUsers()})}
function editOfferings(username){fetch('/api/dummy-users').then(function(r){return r.json()}).then(function(list){for(var i=0;i<list.length;i++){if(list[i].username===username){showOfferingPopup(list[i]);return}}})}
function showOfferingPopup(u){
  var cur=u.offering||'';
  var opts=['swag','giveaway','merch','poker','photo'];
  var labels={swag:'Swag',giveaway:'Giveaway',merch:'Merch',poker:'Poker',photo:'Photo'};
  function render(){var h='';for(var i=0;i<opts.length;i++){var o=opts[i];h+='<button id="offerbtn_'+o+'" style="margin:2px;padding:4px 10px;font-size:12px;border-radius:8px;border:1px solid '+(cur.indexOf(o)>=0?'#22c55e':'#52525b')+';background:'+(cur.indexOf(o)>=0?'rgba(34,197,94,0.15)':'transparent')+';color:'+(cur.indexOf(o)>=0?'#22c55e':'#a1a1aa')+';cursor:pointer">'+labels[o]+'</button>'}return h}
  var div=document.createElement('div');div.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#18181b;border:1px solid #27272a;border-radius:12px;padding:16px;z-index:9999;text-align:center';
  div.innerHTML='<p style="margin-bottom:10px;font-size:13px;color:#d4d4d8">Offerings: '+esc(u.username)+'</p><div id="offerBtns">'+render()+'</div><br><button style="margin-top:10px;padding:4px 12px;border-radius:6px;background:#4f46e5;color:#fff;border:none;cursor:pointer;font-size:12px" onclick="this.parentElement.remove()">Done</button>';
  document.body.appendChild(div);
  for(var i=0;i<opts.length;i++){(function(o){var btn=document.getElementById('offerbtn_'+o);if(btn)btn.onclick=function(){if(cur.indexOf(o)>=0){cur=cur.split(',').filter(function(x){return x!==o}).join(',')}else{cur=cur?cur+','+o:o}fetch('/api/dummy-users/'+u.username,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({offering:cur})}).then(function(){loadDummyUsers()});var btns=document.getElementById('offerBtns');if(btns)btns.innerHTML=render();for(var j=0;j<opts.length;j++){var bb=document.getElementById('offerbtn_'+opts[j]);if(bb)bb.onclick=arguments.callee}}})}(opts[i]);}
function sel(current,value){return current===value?' selected':''}
