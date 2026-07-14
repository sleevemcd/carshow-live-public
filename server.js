const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '10mb' }));

const DATA_DIR = '/data';
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch(e) {}

// Simple password hash (for MVP - swap with bcrypt for production)
function hash(pw){ var h=0;for(var i=0;i<pw.length;i++){h=((h<<5)-h)+pw.charCodeAt(i);h|=0}return 'h_'+Math.abs(h).toString(36)}
function saveData(name, obj) {
  try { fs.writeFileSync(path.join(DATA_DIR, name + '.json'), JSON.stringify(obj, null, 2)); } catch(e) {}
}
function loadData(name, fallback) {
  try {
    var fp = path.join(DATA_DIR, name + '.json');
    var raw = fs.readFileSync(fp, 'utf8');
    var data = JSON.parse(raw);
    console.log('Loaded '+name+': '+data.length+' items from '+fp);
    return data;
  } catch(e) {
    console.log('Fallback for '+name+': '+e.message);
    return fallback;
  }
}

const events = loadData('events', [
  { id: "demo-event-1", name: "Wasatch Euro Fest 2026", description: "Utah's premier European car festival set against the stunning Wasatch Mountains. Exotics, classics, live music, food trucks, and a vendor village.", location_name: "Midway, Utah", lat: 40.5144, lng: -111.4764, radius_meters: 2000, start_date: "2026-07-10T00:00:00Z", end_date: "2026-07-12T00:00:00Z", access_code: "WEF2026", is_active: true, created_at: new Date().toISOString() },
  { id: "demo-event-2", name: "Morning Mountain Cruise", description: "Scenic drive through the Wasatch backroads.", location_name: "Alpine Loop, Utah", lat: 40.5210, lng: -111.4950, radius_meters: 800, start_date: "2026-07-11T06:00:00Z", end_date: "2026-07-11T12:00:00Z", access_code: "CRUISE", is_active: true, parent_event_id: "demo-event-1", created_at: new Date().toISOString() },
  { id: "demo-event-3", name: "Evening Car Meet & BBQ", description: "Casual evening meet with BBQ, music, and car talk.", location_name: "Midway, Utah", lat: 40.5125, lng: -111.4735, radius_meters: 600, start_date: "2026-07-11T17:00:00Z", end_date: "2026-07-11T23:00:00Z", access_code: "MEET", is_active: true, parent_event_id: "demo-event-1", created_at: new Date().toISOString() }
]);

const vendors = loadData("vendors", [
  { id: "v1", user_id: "vendor1", event_id: "demo-event-1", business_name: "Prestige Wheels", description: "Custom forged wheels — on-site fitment.", tags: ["swag","merch"], is_active: true, lat: 40.5152, lng: -111.4755 },
  { id: "v2", user_id: "vendor2", event_id: "demo-event-1", business_name: "TurboKings Tuning", description: "ECU remapping, dyno runs, performance parts.", tags: ["poker_chip","giveaway"], is_active: true, lat: 40.5135, lng: -111.4775 },
  { id: "v3", user_id: "vendor3", event_id: "demo-event-1", business_name: "CarbonWerks", description: "Premium carbon fiber body kits and spoilers.", tags: ["swag","merch"], is_active: true, lat: 40.5150, lng: -111.4745 },
  { id: "v4", user_id: "vendor4", event_id: "demo-event-1", business_name: "Detail Garage", description: "Ceramic coatings, PPF, detailing demos.", tags: ["swag"], is_active: true, lat: 40.5138, lng: -111.4770 },
  { id: "v5", user_id: "vendor5", event_id: "demo-event-1", business_name: "RaceFuel Energy", description: "Official energy drink of car culture.", tags: ["poker_chip","food"], is_active: false, lat: 40.5140, lng: -111.4740 }
])

