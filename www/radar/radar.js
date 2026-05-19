// ═══════════════════════════════════════════════════════════════
//  AgroMetrix Radar — radar.js v5.0 (Correção Definitiva de Nomes)
//  Mapa Leaflet · Pilotos reais · Bots espalhados · SOS · Operações
// ═══════════════════════════════════════════════════════════════

let _map = null;
let _markers = {};
let _botInterval = null;
let _locationInterval = null;
let _operationActive = false;
let _operationStart = null;
let _operationData = {};
let _operationConfig = {};
let _pauseTimer = null;
let _autoEndTimer = null;
let _currentUid = null;

// ── Função robusta cleanName() ────────────────────────────────
function cleanName(name, user) {
  let n = String(name || '').trim();

  const invalid =
    !n ||
    n.startsWith('http') ||
    n.includes('googleusercontent.com') ||
    n.includes('lh3.googleusercontent.com') ||
    n.includes('.com/') ||
    n.includes('=s96-c');

  if (invalid) {
    n =
      user?.displayName ||
      user?.email?.split('@')[0] ||
      'Piloto';
  }

  if (
    !n ||
    n.startsWith('http') ||
    n.includes('googleusercontent.com')
  ) {
    n = 'Piloto';
  }

  if (n.length > 25) {
    n = n.substring(0, 22) + '...';
  }

  return n;
}

// ── Bots fixos (usados pelo spawnBots legado) ─────────────────
const BOTS = [
  { id: 'bot_001', name: 'Carlos Mendonça',   city: 'Sorriso, MT',       drone: 'DJI Agras T40',   score: 87, photo: '👨‍✈️', hoursTotal: 1240, opsTotal: 312 },
  { id: 'bot_002', name: 'Rafael Bueno',      city: 'Rondonópolis, MT',  drone: 'XAG P100 Pro',    score: 92, photo: '🧑‍✈️', hoursTotal: 890,  opsTotal: 198 },
  { id: 'bot_003', name: 'Marcos Figueiredo', city: 'Lucas do Rio Verde', drone: 'DJI Agras T30',  score: 74, photo: '👨‍✈️', hoursTotal: 560,  opsTotal: 143 },
  { id: 'bot_004', name: 'Thiago Cavalcante', city: 'Primavera do Leste', drone: 'XAG V40',        score: 95, photo: '🧑‍✈️', hoursTotal: 2100, opsTotal: 487 },
  { id: 'bot_005', name: 'Diego Almeida',     city: 'Campo Verde, MT',   drone: 'DJI Agras T50',   score: 81, photo: '👨‍✈️', hoursTotal: 720,  opsTotal: 201 },
  { id: 'bot_006', name: 'Leandro Souza',     city: 'Nova Mutum, MT',    drone: 'Pegasus Agri 10', score: 68, photo: '🧑‍✈️', hoursTotal: 430,  opsTotal: 98  },
  { id: 'bot_007', name: 'Fabio Martins',     city: 'Sapezal, MT',       drone: 'DJI Agras T40',   score: 89, photo: '👨‍✈️', hoursTotal: 1560, opsTotal: 389 },
  { id: 'bot_008', name: 'Anderson Lima',     city: 'Sinop, MT',         drone: 'XAG P100 Pro',    score: 77, photo: '🧑‍✈️', hoursTotal: 680,  opsTotal: 167 },
];

// ── Inicializar mapa ──────────────────────────────────────────
export function initMap(containerId, lat, lon) {
  if (_map) { _map.remove(); _map = null; }

  _map = L.map(containerId, {
    zoomControl: false,
    attributionControl: false,
  }).setView([lat || -15.7801, lon || -47.9292], 10);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap',
  }).addTo(_map);

  L.control.zoom({ position: 'bottomright' }).addTo(_map);
  L.control.attribution({ position: 'bottomleft' }).addTo(_map);

  return _map;
}

