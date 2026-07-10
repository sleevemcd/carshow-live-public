const express = require('express');
const path = require('path');

const app = express();

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

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
const HEAT_VALUES = { admin: 0, organizer: 0, sponsor: 3, vendor: 3, vip: 4, registered_user: 2, user: 1, attendee: 1 };

const demoUsers = [
  { username: "bmwfanatic", role: "registered_user", lat: 40.5140, lng: -111.4760, event_id: "demo-event-1" },
  { username: "porscheguy", role: "vip", lat: 40.5135, lng: -111.4755, event_id: "demo-event-1" },
  { username: "jdmlover", role: "user", lat: 40.5155, lng: -111.4765, event_id: "demo-event-1" },
  { username: "stancebro", role: "attendee", lat: 40.5130, lng: -111.4775, event_id: "demo-event-1" },
  { username: "v8power", role: "registered_user", lat: 40.5148, lng: -111.4750, event_id: "demo-event-1" },
  { username: "speedshop_ut", role: "sponsor", lat: 40.5152, lng: -111.4755, event_id: "demo-event-1" },
  { username: "turbokings", role: "vendor", lat: 40.5135, lng: -111.4775, event_id: "demo-event-1" },
  { username: "carbonwerks", role: "vendor", lat: 40.5150, lng: -111.4745, event_id: "demo-event-1" },
  { username: "exotic_rentals", role: "sponsor", lat: 40.5142, lng: -111.4780, event_id: "demo-event-1" },
];
const users = {};
const USERS_EXPIRY_MS = 60 * 1000;

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

app.get('/api/vendors/:eventId', (req, res) => {
  res.json(vendors.filter(v => v.event_id === req.params.eventId));
});

app.post('/api/vendors', (req, res) => {
  const { event_id, business_name, description, tags, lat, lng } = req.body;
  if (!event_id || !business_name) return res.status(400).json({ error: 'event_id and business_name required' });
  const v = { id: 'v-' + Date.now(), user_id: req.body.user_id || 'anon', event_id, business_name, description: description || '', tags: tags || [], is_active: true, lat: lat || 40.5144, lng: lng || -111.4764 };
  vendors.push(v);
  res.json(v);
});

app.put('/api/vendors/:id', (req, res) => {
  const idx = vendors.findIndex(v => v.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  Object.assign(vendors[idx], req.body);
  res.json(vendors[idx]);
});

app.delete('/api/vendors/:id', (req, res) => {
  const idx = vendors.findIndex(v => v.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  vendors.splice(idx, 1);
  res.json({ success: true });
});

app.get('/api/spots/:eventId', (req, res) => {
  const now = Date.now();
  res.json(spots.filter(s => s.event_id === req.params.eventId && new Date(s.expires_at).getTime() > now));
});

app.post('/api/spots', (req, res) => {
  const { event_id, label, description, lat, lng, spot_type, username } = req.body;
  if (!event_id || !label || lat == null || lng == null) return res.status(400).json({ error: 'event_id, label, lat, lng required' });
  const expiry = (spot_type === 'car_spot') ? 30 * 60 * 1000 : (spot_type === 'food') ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const s = { id: 's-' + Date.now(), event_id, label, description: description || '', lat, lng, spot_type: spot_type || 'spot', username: username || 'anonymous', likes: 0, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + expiry).toISOString() };
  spots.push(s);
  res.json(s);
});

app.post('/api/spots/:id/like', (req, res) => {
  const s = spots.find(sp => sp.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  s.likes = (s.likes || 0) + 1;
  res.json({ likes: s.likes });
});

app.delete('/api/spots/:id', (req, res) => {
  const idx = spots.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  spots.splice(idx, 1);
  res.json({ success: true });
});

app.post('/api/login', (req, res) => {
  const { username, role, event_id } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });
  const name = username.trim();
  const eid = event_id || 'demo-event-1';
  const ev = events.find(e => e.id === eid) || events[0];

  if (!users[name]) {
    users[name] = { username: name, role: role || 'attendee', event_id: eid, online: true, locationEnabled: true, lat: null, lng: null, last_seen: Date.now() };
  } else {
    users[name].event_id = eid;
    users[name].online = true;
    users[name].last_seen = Date.now();
  }

  res.json({ username: name, role: role || 'attendee', event: ev });
});

app.post('/api/logout', (req, res) => {
  const { username } = req.body;
  if (username && users[username]) {
    users[username].online = false;
  }
  res.json({ success: true });
});

app.post('/api/location', (req, res) => {
  const { username, lat, lng, event_id } = req.body;
  if (!username || lat == null || lng == null) return res.status(400).json({ error: 'username, lat, lng required' });
  if (users[username]) {
    users[username].lat = lat;
    users[username].lng = lng;
    users[username].last_seen = Date.now();
    users[username].online = true;
    if (event_id) users[username].event_id = event_id;
  }
  res.json({ success: true });
});

app.post('/api/location/toggle', (req, res) => {
  const { username } = req.body;
  if (!username || !users[username]) return res.status(400).json({ error: 'User not found' });
  users[username].locationEnabled = !users[username].locationEnabled;
  res.json({ locationEnabled: users[username].locationEnabled });
});

app.get('/api/users/:eventId', (req, res) => {
  const now = Date.now();
  const real = Object.values(users).filter(u =>
    u.event_id === req.params.eventId && u.online && u.locationEnabled && (now - u.last_seen < USERS_EXPIRY_MS)
  ).map(u => ({
    username: u.username, lat: u.lat, lng: u.lng, role: u.role, heat: HEAT_VALUES[u.role] || 1
  }));
  const demo = demoUsers.filter(u => u.event_id === req.params.eventId)
    .map(u => ({ username: u.username, lat: u.lat, lng: u.lng, role: u.role, heat: HEAT_VALUES[u.role] || 1 }));
  res.json([...real, ...demo]);
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`CarShow Live running on http://localhost:${PORT}`));
}

module.exports = app;