const spots = loadData("spots", [
  { id: "spot-1", event_id: "demo-event-1", label: "Best Tacos in Town", description: "Incredible al pastor", lat: 40.5145, lng: -111.4775, spot_type: "food", username: "foodie_cars", likes: 15, expires_at: new Date(Date.now() + 7*86400000).toISOString() },
  { id: "spot-2", event_id: "demo-event-1", label: "Sick E46 M3", description: "Laguna Seca Blue, CSL intake", lat: 40.5138, lng: -111.4760, spot_type: "car_spot", username: "bmwfanatic", likes: 12, expires_at: new Date(Date.now() + 1800000).toISOString() },
  { id: "spot-3", event_id: "demo-event-1", label: "Mountain View Photo Spot", description: "Epic Wasatch backdrop", lat: 40.5155, lng: -111.4780, spot_type: "spot", username: "photogear", likes: 8, expires_at: new Date(Date.now() + 86400000).toISOString() },
])

function saveAll(){ saveData('events',events);saveData('demoUsers',demoUsers);saveData('spots',spots);saveData('vendors',vendors);saveData('notifications',notifications);saveData('pokerHands',pokerHands);saveData('accounts',accounts);saveData('gpxTracks',gpxTracks);saveData('gpxProgress',gpxProgress); }
app.use((req, res, next) => { res.on('finish', () => { if (['POST','PUT','DELETE'].includes(req.method)) saveAll(); }); next(); });
setTimeout(saveAll,5000);
app.get('/api/status', (req, res) => {
  res.json({ dataDir: DATA_DIR, events: events.length, users: demoUsers.length, spots: spots.length, sample: demoUsers.slice(0, 2) });
});

app.get('/api/update', (req, res) => {
  const { exec } = require('child_process');
  exec('cd /app && git pull && npm install', (err, stdout) => {
    res.json({ ok: !err, output: stdout || (err ? err.message : 'updated') });
  });
});

// Force calendar sync
app.get('/api/sync', async (req, res) => {
  lastCalendarSync = 0;
  try { await syncCalendar(); res.json({ ok: true, count: events.length, names: events.map(e => e.name).slice(-20) }); }
  catch(e) { res.json({ ok: false, error: e.message }); }
});

// Dummy user management API
app.get('/api/dummy-users', (req, res) => { res.json(demoUsers); });
app.post('/api/dummy-users', (req, res) => {
  var { username, role, lat, lng, event_id, blurb, offering, locationEnabled, car, instagram, car_photo, email, display, showPin } = req.body;
  if (!username) return res.status(400).json({ error: 'username required' });
  demoUsers.push({ username, role: role || 'attendee', lat: lat || 40.5144, lng: lng || -111.4764, event_id: event_id || 'demo-event-1', blurb: blurb || '', offering: offering || '', locationEnabled: locationEnabled !== false, car: car || '', instagram: instagram || '', car_photo: car_photo || '', email: email || '', display: display || '', showPin: showPin !== false });
  res.json(demoUsers);
});
app.put('/api/dummy-users/:username', (req, res) => {
  var idx = demoUsers.findIndex(u => u.username === req.params.username);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  Object.assign(demoUsers[idx], req.body);
  // If username changed in body, update the key
  if (req.body.username && req.body.username !== demoUsers[idx].username) {
    demoUsers[idx].username = req.body.username;
  }
  res.json(demoUsers[idx]);
});
app.delete('/api/dummy-users/:username', (req, res) => {
  var idx = demoUsers.findIndex(u => u.username === req.params.username);
  if (idx >= 0) demoUsers.splice(idx, 1);
  res.json({ success: true });
});

