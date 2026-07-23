function loadGPXTracks(){
  if(window._gpxLayers){window._gpxLayers.forEach(function(l){map.removeLayer(l)});}
  window._gpxLayers=[];
  var hidden=JSON.parse(localStorage.getItem('gpx_hidden')||'[]');
  fetch('/api/gpx').then(function(r){return r.json()}).then(function(tracks){
    if(!tracks||!tracks.length)return;
    var colors=['#6366f1','#22c55e','#f59e0b','#ef4444','#ec4899','#06b6d4','#a855f7'];
    tracks.forEach(function(t,i){
      if(hidden.includes(t.id))return;
      var latlngs=t.points.map(function(p){return[p[0],p[1]]});
      var poly=L.polyline(latlngs,{color:colors[i%colors.length],weight:4,opacity:0.7}).addTo(map);
      poly.bindPopup('<b>'+esc(t.name)+'</b><br>'+esc(t.description||'')+'<br><small id="gpxProg_'+t.id+'"></small>');
      poly.on('click',function(){
        document.getElementById('gpxName').textContent=t.name;
        document.getElementById('gpxDesc').textContent=t.description||'';
        var pEl=document.getElementById('gpxProg_'+t.id);
        document.getElementById('gpxStat').textContent=pEl?pEl.textContent:t.points.length+' points';
        document.getElementById('gpxPopup').style.display='block';
        if(currentUser&&window.myLocation)gpxCheck(t.id)
      });
      window._gpxLayers.push(poly);
    });
    setTimeout(function(){tracks.forEach(function(t){gpxCheck(t.id)})},3000);
  });
}
function gpxCheck(trackId){
  if(!currentUser||!myLocation)return;
  fetch('/api/gpx/progress/'+currentUser.username).then(function(r){return r.json()}).then(function(prog){
    fetch('/api/gpx').then(function(r){return r.json()}).then(function(tracks){
      var t=tracks.find(function(x){return x.id===trackId});if(!t)return;
      var closestPt=0,minD=999;
      for(var i=0;i<t.points.length;i++){
        var d=Math.sqrt(Math.pow(t.points[i][0]-myLocation.lat,2)+Math.pow(t.points[i][1]-myLocation.lng,2));
        if(d<minD){minD=d;closestPt=i}
      }
      if(minD<0.003){
        var pct=Math.round((closestPt/t.points.length)*100);
        var done=closestPt>=t.points.length-2;
        var el=document.getElementById('gpxProg_'+trackId);if(el)el.textContent=(done?'✅ Done!':pct+'% complete');
        fetch('/api/gpx/progress',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:currentUser.username,trackId:trackId,progress:pct,completed:done,pointIndex:closestPt})});
      }
    });
  });
}
