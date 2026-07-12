function loadVendorDashboard(){
  var h1=document.getElementById("dashEventList");if(h1)h1.innerHTML="";
  document.getElementById("dashEventCount").textContent="Vendor Dashboard";
  document.getElementById("dashNewEventBtn").style.display="none";
  document.getElementById("dashAddVendorBtn").style.display="none";
  var un=currentUser.username;
  fetch("/api/dummy-users").then(function(r){return r.json()}).then(function(list){
    var me=list.find(function(x){return x.username===un});if(!me)return;
    var off=me.offering||"";
    var offs=["swag","giveaway","merch","poker","photo"];
    var labels={swag:"Swag",giveaway:"Giveaway",merch:"Merch",poker:"Poker",photo:"Photo"};
    var h="<h2>Your Offerings</h2><div style='display:flex;flex-wrap:wrap;gap:6px'>";
    for(var i=0;i<offs.length;i++){
      var o=offs[i];var active=off.split(",").indexOf(o)>=0;
      h+="<button onclick='toggleVendorOffer(\""+o+"\")' style='padding:8px 16px;border-radius:10px;font-size:13px;border:1px solid "+(active?"#22c55e":"#52525b")+";background:"+(active?"rgba(34,197,94,0.15)":"transparent")+";color:"+(active?"#22c55e":"#a1a1aa")+";cursor:pointer'>"+labels[o]+"</button>";
    }
    h+="</div>";
    document.getElementById("dashEventList").innerHTML=h;
  });
}
function initVendorControls(){
  document.getElementById("dashRole").textContent=currentUser.role.replace(/_/g," ")+": "+currentUser.username;
  document.getElementById("dashLogoutBtn").addEventListener("click",dashLogout);
  document.getElementById("dashNotifBtn").addEventListener("click",function(){show($("#notifModal"));loadNotifs()});
  document.getElementById("dashNewEventBtn").style.display="none";
  var vmb=document.getElementById("dashAddVendorBtn");vmb.textContent="View Map";vmb.style.display="";vmb.onclick=function(){hide($("#dashboardView"));show($("#app"));initMap()};
  var dd=document.createElement("div");
  dd.innerHTML="<div style='margin-top:20px;padding-top:16px;border-top:1px solid #27272a'><h2>🤝 Deal Poker Cards</h2><div id='vendorNearby'></div></div>";
  document.getElementById("dashEventList").appendChild(dd);
  updateVendorNearby();setInterval(updateVendorNearby,5000);
}
function toggleVendorOffer(offer){
  var un=currentUser.username;
  fetch("/api/dummy-users").then(function(r){return r.json()}).then(function(list){
    var me=list.find(function(x){return x.username===un});if(!me)return;
    var cur=(me.offering||"").split(",").filter(function(x){return x});
    var idx=cur.indexOf(offer);if(idx>=0)cur.splice(idx,1);else cur.push(offer);
    fetch("/api/dummy-users/"+un,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({offering:cur.join(",")})}).then(function(){loadVendorDashboard()});
  });
}
function updateVendorNearby(){
  if(!currentUser)return;
  fetch("/api/dummy-users").then(function(r){return r.json()}).then(function(ml){
    var me=ml.find(function(x){return x.username===currentUser.username});
    if(!me||!me.locationEnabled){document.getElementById("vendorNearby").innerHTML="<p style='color:#52525b;font-size:12px'>Enable location sharing to deal cards</p>";return}
    fetch("/api/users/"+currentUser.event_id).then(function(r){return r.json()}).then(function(all){
      var nb=[];for(var i=0;i<all.length;i++){var u=all[i];if(u.username===currentUser.username)continue;var d=Math.sqrt(Math.pow(u.lat-me.lat,2)+Math.pow(u.lng-me.lng,2));if(d<0.00002)nb.push(u)}
      var h="";for(var i=0;i<nb.length;i++){var u=nb[i];h+="<div style='padding:6px 0;border-bottom:1px solid #27272a;display:flex;justify-content:space-between'><span>"+esc(u.username)+"</span><button class='btn-primary btn-sm' onclick='dealCardToFromDash(\""+u.username+"\")'>Give Card</button></div>"}
      document.getElementById("vendorNearby").innerHTML=h||"<p style='color:#52525b;font-size:12px'>No users nearby</p>";
    });
  });
}
function dealCardToFromDash(username){
  fetch("/api/poker/collect",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:username,vendor_username:currentUser.username})}).then(function(r){return r.json()}).then(function(d){if(d.error)showError(d.error);else updateVendorNearby()});
}