// Admin login
app.post('/api/admin-login', (req, res) => {
  var { username, password } = req.body;
  if (username === 'sleve' && password === 'duck') {
    res.json({ success: true, username: 'sleve' });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

const HEAT_VALUES = { admin: 0, organizer: 0, sponsor: 3, vendor: 3, vip: 4, super_user: 10, registered_user: 2, user: 1, attendee: 1 };

const demoUsers = loadData('demoUsers', [
  { username: "bmwfanatic", role: "registered_user", lat: 40.5140, lng: -111.4760, event_id: "demo-event-1", locationEnabled: false },
  { username: "porscheguy", role: "vip", lat: 40.5135, lng: -111.4755, event_id: "demo-event-1", locationEnabled: false },
  { username: "jdmlover", role: "user", lat: 40.5155, lng: -111.4765, event_id: "demo-event-1", locationEnabled: false },
  { username: "stancebro", role: "attendee", lat: 40.5130, lng: -111.4775, event_id: "demo-event-1", locationEnabled: false },
  { username: "v8power", role: "registered_user", lat: 40.5148, lng: -111.4750, event_id: "demo-event-1", locationEnabled: false },
  { username: "speedshop_ut", role: "sponsor", lat: 40.5152, lng: -111.4755, event_id: "demo-event-1", locationEnabled: false },
  { username: "turbokings", role: "vendor", lat: 40.5135, lng: -111.4775, event_id: "demo-event-1", locationEnabled: false },
  { username: "carbonwerks", role: "vendor", lat: 40.5150, lng: -111.4745, event_id: "demo-event-1", locationEnabled: false },
  { username: "exotic_rentals", role: "sponsor", lat: 40.5142, lng: -111.4780, event_id: "demo-event-1", locationEnabled: false },
  { username: "prestige_wheels", role: "vendor", lat: 40.5152, lng: -111.4755, event_id: "demo-event-1", locationEnabled: false },
  { username: "detail_garage", role: "vendor", lat: 40.5138, lng: -111.4770, event_id: "demo-event-1", locationEnabled: false },
])
const users = {};
const notifications = loadData("notifications", []);

// Poker run
const pokerHands = loadData("pokerHands", {});
var suits = ["♠","♥","♦","♣"];
var ranks = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
function randomCard(){ return { suit: suits[Math.floor(Math.random()*4)], rank: ranks[Math.floor(Math.random()*13)] }; }
app.get("/api/poker/hand/:username", (req,res) => { var h=pokerHands[req.params.username]||{cards:[]}; res.json(h); });
app.post("/api/poker/collect", (req,res) => { var {username,vendor_username}=req.body; if(!username||!vendor_username) return res.status(400).json({error:"required"}); var v=demoUsers.find(u=>u.username===vendor_username&&u.offering&&u.offering.split(",").includes("poker")); if(!v) return res.status(400).json({error:"Vendor not offering poker"}); if(!pokerHands[username]) pokerHands[username]={cards:[]}; if(pokerHands[username].cards.length>=5) return res.status(400).json({error:"Hand full (max 5)"}); var has=pokerHands[username].cards.filter(function(c){return c.from===vendor_username}); if(has.length) return res.status(400).json({error:"Already got card from this vendor"}); var card=randomCard(); card.from=vendor_username; card.collected_at=Date.now(); pokerHands[username].cards.push(card); saveData("pokerHands",pokerHands); res.json({card,hand:pokerHands[username].cards}); });
app.get("/api/poker/leaderboard", (req,res) => {
  var rankOrder = {"2":1,"3":2,"4":3,"5":4,"6":5,"7":6,"8":7,"9":8,"10":9,"J":10,"Q":11,"K":12,"A":13};
  function evalHand(cards){
    if(!cards||cards.length<5) return {score:cards?cards.length:0,label:cards?cards.length+' cards':'No cards',cards:cards||[]};
    var ranks=cards.map(function(c){return rankOrder[c.rank]}).sort(function(a,b){return b-a});
    var suits=cards.map(function(c){return c.suit});
    var isFlush=suits.every(function(s){return s===suits[0]});
    var isStraight=false; var rs=[...new Set(ranks)].sort(function(a,b){return b-a});
    if(rs.length===5&&rs[0]-rs[4]===4)isStraight=true;
    if(rs.join(',')==='13,12,11,10,1')isStraight=true;
    var counts={};ranks.forEach(function(r){counts[r]=(counts[r]||0)+1});
    var groups=Object.values(counts).sort(function(a,b){return b-a});
    if(isFlush&&isStraight&&ranks[0]===13)return{score:900,label:'Royal Flush',cards:cards};
    if(isFlush&&isStraight)return{score:800+ranks[0],label:'Straight Flush',cards:cards};
    if(groups[0]===4)return{score:700+Object.keys(counts).find(function(k){return counts[k]===4})*1,label:'Four of a Kind',cards:cards};
    if(groups[0]===3&&groups[1]===2)return{score:600,label:'Full House',cards:cards};
    if(isFlush)return{score:500+ranks[0],label:'Flush',cards:cards};
    if(isStraight)return{score:400+ranks[0],label:'Straight',cards:cards};
    if(groups[0]===3)return{score:300,label:'Three of a Kind',cards:cards};
    if(groups[0]===2&&groups[1]===2)return{score:200,label:'Two Pair',cards:cards};
    if(groups[0]===2)return{score:100,label:'One Pair',cards:cards};
    return{score:ranks[0],label:'High Card',cards:cards};
  }
  var board=Object.keys(pokerHands).map(function(un){
    var hand=evalHand(pokerHands[un].cards);
    return{username:un,label:hand.label,cards:pokerHands[un].cards,score:hand.score};
  }).sort(function(a,b){return b.score-a.score});
  res.json(board.slice(0,20));
});

app.post("/api/poker/simulate", (req,res) => {
  var { username } = req.body;
  if (!username) return res.status(400).json({error:"username required"});
  var pokerVendors = demoUsers.filter(u => u.offering && u.offering.split(',').includes('poker'));
  if (!pokerVendors.length) return res.json({error:"No vendors offering poker. Enable poker offering on some vendors first."});
  if (!pokerHands[username]) pokerHands[username] = { cards: [] };
  var cards = [];
  pokerVendors.forEach(function(v){
    var already = pokerHands[username].cards.filter(function(c){return c.from===v.username});
    if (!already.length && pokerHands[username].cards.length < 5) {
      var card = randomCard(); card.from = v.username; card.collected_at = Date.now();
      pokerHands[username].cards.push(card); cards.push(card);
    }
  });
  saveData('pokerHands', pokerHands);
  res.json({ cards: cards, hand: pokerHands[username].cards, totalCollected: cards.length });
});

app.post("/api/poker/reset", (req,res) => {
  Object.keys(pokerHands).forEach(function(k){delete pokerHands[k]});
  saveData('pokerHands',pokerHands);
  res.json({ok:true});
});
const follows = {}; // username -> [vendor_username]
const accounts = loadData('accounts', {}); // email -> { email, password, username, role }
const spotLikes = loadData('spotLikes', {}); // spotId -> [usernames]
const gpxTracks = loadData('gpxTracks', []);
const gpxProgress = loadData('gpxProgress', {}); // username -> { trackId: { progress, completed } }
const accessCodes = loadData("accessCodes", {}); // code -> { role, event_id, created }
const USERS_EXPIRY_MS = 60 * 1000;

// Account registration & login
app.post('/api/register', (req, res) => {
  var { email, username, password, role, code } = req.body;
  if (!email || !username || !password) return res.status(400).json({ error: 'Email, username, and password required' });
  if (accounts[email]) return res.status(400).json({ error: 'Email already registered' });
  var userRole = role || 'user';
  // Check access codes
  if (code) {
    var ac = accessCodes[code.toUpperCase()];
    if (ac) { userRole = ac.role || 'user'; var eventId = ac.event_id || 'demo-event-1'; }
    else if (code.toUpperCase() === 'VIP') userRole = 'vip';
    else if (code.toUpperCase() === 'VENDOR') userRole = 'vendor';
    else if (code.toUpperCase() === 'SPONSOR') userRole = 'sponsor';
  }
  accounts[email] = { email, username, password: hash(password), role: userRole, created: new Date().toISOString() };
  // Also add to demo users list
  if (!demoUsers.find(u => u.username === username)) {
    demoUsers.push({ username, role: userRole, lat: 40.5144, lng: -111.4764, event_id: eventId || 'demo-event-1', locationEnabled: false, blurb: '', offering: '', car: '', instagram: '', car_photo: '', email: email, photo: '', display: username });
  }
  saveData('accounts', accounts);
  saveData('demoUsers', demoUsers);
  res.json({ success: true, username: username, role: userRole });
});

app.get('/api/accounts/:username', (req,res) => {
  var found = Object.values(accounts).find(a => a.username === req.params.username);
  if (found) res.json(found);
  else res.json({ error: 'not found' });
});

app.post('/api/login', (req, res) => {
  var { username, role, event_id } = req.body;
  var email = username + '@demo.com';
  if (!username) return res.status(400).json({ error: 'Username required' });
  var name = username.trim();
  var eid = event_id || 'demo-event-1';
  var ev = events.find(e => e.id === eid) || events[0];
  var userRole = role || 'attendee';
  // Admin check: sleve always gets admin
  if (name === 'sleve') userRole = 'admin';
  else {
    var acct = accounts[email] || accounts[name];
    if (acct) { name = acct.username; userRole = acct.role; }
  }
  users[name] = { username: name, role: userRole, event_id: eid, online: true, locationEnabled: false, lat: null, lng: null, last_seen: Date.now() };
  res.json({ username: name, role: userRole, event: ev });
});
const CALENDAR_URL = 'https://calendar.google.com/calendar/ical/a06502732cdb2e4140be9ba71f0a71cb992e0db60e1a33daa75105c565ab797f%40group.calendar.google.com/public/basic.ics';

// Fetch Google Calendar events
async function syncCalendar() {
  try {
    const res = await fetch(CALENDAR_URL);
    if (!res.ok) return;
    const ics = await res.text();
    const calEvents = [];
    const lines = ics.split('\n');
    let evt = null;
    for (const line of lines) {
      if (line.startsWith('BEGIN:VEVENT')) { evt = {}; }
      else if (line.startsWith('END:VEVENT') && evt) { calEvents.push(evt); evt = null; }
      else if (evt) {
        const m = line.match(/^(DTSTART|DTEND|SUMMARY|DESCRIPTION|LOCATION)[^:]*:(.+)/);
        if (m) {
          const key = m[1] === 'SUMMARY' ? 'name' : m[1] === 'LOCATION' ? 'loc' : m[1] === 'DESCRIPTION' ? 'desc' : m[1].toLowerCase();
          if (m[1] === 'DTSTART' || m[1] === 'DTEND') {
            const v = m[2]; evt[key] = v.length === 8 ? v.slice(0,4)+'-'+v.slice(4,6)+'-'+v.slice(6,8)+'T00:00:00Z' : v.slice(0,4)+'-'+v.slice(4,6)+'-'+v.slice(6,8)+'T'+v.slice(9,11)+':'+v.slice(11,13)+':'+v.slice(13,15)+'Z';
          } else { evt[key] = m[2].replace(/\\,/g,',').replace(/\\n/g,' '); }
        }
      }
    }
    calEvents.forEach(ce => {
      if (!ce.name) return;
      const existing = events.find(e => e.name === ce.name);
      if (existing) return;
      
      let parentId = undefined;
      let cleanDesc = (ce.desc || '').replace(/\\,/g,',').replace(/\\n/g,' ').replace(/ \+ /g,'\n');
      let rollIn = undefined, showStart = undefined, calLat=undefined, calLng=undefined, parentName=undefined;
      let isMaster = /type:\s*master/i.test(cleanDesc);
      
      // Extract parent
      let pm = cleanDesc.match(/parent:\s*(.+?)(?:\n|$)/i);
      if (pm) { parentName = pm[1].trim(); cleanDesc = cleanDesc.replace(/parent:\s*.+/i,'').trim(); }
      
      let rim = cleanDesc.match(/roll_in:\s*(.+)/i);
      if (rim) { rollIn = new Date(rim[1].trim()).toISOString(); cleanDesc = cleanDesc.replace(/roll_in:\s*.+/i,'').trim(); }
      let ssm = cleanDesc.match(/show_start:\s*(.+)/i);
      if (ssm) { showStart = new Date(ssm[1].trim()).toISOString(); cleanDesc = cleanDesc.replace(/show_start:\s*.+/i,'').trim(); }
      let latm=cleanDesc.match(/lat:\s*([\d.]+)/i); if(latm){calLat=parseFloat(latm[1]);cleanDesc=cleanDesc.replace(/lat:\s*[\d.]+/i,'').trim()}
      let lngm=cleanDesc.match(/lng:\s*([\d.-]+)/i); if(lngm){calLng=parseFloat(lngm[1]);cleanDesc=cleanDesc.replace(/lng:\s*[\d.-]+/i,'').trim()}
      
      if (isMaster) {
        parentId = undefined;
        cleanDesc = cleanDesc.replace(/type:\s*master\s*/i, '').trim();
      } else if (parentName) {
        const parent = events.find(e => e.name.toLowerCase() === parentName.toLowerCase());
        if (parent) parentId = parent.id;
      }
      
      if (!parentId) parentId = 'demo-event-1';
      
      events.push({
        id: 'cal-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),
        organizer_id: 'google-calendar',
        access_code: '',
        name: ce.name,
        description: cleanDesc,
        location_name: ce.loc || '',
        lat: calLat || 40.5144, lng: calLng || -111.4764,
        radius_meters: 2000,
        start_date: showStart || ce.dtstart || new Date().toISOString(),
        roll_in_time: rollIn || undefined,
        end_date: ce.dtend || new Date(Date.now()+86400000*3).toISOString(),
        is_active: true,
        parent_event_id: parentId,
        created_at: new Date().toISOString()
      });
    });
  } catch(e) { console.log('Calendar sync error:', e.message); }
}

// Event notification check (every minute)
setInterval(() => {
  const now = Date.now();
  events.forEach(e => {
    const startMs = new Date(e.start_date).getTime();
    const diff = startMs - now;
    if (diff > 0 && diff < 3600000 && diff > 3540000) { // ~1 hour out, within a 1-min window
      const key = 'event-'+e.id+'-1h';
      if (!notifications.find(n => n.key === key)) {
        notifications.unshift({ key, type: 'event', event_id: e.id, message: e.name + ' starts in 1 hour!', created_at: new Date().toISOString() });
      }
    }
  });
}, 60000);

let lastCalendarSync = 0;
async function syncCalendarIfNeeded() {
  if (Date.now() - lastCalendarSync > 300000) {
    lastCalendarSync = Date.now();
    await syncCalendar().catch(() => {});
  }
}

// Trigger sync on every events API call
app.get('/api/events', async (req, res) => {
  try { await syncCalendarIfNeeded(); } catch(e) { console.log('sync error:', e.message); }
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
  var username = req.body.username || 'anon';
  if (!spotLikes[req.params.id]) spotLikes[req.params.id] = [];
  if (spotLikes[req.params.id].includes(username)) return res.status(400).json({ error: 'Already liked' });
  spotLikes[req.params.id].push(username);
  s.likes = spotLikes[req.params.id].length;
  saveData('spotLikes', spotLikes);
  res.json({ likes: s.likes });
});

app.put('/api/spots/:id', (req, res) => {
  var idx = spots.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  Object.assign(spots[idx], req.body);
  res.json(spots[idx]);
});

app.delete('/api/spots/:id', (req, res) => {
  const idx = spots.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  spots.splice(idx, 1);
  res.json({ success: true });
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
    // Also update dummy user data so admin panel shows real GPS
    var du = demoUsers.find(u => u.username === username);
    if (du) { du.lat = lat; du.lng = lng; }
    users[username].last_seen = Date.now();
    users[username].online = true;
    if (event_id) users[username].event_id = event_id;
  }
  res.json({ success: true });
});

app.post('/api/location/toggle', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });
  if (!users[username]) return res.status(400).json({ error: 'User not found' });
  users[username].locationEnabled = !users[username].locationEnabled;
  // Also sync to dummy user data
  var du = demoUsers.find(u => u.username === username);
  if (du) du.locationEnabled = users[username].locationEnabled;
  // Notify followers when someone turns location ON
  if (users[username].locationEnabled) {
    Object.keys(follows).forEach(follower => {
      if (follows[follower].includes(username)) {
        notifications.unshift({ key: 'loc-'+username+'-'+Date.now(), type: 'follow', message: username+' is now sharing their location!', created_at: new Date().toISOString() });
      }
    });
  }
  res.json({ locationEnabled: users[username].locationEnabled });
});

