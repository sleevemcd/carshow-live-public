// ── State ──────────────────────────────────────────────────────────
let socket;
let map;
let currentUser = null;
let currentEvent = null;
let userMarkers = {};
let vendorMarkers = {};
let spotMarkers = {};
let locationWatchId = null;

// ── Helpers ────────────────────────────────────────────────────────
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const show = (el) => el.style.display = '';
const hide = (el) => el.style.display = 'none';
const escape = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);

// ── Login ──────────────────────────────────────────────────────────
function handleLogin(role) {
  const username = $('#loginInput').value.trim();
  const code = $('#codeInput')?.value.trim().toUpperCase();
  const err = $('#loginError');
  err.textContent = '';

  if (!username || username.length < 2) { err.textContent = 'Enter a username (min 2 chars)'; return; }

  socket.emit('login', { username, role, event_id: currentEvent?.id || 'demo-event-1' });
}

function handleCodeLogin() {
  const code = $('#codeInput').value.trim().toUpperCase();
  const err = $('#loginError');
  err.textContent = '';
  if (!code) { err.textContent = 'Enter an access code'; return; }

  fetch('/api/events/code/' + code)
    .then(r => r.json())
    .then(e => {
      if (e.error) { err.textContent = e.error; return; }
      currentEvent = e;
      $('#codeSection').innerHTML = '<p style="color:#22c55e;font-size:13px;">✓ ' + escape(e.name) + '</p>';
    })
    .catch(() => { err.textContent = 'Invalid code'; });
}

function initLogin() {
  socket = io();
  socket.on('loginSuccess', (data) => {
    currentUser = data;
    hide($('#loginScreen'));
    show($('#app'));
    initMap();
  });
  socket.on('forceLogout', (msg) => {
    alert(msg);
    location.reload();
  });

  $('#loginBtn').addEventListener('click', () => handleLogin('attendee'));
  $('#loginInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin('attendee'); });

  const roles = { admin: 'Admin', organizer: 'Organizer', vendor: 'Vendor', attendee: 'Attendee' };
  Object.entries(roles).forEach(([role, label]) => {
    $(`.login-${role}`).addEventListener('click', () => handleLogin(role));
  });
}

// ── Map ─────────────────────────────────────────────────────────────
function initMap() {
  const el = $('#eventId');
  const ev = events.find(e => e.id === (currentUser.event_id || 'demo-event-1')) || events[0];
  currentEvent = ev;
  el.textContent = ev.name;
  $('#eventLoc').textContent = ev.location_name;
  document.title = ev.name + ' — CarShow';

  map = L.map('map', { zoomControl: false, attributionControl: false }).setView([ev.lat, ev.lng], 16);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19
  }).addTo(map);

  L.marker([ev.lat, ev.lng], {
    icon: L.divIcon({ className: 'event-pin', html: '<div style="width:24px;height:24px;border-radius:50%;background:#4f46e5;border:3px solid #818cf8;box-shadow:0 0 16px rgba(99,102,241,0.6);"></div>', iconSize: [24,24], iconAnchor: [12,12] })
  }).addTo(map);

  if (ev.radius_meters) {
    L.circle([ev.lat, ev.lng], { radius: ev.radius_meters, color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.05, weight: 1 }).addTo(map);
  }

  loadVendors();
  loadSpots();
  setupLocation();
  setupSocketListeners();
  initControls();
}

