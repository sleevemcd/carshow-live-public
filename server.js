const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ── In-memory store ────────────────────────────────────────────────

const events = [
  { id: "demo-event-1", name: "Wasatch Euro Fest 2026", description: "Utah's premier European car festival set against the stunning Wasatch Mountains. Exotics, classics, live music, food trucks, and a vendor village.", location_name: "Midway, Utah", lat: 40.5144, lng: -111.4764, radius_meters: 2000, start_date: "2026-07-10T00:00:00Z", end_date: "2026-07-12T00:00:00Z", access_code: "WEF2026", is_active: true, created_at: new Date().toISOString() },
  { id: "demo-event-2", name: "Morning Mountain Cruise", description: "Scenic drive through the Wasatch backroads.", location_name: "Alpine Loop, Utah", lat: 40.5210, lng: -111.4950, radius_meters: 800, start_date: "2026-07-11T06:00:00Z", end_date: "2026-07-11T12:00:00Z", access_code: "CRUISE", is_active: true, parent_event_id: "demo-event-1", created_at: new Date().toISOString() },
  { id: "demo-event-3", name: "Evening Car Meet & BBQ", description: "Casual evening meet with BBQ, music, and car talk.", location_name: "Midway, Utah", lat: 40.5125, lng: -111.4735, radius_meters: 600, start_date: "2026-07-11T17:00:00Z", end_date: "2026-07-11T23:00:00Z", access_code: "MEET", is_active: true, parent_event_id: "demo-event-1", created_at: new Date().toISOString() }
];

const vendors = [
  { id: "v1", user_id: "vendor1", event_id: "demo-event-1", business_name: "Prestige Wheels", description: "Custom forged wheels — on-site fitment.", tags: ["swag","merch"], is_active: true, lat: 40.5152, lng: -111.4755 },
  { id: "v2", user_id: "vendor2", event_id: "demo-event-1", business_name: "TurboKings Tuning", description: "ECU remapping, dyno runs, performance parts.", tags: ["poker_chip","giveaway"], is_active: true, lat: 40.5135, lng: -111.4775 },
  { id: "v3", user_id: "vendor3", event_id: "demo-event-1", business_name: "CarbonWerks", description: "Premium carbon fiber body kits and spoilers.", tags: ["swag","merch"], is_active: true, lat: 40.5150, lng: -111.4745 },
  { id: "v4", user_id: "vendor4", event_id: "demo-event-1", business_name: "Detail Garage", description: "Ceramic coatings, PPF, detailing demos.", tags: ["swag"], is_active: true, lat: 40.5138, lng: -111.4770 },
  { id: "v5", user_id: "vendor5", event_id: "demo-event-1", business_name: "RaceFuel Energy", description: "Official energy drink of car culture.", tags: ["poker_chip","food"], is_active: false, lat: 40.5140, lng: -111.4740 }
];

const spots = [];
const users = {};
const sockets = {};

// ── Event API ──────────────────────────────────────────────────────

app.get('/api/events', (req, res) => {
  const all = events.map(e => ({ ...e, child_count: events.filter(c => c.parent_event_id === e.id).length }));
  res.json(all);
});

app.get('/api/events/:id', (req, res) => {
  const e = events.find(ev => ev.id === req.params.id);
  if (!e) return res.status(404).json({ error: 'Not found' });
  const children = events.filter(c => c.parent_event_id === e.id);
  res.json({ ...e, children });
});

app.get('/api/events/code/:code', (req, res) => {
  const e = events.find(ev => ev.access_code === req.params.code.toUpperCase() && ev.is_active);
  if (!e) return res.status(404).json({ error: 'Invalid code' });
  res.json(e);
});