app.get('/api/users/:eventId', (req, res) => {
  const now = Date.now();
  const real = Object.values(users).filter(u =>
    u.event_id === req.params.eventId && u.online && u.locationEnabled && (now - u.last_seen < USERS_EXPIRY_MS)
  ).map(u => ({
    username: u.username, lat: u.lat, lng: u.lng, role: u.role, heat: HEAT_VALUES[u.role] || 1
  }));
    const demo = demoUsers.filter(u => u.event_id === req.params.eventId && u.locationEnabled === true)
    .map(u => {
      var v = u.role === 'vendor' ? vendors.find(vd => vd.user_id === u.username || (vd.business_name && u.username && vd.business_name.toLowerCase().includes(u.username.toLowerCase()))) : null;
      // Use real-time location if user has an active session
      var session = users[u.username];
      var lat = (session && session.lat) ? session.lat : u.lat;
      var lng = (session && session.lng) ? session.lng : u.lng;
      var showPin = u.showPin !== false || (u.offering && u.offering.length > 0);
      return { username: u.username, lat: lat, lng: lng, role: u.role, heat: HEAT_VALUES[u.role] || 1, blurb: u.blurb || '', offering: u.offering || '', car: u.car || '', instagram: u.instagram || '', car_photo: u.car_photo || '', email: u.email || '', photo: u.photo || '', business_name: v ? v.business_name : '', description: v ? v.description : '', showPin: showPin, locationEnabled: u.locationEnabled !== false };
    });
  res.json([...real, ...demo]);
});