// ── Ícone de piloto ───────────────────────────────────────────
function pilotIcon(status, isUser = false) {
  const isSOS      = status === 'sos';
  const isOp       = status === 'operating';
  const isRequest  = status === 'request';

  let color = '#1e88d0';
  if (isOp)      color = '#3da866';
  if (isSOS)     color = '#e03535';
  if (isRequest) color = '#f5a623';

  const size = isUser ? 48 : 40;
  let svg = `<svg width="${size}" height="${size}" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">`;

  if (isSOS) {
    svg += `<circle cx="20" cy="20" r="15" fill="none" stroke="#e03535" stroke-width="2.5">
      <animate attributeName="r" from="14" to="28" dur="1s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.8;0" dur="1s" repeatCount="indefinite"/>
    </circle>
    <circle cx="20" cy="20" r="15" fill="none" stroke="#e03535" stroke-width="1.5">
      <animate attributeName="r" from="14" to="38" dur="1s" begin="0.35s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.5;0" dur="1s" begin="0.35s" repeatCount="indefinite"/>
    </circle>`;
  }
  if (isRequest) {
    svg += `<circle cx="20" cy="20" r="15" fill="none" stroke="#f5a623" stroke-width="2">
      <animate attributeName="r" from="14" to="26" dur="1.4s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.6;0" dur="1.4s" repeatCount="indefinite"/>
    </circle>`;
  }
  if (isOp) {
    svg += `<circle cx="20" cy="20" r="15" fill="none" stroke="${color}" stroke-width="1.5">
      <animate attributeName="r" from="13" to="22" dur="1.8s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.5;0" dur="1.8s" repeatCount="indefinite"/>
    </circle>`;
  }

  svg += `<circle cx="20" cy="20" r="14" fill="${color}" opacity="0.15"/>
    <circle cx="20" cy="20" r="10" fill="${color}" opacity="0.95"/>`;

  if (isUser)         svg += `<circle cx="20" cy="20" r="5" fill="white" opacity="0.95"/>`;
  if (isSOS)          svg += `<text x="20" y="25" text-anchor="middle" font-size="13" fill="white">🚨</text>`;
  else if (isRequest) svg += `<text x="20" y="25" text-anchor="middle" font-size="13" fill="white">🔧</text>`;
  else if (isOp)      svg += `<text x="20" y="25" text-anchor="middle" font-size="13" fill="white">🚁</text>`;

  svg += `</svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

// ── Popup do piloto ───────────────────────────────────────────
function buildPopup(pilot) {
  // Sanitização definitiva do nome
  const safeName = cleanName(pilot.nickname || pilot.name, window.AgroRadar?.user);
  const safeNameEscaped = safeName.replace(/'/g, "\\'");
  const safeMsg  = (pilot.requestMsg || '').replace(/'/g, "\\'");

  const reqBtn = (pilot.status === 'request' && !pilot.isCurrentUser)
    ? `<button onclick="window.acceptReq('${pilot.id}','${safeNameEscaped}','${safeMsg}')"
        style="margin-top:8px;width:100%;padding:7px;border-radius:8px;border:none;background:#f5a623;color:#0d1a0f;font-weight:700;font-size:12px;cursor:pointer">
        ✅ Aceitar chamado</button>` : '';

  const sosBtn = (pilot.status === 'sos' && !pilot.isCurrentUser)
    ? `<button onclick="window.acceptReq('${pilot.id}','${safeNameEscaped}','🚨 SOS — Preciso de ajuda!')"
        style="margin-top:8px;width:100%;padding:7px;border-radius:8px;border:none;background:#e03535;color:white;font-weight:700;font-size:12px;cursor:pointer">
        🚨 Responder SOS</button>` : '';

  const chatBtn = (!pilot.isCurrentUser)
    ? `<button onclick="window.openChatWith('${pilot.id}')"
        style="margin-top:6px;width:100%;padding:6px;border-radius:8px;border:1px solid rgba(61,168,102,.4);background:transparent;color:#5ec880;font-size:12px;cursor:pointer">
        💬 Chat</button>` : '';

  let statusText = '🟢 Online';
  if (pilot.status === 'sos')        statusText = '🚨 SOS';
  else if (pilot.status === 'request')   statusText = '🔧 Pedido';
  else if (pilot.status === 'operating') statusText = '🚁 Operando';

  // Sanitização da foto (se for URL gigante ou inválida, usa emoji)
  let photoHtml = '👨‍✈️';
  if (pilot.photo && !pilot.photo.startsWith('http') && pilot.photo.length < 10) {
    photoHtml = pilot.photo;
  } else if (pilot.photo && pilot.photo.startsWith('http') && !pilot.photo.includes('googleusercontent.com')) {
    photoHtml = `<img src="${pilot.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.outerHTML='👨‍✈️'">`;
  } else if (pilot.photo && pilot.photo.includes('googleusercontent.com')) {
    // Se for Google, tenta usar a URL mas com fallback
    photoHtml = `<img src="${pilot.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.outerHTML='👨‍✈️'">`;
  }

  return `<div style="font-family:'Syne',sans-serif;min-width:190px;padding:4px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <div style="font-size:24px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:50%;background:rgba(61,168,102,.1)">${photoHtml}</div>
      <div>
        <div class="p-card-name" style="font-weight:700;font-size:14px;color:#e8f5eb;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${safeName}</div>
        <div style="font-size:10px;color:#5a8a65">${pilot.city || ''}</div>
      </div>
    </div>
    <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px">
      <span style="background:#1f5534;color:#5ec880;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700">AMX ${pilot.score || 0}</span>
      <span style="background:#111d14;color:#9ac8a6;padding:2px 8px;border-radius:6px;font-size:10px">${statusText}</span>
    </div>
    ${pilot.requestMsg ? `<div style="font-size:11px;color:#f5a623;margin-bottom:4px">📢 ${pilot.requestMsg}</div>` : ''}
    <div style="font-size:10px;color:#5a8a65">🚁 ${pilot.drone || 'Drone agrícola'}</div>
    <div style="font-size:10px;color:#5a8a65;margin-top:2px">⏱ ${pilot.hoursTotal || 0}h · ${pilot.opsTotal || 0} ops</div>
    ${reqBtn}${sosBtn}${chatBtn}
  </div>`;
}

// ── Adicionar/atualizar piloto ────────────────────────────────
export function upsertPilot(pilot) {
  if (!_map || !pilot.lat || !pilot.lon) return;

  const icon  = pilotIcon(pilot.status || 'online', pilot.isCurrentUser === true);
  const popup = buildPopup(pilot);

  if (_markers[pilot.id]) {
    _markers[pilot.id].setLatLng([pilot.lat, pilot.lon]);
    _markers[pilot.id].setIcon(icon);
    _markers[pilot.id].setPopupContent(popup);
    _markers[pilot.id]._pilotData = pilot;
  } else {
    const m = L.marker([pilot.lat, pilot.lon], { icon })
      .bindPopup(popup, { className: 'amx-popup', maxWidth: 230, closeButton: false })
      .addTo(_map);
    m._pilotData = pilot;
    _markers[pilot.id] = m;
  }
}

export function removePilot(id) {
  if (_markers[id]) {
    _markers[id].remove();
    delete _markers[id];
  }
}

// ── Listen Pilots (Firestore + bots) ─────────────────────────
export async function listenPilots(centerLat, centerLon, currentUid) {
  _currentUid = currentUid;

  // Limpar marcadores antigos exceto o do usuário atual
  Object.keys(_markers).forEach(id => {
    if (id !== currentUid) removePilot(id);
  });

  spawnBots(centerLat, centerLon, { wind: 10, temp: 25 });
  startBotUpdates();
  _updatePilotCount();

  // Tentar Firestore se disponível
  if (window._firebaseDB) {
    try {
      const { collection, onSnapshot, query, where } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      const q = query(collection(window._firebaseDB, 'pilots'), where('visibility', '!=', 'invisible'));

      if (window._firestoreUnsub) window._firestoreUnsub();
      window._firestoreUnsub = onSnapshot(q, snapshot => {
        snapshot.docChanges().forEach(change => {
          const d = change.doc.data();
          if (change.type === 'removed' || d.visibility === 'invisible') { removePilot(d.uid); return; }
          if (!d.lat || !d.lon) return;
          upsertPilot({
            id: d.uid,
            name: d.nickname || d.name || 'Piloto',
            photo: d.photo || '👨‍✈️',
            city: d.city || '',
            drone: d.drone || '',
            score: d.amxScore || 0,
            hoursTotal: d.hoursTotal || 0,
            opsTotal: d.opsTotal || 0,
            lat: d.lat, lon: d.lon,
            status: d.status || 'online',
            requestMsg: d.requestMsg || null,
            isCurrentUser: d.uid === currentUid,
          });
        });
        _updatePilotCount();
      });
    } catch (e) {
      console.log('Modo offline: apenas bots');
    }
  }
}

// ── Bots (spawn em torno do usuário) ─────────────────────────
export function spawnBots(lat, lon, weather) {
  const hour    = new Date().getHours();
  const isDay   = hour >= 5 && hour <= 18;
  const goodWind = (weather?.wind || 0) <= 20;

  const activeBots = BOTS.filter((_, i) => {
    if (!isDay)    return i < 2;
    if (!goodWind) return i < 4;
    return true;
  });

  activeBots.forEach((bot, i) => {
    const angle  = (i / activeBots.length) * Math.PI * 2 + Math.random() * 0.5;
    const radius = (5 + Math.random() * 35) / 111;
    const blat   = lat + Math.cos(angle) * radius;
    const blon   = lon + Math.sin(angle) * radius / Math.cos(lat * Math.PI / 180);
    const isOp   = isDay && goodWind && Math.random() > 0.4;
    upsertPilot({ ...bot, lat: blat, lon: blon, status: isOp ? 'operating' : 'online', isCurrentUser: false });
  });
}

export function startBotUpdates() {
  if (_botInterval) clearInterval(_botInterval);
  _botInterval = setInterval(() => {
    Object.entries(_markers).forEach(([id, m]) => {
      if (!id.startsWith('bot_')) return;
      const p = m.getLatLng();
      m.setLatLng([p.lat + (Math.random() - 0.5) * 0.003, p.lng + (Math.random() - 0.5) * 0.003]);
    });
  }, 15000);
}

export function stopBotUpdates() {
  if (_botInterval) clearInterval(_botInterval);
}

// ── Localização ───────────────────────────────────────────────
export function startLocationTracking(uid, onUpdate) {
  let lastLat = null, lastLon = null;

  function update() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude: lat, longitude: lon } = pos.coords;
      const dist = lastLat
        ? Math.sqrt(Math.pow((lat - lastLat) * 111000, 2) + Math.pow((lon - lastLon) * 111000, 2))
        : 9999;
      if (dist >= 300 || !lastLat) { lastLat = lat; lastLon = lon; onUpdate(lat, lon); }
    }, null, { enableHighAccuracy: true, timeout: 10000 });
  }

  update();
  if (_locationInterval) clearInterval(_locationInterval);
  _locationInterval = setInterval(update, 60000);
}

export function stopLocationTracking() {
  if (_locationInterval) clearInterval(_locationInterval);
}

// ── Operações ─────────────────────────────────────────────────
export function startOperation(config, weatherState, lat, lon) {
  _operationActive = true;
  _operationStart  = Date.now();
  _operationConfig = config || {};
  _operationData   = { startTime: new Date().toISOString(), lat, lon, weather: { ...weatherState }, pauses: 0, lastActivity: Date.now() };
  if (_autoEndTimer) clearTimeout(_autoEndTimer);
  _autoEndTimer = setTimeout(() => {
    if (_operationActive) window.dispatchEvent(new CustomEvent('amx:check-operation'));
  }, 4 * 3600 * 1000);
  return _operationData;
}

export function endOperation(weatherState) {
  if (!_operationActive) return null;
  _operationActive = false;
  if (_autoEndTimer) clearTimeout(_autoEndTimer);
  if (_pauseTimer)   clearTimeout(_pauseTimer);
  const durationMin = Math.round((Date.now() - _operationStart) / 60000);
  const score       = calcAMXScore(durationMin, weatherState, _operationData, _operationConfig);
  const estimate    = calcOperationEstimate(durationMin, _operationConfig, _operationData);
  return { ..._operationData, endTime: new Date().toISOString(), durationMin, score, estimate, config: _operationConfig };
}

export function registerActivity() {
  if (!_operationActive) return;
  _operationData.lastActivity = Date.now();
  if (_pauseTimer) { clearTimeout(_pauseTimer); _pauseTimer = null; }
  _pauseTimer = setTimeout(() => { if (_operationActive) _operationData.pauses++; }, 5 * 60 * 1000);
}

export function calcOperationEstimate(durationMin, config, opData) {
  const avgHaPerH = parseFloat(config?.avgHaPerH) || 20;
  const hoursOp   = Math.max(0, (durationMin - (opData?.pauses || 0) * 5)) / 60;
  const estHa     = (hoursOp * avgHaPerH).toFixed(1);
  const vazao     = parseFloat(config?.vazao) || 10;
  const faixa     = parseFloat(config?.faixa) || 9;
  let conf = 100;
  if (vazao < 3 || vazao > 50) conf -= 30;
  if (faixa < 4 || faixa > 20) conf -= 20;
  if (avgHaPerH > 45)           conf -= 25;
  if (durationMin < 10)         conf -= 40;
  conf = Math.max(0, conf);
  return { estHa, hoursOp: hoursOp.toFixed(1), confiability: conf, label: conf >= 80 ? 'Alta' : conf >= 50 ? 'Média' : 'Baixa' };
}

export function calcAMXScore(durationMin, weather, opData, config) {
  let score = 100;
  const w  = weather || {};
  const dt = w.deltaT || 5, wind = w.wind || 0, hum = w.humidity || 70, temp = w.temp || 25;
  if (dt < 2 || dt > 10) score -= 20; else if (dt > 8) score -= 10;
  if (wind > 20) score -= 25; else if (wind > 15) score -= 15; else if (wind > 10) score -= 5;
  if (hum > 90) score -= 10;
  if (hum < 40) score -= 10;
  if (temp > 35) score -= 15;
  if (temp < 10) score -= 10;
  if (durationMin < 5) score -= 30; else if (durationMin < 10) score -= 15;
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 4)  score -= 20;
  if (hour >= 5 && hour <= 9) score += 5;
  const vazao = parseFloat(config?.vazao) || 10;
  if (vazao >= 5 && vazao <= 30)    score += 5;
  if ((opData?.pauses || 0) > 3)    score -= 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function amxLabel(score) {
  if (score >= 90) return { label: 'Excelente', color: '#3da866' };
  if (score >= 75) return { label: 'Ótimo',     color: '#5ec880' };
  if (score >= 60) return { label: 'Bom',        color: '#1e88d0' };
  if (score >= 40) return { label: 'Moderado',   color: '#e07a00' };
  return { label: 'Risco', color: '#e03535' };
}

// ── Getters / Helpers ─────────────────────────────────────────
export function isOperating()  { return _operationActive; }
export function getMap()       { return _map; }
export function getMarkers()   { return _markers; }

export function calcDistance(lat1, lon1, lat2, lon2) {
  const R  = 6371;
  const dL = (lat2 - lat1) * Math.PI / 180;
  const dN = (lon2 - lon1) * Math.PI / 180;
  const a  = Math.sin(dL / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dN / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function findNearbyPilots(lat, lon, radiusKm) {
  const nearby = [];
  Object.values(_markers).forEach(marker => {
    const pilot = marker._pilotData;
    if (!pilot || pilot.isCurrentUser) return;
    const d = calcDistance(lat, lon, pilot.lat, pilot.lon);
    if (d <= radiusKm) nearby.push({ ...pilot, distKm: Math.round(d) });
  });
  return nearby;
}

function _updatePilotCount() {
  const total = Object.keys(_markers).length;
  const el    = document.getElementById('pilotCount');
  if (el) el.textContent = `${total} pilotos`;
}