function initControls() {
  const role = currentUser?.role;

  if (role === 'admin') {
    show($('#adminBtn'));
    show($('#adminPanelBtn'));
    $('#adminBtn').addEventListener('click', toggleAdmin);
    $('#closeAdmin').addEventListener('click', () => hide($('#adminPanel')));
    $('#newEventBtn').addEventListener('click', openEventModal);
    loadAdminPanel();
  }

  if (role === 'vendor' || role === 'admin') {
    show($('#addVendorBtn'));
    $('#addVendorBtn').addEventListener('click', openVendorModal);
  }

  $('#shareBtn').addEventListener('click', openSpotModal);
  $('#nearbyBtn').addEventListener('click', toggleNearby);
  $('#locateBtn').addEventListener('click', () => { map.locate({ setView: true, maxZoom: 16 }); });
  $('#locationToggle').addEventListener('change', (e) => {
    socket.emit('toggleLocation', e.target.checked);
  });
  $('#closeVendorPopup').addEventListener('click', () => hide($('#vendorPopup')));
  $('#saveSpotBtn').addEventListener('click', saveSpot);
  $('#cancelSpotBtn').addEventListener('click', () => hide($('#spotModal')));
  $('#saveVendorBtn').addEventListener('click', saveVendor);
  $('#cancelVendorBtn').addEventListener('click', () => hide($('#vendorModal')));
  $('#saveEventBtn').addEventListener('click', saveEvent);
  $('#cancelEventBtn').addEventListener('click', () => hide($('#eventModal')));
  $('#spotType').addEventListener('change', function() {
    $('#spotLabel').placeholder = this.value === 'car_spot' ? 'e.g. Sick E46 M3' : 'e.g. Best photo spot';
  });
}

// ── Vendors ─────────────────────────────────────────────────────────
function loadVendors() {
  fetch('/api/vendors/' + currentEvent.id)
    .then(r => r.json())
    .then(list => {
      Object.values(vendorMarkers).forEach(m => map.removeLayer(m));
      vendorMarkers = {};
      list.forEach(addVendorMarker);
    });
}

function addVendorMarker(v) {
  if (!v.is_active) return;
  const icon = L.divIcon({
    className: '',
    html: '<div style="width:36px;height:36px;border-radius:50%;background:#f59e0b;border:2px solid #fbbf24;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 0 12px rgba(245,158,11,0.4);">🏪</div>',
    iconSize: [36, 36], iconAnchor: [18, 18]
  });
  const marker = L.marker([v.lat, v.lng], { icon })
    .addTo(map)
    .bindPopup('<b>' + escape(v.business_name) + '</b><br>' + escape(v.description) + (v.tags?.length ? '<br><small>' + v.tags.map(t => '#' + t).join(' ') + '</small>' : ''));
  marker.on('click', () => {
    $('#vpName').textContent = v.business_name;
    $('#vpDesc').textContent = v.description;
    $('#vpTags').innerHTML = (v.tags || []).map(t => '<span class="tag">' + escape(t) + '</span>').join('');
    show($('#vendorPopup'));
  });
  vendorMarkers[v.id] = marker;
}

// ── Spots ───────────────────────────────────────────────────────────
function loadSpots() {
  fetch('/api/spots/' + currentEvent.id)
    .then(r => r.json())
    .then(list => {
      Object.values(spotMarkers).forEach(m => map.removeLayer(m));
      spotMarkers = {};
      list.forEach(addSpotMarker);
    });
}

function addSpotMarker(s) {
  const isCar = s.spot_type === 'car_spot';
  const icon = L.divIcon({
    className: '',
    html: '<div style="width:28px;height:28px;border-radius:50%;background:' + (isCar ? '#f59e0b' : '#22c55e') + ';border:2px solid ' + (isCar ? '#fbbf24' : '#4ade80') + ';display:flex;align-items:center;justify-content:center;font-size:12px;">' + (isCar ? '🚗' : '📍') + '</div>',
    iconSize: [28, 28], iconAnchor: [14, 14]
  });
  const marker = L.marker([s.lat, s.lng], { icon })
    .addTo(map)
    .bindPopup('<b>' + escape(s.label) + '</b>' + (s.description ? '<br>' + escape(s.description) : '') + '<br><small>by ' + escape(s.username) + ' · ❤️ ' + (s.likes||0) + '</small>');
  marker.on('click', () => {
    fetch('/api/spots/' + s.id + '/like', { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        marker.setPopupContent('<b>' + escape(s.label) + '</b>' + (s.description ? '<br>' + escape(s.description) : '') + '<br><small>by ' + escape(s.username) + ' · ❤️ ' + data.likes + '</small>');
      });
  });
  spotMarkers[s.id] = marker;
}