if (require.main === module) {

// GPX Track API
app.get("/api/gpx", (req,res) => { res.json(gpxTracks); });
app.post("/api/gpx/create", (req,res) => {
  var {name,description,points,gpxData} = req.body;
  if (!name) return res.status(400).json({error:"name required"});
  if (!points || !points.length) {
    if (gpxData) {
      points = [];
      var reLat = /lat="([^"]+)"/g;
      var reLon = /lon="([^"]+)"/g;
      var pts = gpxData.match(/<trkpt[^>]*>/g) || [];
      pts.forEach(function(pt){
        var lm = reLat.exec(pt); var lnm = reLon.exec(pt);
        if (lm && lnm) points.push([parseFloat(lm[1]), parseFloat(lnm[1])]);
        reLat.lastIndex = 0; reLon.lastIndex = 0;
      });
    }
    if (!points.length) return res.status(400).json({error:"points required"});
  }
  var t={id:"gpx-"+Date.now(),name,description:description||"",points:points,created:new Date().toISOString()};
  gpxTracks.push(t); saveData("gpxTracks",gpxTracks); res.json(t);
});
app.delete("/api/gpx/:id", (req,res) => { var i=gpxTracks.findIndex(t=>t.id===req.params.id); if(i>=0)gpxTracks.splice(i,1); saveData("gpxTracks",gpxTracks); res.json({success:true}); });
app.get("/api/gpx/progress/:username", (req,res) => { res.json(gpxProgress[req.params.username]||{}); });
app.post("/api/gpx/progress", (req,res) => { var {username,trackId,progress,completed,pointIndex}=req.body; if(!username||!trackId) return res.status(400).json({error:"required"}); if(!gpxProgress[username])gpxProgress[username]={}; gpxProgress[username][trackId]={progress:progress||0,completed:completed||false,pointIndex:pointIndex||0,updated:Date.now()}; saveData("gpxProgress",gpxProgress); res.json(gpxProgress[username]); });
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`CarShow Live running on http://localhost:${PORT}`));
}