app.post('/api/events', (req, res) => {
  const { name, description, location_name, lat, lng, radius_meters, start_date, end_date, access_code, parent_event_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const e = {
    id: 'e-' + Date.now(),
    name, description: description || '', location_name: location_name || '', lat: lat || 40.5144, lng: lng || -111.4764,
    radius_meters: radius_meters || 2000, start_date: start_date || new Date().toISOString(), end_date: end_date || new Date(Date.now() + 86400000 * 3).toISOString(),
    access_code: access_code || 'E' + Date.now().toString(36).slice(-4).toUpperCase(), parent_event_id: parent_event_id || undefined,
    is_active: true, created_at: new Date().toISOString()
  };
  events.push(e);
  res.json(e);
});

app.put('/api/events/:id', (req, res) => {
  const idx = events.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  Object.assign(events[idx], req.body);
  res.json(events[idx]);
});

app.delete('/api/events/:id', (req, res) => {
  const idx = events.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  events.splice(idx, 1);
  res.json({ success: true });
});

// ── Vendor API ─────────────────────────────────────────────────────

app.get('/api/vendors/:eventId', (req, res) => {
  res.json(vendors.filter(v => v.event_id === req.params.eventId));
});

app.post('/api/vendors', (req, res) => {
  const { event_id, business_name, description, tags, lat, lng } = req.body;
  if (!event_id || !business_name) return res.status(400).json({ error: 'event_id and business_name required' });
  const v = { id: 'v-' + Date.now(), user_id: req.body.user_id || 'anon', event_id, business_name, description: description || '', tags: tags || [], is_active: true, lat: lat || 40.5144, lng: lng || -111.4764 };
  vendors.push(v);
  io.to(event_id).emit('vendorAdded', v);
  res.json(v);
});

app.put('/api/vendors/:id', (req, res) => {
  const idx = vendors.findIndex(v => v.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  Object.assign(vendors[idx], req.body);
  io.to(vendors[idx].event_id).emit('vendorUpdated', vendors[idx]);
  res.json(vendors[idx]);
});

app.delete('/api/vendors/:id', (req, res) => {
  const idx = vendors.findIndex(v => v.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const eid = vendors[idx].event_id;
  vendors.splice(idx, 1);
  io.to(eid).emit('vendorRemoved', req.params.id);
  res.json({ success: true });
});

// ── Spots API ──────────────────────────────────────────────────────

app.get('/api/spots/:eventId', (req, res) => {
  const now = Date.now();
  res.json(spots.filter(s => s.event_id === req.params.eventId && new Date(s.expires_at).getTime() > now));
});

app.post('/api/spots', (req, res) => {
  const { event_id, label, description, lat, lng, spot_type, username } = req.body;
  if (!event_id || !label || lat == null || lng == null) return res.status(400).json({ error: 'event_id, label, lat, lng required' });
  const expiry = (spot_type === 'car_spot') ? 30 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const s = { id: 's-' + Date.now(), event_id, label, description: description || '', lat, lng, spot_type: spot_type || 'spot', username: username || 'anonymous', likes: 0, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + expiry).toISOString() };
  spots.push(s);
  io.to(event_id).emit('spotAdded', s);
  res.json(s);
});

app.post('/api/spots/:id/like', (req, res) => {
  const s = spots.find(sp => sp.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  s.likes = (s.likes || 0) + 1;
  io.to(s.event_id).emit('spotLiked', { id: s.id, likes: s.likes });
  res.json({ likes: s.likes });
});

app.delete('/api/spots/:id', (req, res) => {
  const idx = spots.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const eid = spots[idx].event_id;
  spots.splice(idx, 1);
  io.to(eid).emit('spotRemoved', req.params.id);
  res.json({ success: true });
});

// ── Location API ───────────────────────────────────────────────────

app.get('/api/users/:eventId', (req, res) => {
  const list = Object.values(users).filter(u => u.event_id === req.params.event_id && u.online && u.locationEnabled).map(u => ({
    username: u.username, lat: u.lat, lng: u.lng, role: u.role
  }));
  res.json(list);
});

// ── Socket.io ──────────────────────────────────────────────────────

io.on('connection', (socket) => {

  socket.on('login', ({ username, role, event_id }) => {
    if (!username) return;
    const name = username.trim();
    if (sockets[name]) io.to(sockets[name]).emit('forceLogout', 'Logged in elsewhere');
    if (!users[name]) {
      users[name] = { username: name, role: role || 'attendee', event_id, socketId: socket.id, online: true, locationEnabled: true, lat: null, lng: null };
    } else {
      users[name].socketId = socket.id;
      users[name].online = true;
      users[name].event_id = event_id;
    }
    sockets[socket.id] = name;
    sockets[name] = socket.id;
    socket.join(event_id);
    socket.emit('loginSuccess', { username: name, role: role || 'attendee', event_id });
    io.to(event_id).emit('userJoined', { username: name, role: role || 'attendee' });
  });

  socket.on('locationUpdate', ({ lat, lng, event_id }) => {
    const username = sockets[socket.id];
    if (!username || !users[username]) return;
    users[username].lat = lat;
    users[username].lng = lng;
    if (users[username].locationEnabled) {
      io.to(event_id).emit('userLocationUpdate', { username, lat, lng, role: users[username].role });
    }
  });

  socket.on('toggleLocation', (enabled) => {
    const username = sockets[socket.id];
    if (!username || !users[username]) return;
    users[username].locationEnabled = enabled;
    io.to(users[username].event_id).emit('userLocationUpdate', {
      username, lat: enabled ? users[username].lat : null, lng: enabled ? users[username].lng : null, role: users[username].role
    });
  });

  socket.on('disconnect', () => {
    const username = sockets[socket.id];
    if (username && users[username]) {
      const eid = users[username].event_id;
      users[username].online = false;
      io.to(eid).emit('userLeft', { username });
    }
    delete sockets[socket.id];
    if (sockets[username]) delete sockets[username];
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`CarShow Live running on http://localhost:${PORT}`));