// ── Location ────────────────────────────────────────────────────────
function setupLocation() {
  if (!navigator.geolocation) return;
  locationWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      socket.emit('locationUpdate', { ...loc, event_id: currentEvent.id });
      updateMyMarker(loc);
    },
    () => {},
    { enableHighAccuracy: true, maximumAge: 10000 }
  );
}

function updateMyMarker(loc) {
  if (userMarkers._me) map.removeLayer(userMarkers._me);
  const icon = L.divIcon({
    className: '',
    html: '<div style="width:16px;height:16px;border-radius:50%;background:#6366f1;border:3px solid #fff;box-shadow:0 0 8px rgba(99,102,241,0.6);"></div>',
    iconSize: [16, 16], iconAnchor: [8, 8]
  });
  userMarkers._me = L.marker([loc.lat, loc.lng], { icon }).addTo(map);
}

// ── Socket Handlers ─────────────────────────────────────────────────
function setupSocketListeners() {
  socket.on('userJoined', (u) => { /* welcome toast could go here */ });
  socket.on('userLeft', ({ username }) => {
    if (userMarkers[username]) { map.removeLayer(userMarkers[username]); delete userMarkers[username]; }
  });
  socket.on('userLocationUpdate', ({ username, lat, lng, role }) => {
    if (userMarkers[username]) map.removeLayer(userMarkers[username]);
    if (!lat || !lng) { delete userMarkers[username]; return; }
    const colors = { admin: '#dc2626', organizer: '#f59e0b', vendor: '#22c55e', attendee: '#6366f1' };
    const color = colors[role] || '#6366f1';
    const icon = L.divIcon({
      className: '',
      html: '<div style="width:14px;height:14px;border-radius:50%;background:' + color + ';border:2px solid #fff;box-shadow:0 0 6px ' + color + ';position:relative;"><div style="position:absolute;top:-14px;left:50%;transform:translateX(-50%);font-size:9px;color:#a1a1aa;white-space:nowrap;">' + escape(username) + '</div></div>',
      iconSize: [14, 14], iconAnchor: [7, 7]
    });
    userMarkers[username] = L.marker([lat, lng], { icon, zIndexOffset: 100 }).addTo(map);
  });

  socket.on('vendorAdded', (v) => { addVendorMarker(v); });
  socket.on('vendorUpdated', (v) => { if (vendorMarkers[v.id]) { map.removeLayer(vendorMarkers[v.id]); delete vendorMarkers[v.id]; } addVendorMarker(v); });
  socket.on('vendorRemoved', (id) => { if (vendorMarkers[id]) { map.removeLayer(vendorMarkers[id]); delete vendorMarkers[id]; } });

  socket.on('spotAdded', (s) => { addSpotMarker(s); });
  socket.on('spotLiked', ({ id, likes }) => {
    const m = spotMarkers[id];
    if (m) { const s = spots.find(sp => sp.id === id); if (s) s.likes = likes; }
  });
  socket.on('spotRemoved', (id) => { if (spotMarkers[id]) { map.removeLayer(spotMarkers[id]); delete spotMarkers[id]; } });
}

let showingNearby = false;
function toggleNearby() {
  showingNearby = !showingNearby;
  $('#nearbyBtn').classList.toggle('active', showingNearby);
  if (!showingNearby) {
    Object.entries(userMarkers).forEach(([k, m]) => { if (k !== '_me') { map.removeLayer(m); delete userMarkers[k]; } });
  }
}

// ── Modals ──────────────────────────────────────────────────────────
function openSpotModal() {
  show($('#spotModal'));
  $('#spotLabel').value = '';
  $('#spotDesc').value = '';
}

function saveSpot() {
  const label = $('#spotLabel').value.trim();
  if (!label) return;
  const center = map.getCenter();
  fetch('/api/spots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_id: currentEvent.id,
      label, description: $('#spotDesc').value.trim(),
      lat: center.lat, lng: center.lng,
      spot_type: $('#spotType').value,
      username: currentUser?.username || 'anon'
    })
  });
  hide($('#spotModal'));
}

function openVendorModal() {
  show($('#vendorModal'));
  $('#vendorName').value = '';
  $('#vendorDesc').value = '';
  $('#vendorLat').value = '';
  $('#vendorLng').value = '';
}