// Notifications & Follows API
app.get('/api/notifications', (req, res) => { res.json(notifications.slice(0, 50)); });
app.delete('/api/notifications/:key', (req, res) => { var i=notifications.findIndex(n=>n.key===req.params.key);if(i>=0)notifications.splice(i,1);res.json({success:true}); });
app.delete('/api/notifications', (req, res) => { notifications.length=0;res.json({success:true}); });
app.post('/api/follow', (req, res) => { var {username,follow}=req.body;if(!username||!follow)return res.status(400).json({error:'required'});if(!follows[username])follows[username]=[];if(!follows[username].includes(follow))follows[username].push(follow);res.json({following:follows[username]})});
app.post('/api/unfollow', (req, res) => { var {username,follow}=req.body;if(follows[username])follows[username]=follows[username].filter(f=>f!==follow);res.json({following:follows[username]||[]})});
app.get('/api/follows/:username', (req, res) => { res.json(follows[req.params.username]||[]); });


app.get("/api/access-codes", (req,res) => { res.json(accessCodes); });
app.post("/api/access-codes", (req,res) => { var {code,role,event_id}=req.body; if(!code||!role) return res.status(400).json({error:"code and role required"}); accessCodes[code.toUpperCase()]={role,event_id:event_id||"demo-event-1",created:new Date().toISOString()}; saveData("accessCodes",accessCodes); res.json(accessCodes); });
app.delete("/api/access-codes/:code", (req,res) => { var c=req.params.code.toUpperCase(); delete accessCodes[c]; saveData("accessCodes",accessCodes); res.json({success:true}); });
module.exports = app;
