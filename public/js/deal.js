function openDeal(){show($("#dealModal"));loadNearbyUsers()}
function loadNearbyUsers(){
  if(!myLocation){$("#nearbyUsers").html('<p style="color:#52525b;text-align:center">Enable location sharing to see nearby users</p>');return}
  fetch("/api/users/"+currentEvent.id).then(function(r){return r.json()}).then(function(all){
    var nearby=[];
    for(var i=0;i<all.length;i++){
      var u=all[i];
      if(u.username===currentUser.username)continue;
      var d=Math.sqrt(Math.pow(u.lat-myLocation.lat,2)+Math.pow(u.lng-myLocation.lng,2));
      if(d<0.00002) nearby.push(u);
    }
    var html="";
    for(var i=0;i<nearby.length;i++){
      var u=nearby[i];
      html+='<div style="padding:8px 0;border-bottom:1px solid #27272a;display:flex;justify-content:space-between;align-items:center"><span style="font-size:13px;color:#d4d4d8">'+esc(u.username)+'</span><button class="btn-primary btn-sm" onclick="dealCardTo(\''+u.username+'\')">Deal Card</button></div>';
    }
    $("#nearbyUsers").html(html||'<p style="color:#52525b;text-align:center">No users nearby</p>');
  });
}
function dealCardTo(username){
  fetch("/api/poker/collect",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:username,vendor_username:currentUser.username})})
  .then(function(r){return r.json()}).then(function(d){
    if(d.error){showError(d.error)}else{loadNearbyUsers()}
  });
}