function saveVendor() {
  const name = $('#vendorName').value.trim();
  const desc = $('#vendorDesc').value.trim();
  if (!name) return;
  const center = map.getCenter();
  fetch('/api/vendors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_id: currentEvent.id,
      business_name: name, description: desc,
      lat: parseFloat($('#vendorLat').value) || center.lat,
      lng: parseFloat($('#vendorLng').value) || center.lng,
      tags: [],
      user_id: currentUser?.username || 'anon'
    })
  }).then(() => loadVendors());
  hide($('#vendorModal'));
}

function openEventModal(ev) {
  show($('#eventModal'));
  $('#eventTitle').textContent = ev ? 'Edit Event' : 'New Event';
  $('#evName').value = ev ? ev.name : '';
  $('#evDesc').value = ev ? ev.description : '';
  $('#evLoc').value = ev ? ev.location_name : '';
  $('#evLat').value = ev ? ev.lat : '';
  $('#evLng').value = ev ? ev.lng : '';
  $('#evCode').value = ev ? ev.access_code : '';
  $('#evRadius').value = ev ? ev.radius_meters : 2000;
  $('#evActive').checked = ev ? ev.is_active : true;
  $('#saveEventBtn').dataset.editId = ev ? ev.id : '';
}

function saveEvent() {
  const data = {
    name: $('#evName').value.trim(),
    description: $('#evDesc').value.trim(),
    location_name: $('#evLoc').value.trim(),
    lat: parseFloat($('#evLat').value) || 40.5144,
    lng: parseFloat($('#evLng').value) || -111.4764,
    radius_meters: parseInt($('#evRadius').value) || 2000,
    access_code: $('#evCode').value.trim() || undefined,
    is_active: $('#evActive').checked,
  };
  if (!data.name) return;
  const editId = $('#saveEventBtn').dataset.editId;
  const method = editId ? 'PUT' : 'POST';
  const url = editId ? '/api/events/' + editId : '/api/events';
  fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    .then(() => { hide($('#eventModal')); loadAdminPanel(); });
}

// ── Admin ───────────────────────────────────────────────────────────
function loadAdminPanel() {
  fetch('/api/events')
    .then(r => r.json())
    .then(list => {
      const html = list.map(e => '<div class="event-item">' +
        '<h3>' + escape(e.name) + (e.is_active ? '' : ' <span style="color:#f87171;font-size:11px;">(inactive)</span>') + '</h3>' +
        '<div class="meta">' + escape(e.location_name) + ' · code: ' + escape(e.access_code||'') + (e.child_count ? ' · ' + e.child_count + ' sub-events' : '') + '</div>' +
        '<div class="actions">' +
          '<button class="btn-outline btn-sm" onclick="openEventModalById(\'' + e.id + '\')">Edit</button>' +
          '<button class="btn-danger btn-sm" onclick="deleteEventById(\'' + e.id + '\')">Delete</button>' +
          '<button class="btn-outline btn-sm" onclick="switchToEvent(\'' + e.id + '\')">View</button>' +
        '</div>' +
      '</div>').join('');
      $('#eventList').innerHTML = html || '<p style="padding:16px;color:#71717a;">No events</p>';
    });
}

window.openEventModalById = function(id) {
  fetch('/api/events/' + id).then(r => r.json()).then(e => openEventModal(e));
};
window.deleteEventById = function(id) {
  if (confirm('Delete this event?')) {
    fetch('/api/events/' + id, { method: 'DELETE' }).then(() => loadAdminPanel());
  }
};
window.switchToEvent = function(id) {
  fetch('/api/events/' + id).then(r => r.json()).then(e => {
    currentEvent = e;
    $('#eventId').textContent = e.name;
    $('#eventLoc').textContent = e.location_name;
    map.setView([e.lat, e.lng], 16);
    loadVendors();
    loadSpots();
    hide($('#adminPanel'));
  });
};

function toggleAdmin() { $('#adminPanel').style.display = $('#adminPanel').style.display === 'none' ? '' : 'none'; loadAdminPanel(); }

// ── Init ────────────────────────────────────────────────────────────
window.addEventListener('load', initLogin);
