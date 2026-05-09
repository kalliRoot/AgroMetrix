// ═══════════════════════════════════════════════════════════════
//  AgroMetrix Radar — radar.js
//  Mapa Leaflet · Pilotos reais · Bots simulados · Operações
// ═══════════════════════════════════════════════════════════════

let _map = null;
let _markers = {};
let _botInterval = null;
let _locationInterval = null;
let _operationActive = false;
let _operationStart = null;
let _operationData  = {};

// ── Bots simulados (pilotos realistas) ───────────────────────
const BOTS = [
  { id:'bot_001', name:'Carlos Mendonça',   city:'Sorriso, MT',      drone:'DJI Agras T40',  score:87, photo:'👨‍✈️', hoursTotal:1240, opsTotal:312 },
  { id:'bot_002', name:'Rafael Bueno',      city:'Rondonópolis, MT', drone:'XAG P100 Pro',   score:92, photo:'🧑‍✈️', hoursTotal:890,  opsTotal:198 },
  { id:'bot_003', name:'Marcos Figueiredo', city:'Lucas do Rio Verde',drone:'DJI Agras T30',  score:74, photo:'👨‍✈️', hoursTotal:560,  opsTotal:143 },
  { id:'bot_004', name:'Thiago Cavalcante', city:'Primavera do Leste',drone:'XAG V40',        score:95, photo:'🧑‍✈️', hoursTotal:2100, opsTotal:487 },
  { id:'bot_005', name:'Diego Almeida',     city:'Campo Verde, MT',  drone:'DJI Agras T50',  score:81, photo:'👨‍✈️', hoursTotal:720,  opsTotal:201 },
  { id:'bot_006', name:'Leandro Souza',     city:'Nova Mutum, MT',   drone:'Pegasus Agri 10',score:68, photo:'🧑‍✈️', hoursTotal:430,  opsTotal:98  },
  { id:'bot_007', name:'Fabio Martins',     city:'Sapezal, MT',      drone:'DJI Agras T40',  score:89, photo:'👨‍✈️', hoursTotal:1560, opsTotal:389 },
  { id:'bot_008', name:'Anderson Lima',     city:'Sinop, MT',        drone:'XAG P100 Pro',   score:77, photo:'🧑‍✈️', hoursTotal:680,  opsTotal:167 },
];

// ── Inicializar mapa ──────────────────────────────────────────
export function initMap(containerId, lat, lon) {
  if (_map) { _map.remove(); _map = null; }

  _map = L.map(containerId, {
    zoomControl: false,
    attributionControl: false,
  }).setView([lat || -15.7801, lon || -47.9292], 10);

  // Tile escuro (radar style)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 18,
    subdomains: 'abcd',
  }).addTo(_map);

  // Zoom controls posição customizada
  L.control.zoom({ position: 'bottomright' }).addTo(_map);

  // Atribuição discreta
  L.control.attribution({ position: 'bottomleft', prefix: '' })
    .addAttribution('© OSM · CartoDB').addTo(_map);

  return _map;
}

// ── Ícone de piloto ───────────────────────────────────────────
function pilotIcon(status, isUser = false) {
  const color = status === 'operating' ? '#3da866' : status === 'online' ? '#1e88d0' : '#555';
  const size  = isUser ? 44 : 36;
  const pulse = (status === 'operating') ? `
    <circle cx="18" cy="18" r="16" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.4">
      <animate attributeName="r" from="14" to="22" dur="1.8s" repeatCount="indefinite"/>
      <animate attributeName="opacity" from="0.5" to="0" dur="1.8s" repeatCount="indefinite"/>
    </circle>` : '';

  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
    ${pulse}
    <circle cx="18" cy="18" r="13" fill="${color}" opacity="0.15"/>
    <circle cx="18" cy="18" r="9" fill="${color}" opacity="0.9"/>
    ${isUser ? '<circle cx="18" cy="18" r="5" fill="white" opacity="0.9"/>' : ''}
    ${status === 'operating' ? '<circle cx="18" cy="18" r="4" fill="#0d2b1a"/>' : ''}
  </svg>`;

  return L.divIcon({
    html: svg,
    className: '',
    iconSize:   [size, size],
    iconAnchor: [size/2, size/2],
  });
}

// ── Adicionar/atualizar piloto no mapa ────────────────────────
export function upsertPilot(pilot) {
  if (!_map || !pilot.lat || !pilot.lon) return;

  const isUser = pilot.isCurrentUser === true;
  const icon   = pilotIcon(pilot.status, isUser);

  const popupHTML = `
    <div style="font-family:'Syne',sans-serif;min-width:180px;padding:4px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <div style="font-size:28px">${pilot.photo || '👨‍✈️'}</div>
        <div>
          <div style="font-weight:700;font-size:13px;color:#e8f5eb">${pilot.name}</div>
          <div style="font-size:10px;color:#5a8a65">${pilot.city || ''}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
        <span style="background:#1f5534;color:#5ec880;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700">
          AMX ${pilot.score || 0}
        </span>
        <span style="background:#111d14;color:#9ac8a6;padding:2px 8px;border-radius:6px;font-size:10px">
          ${pilot.status === 'operating' ? '🚁 Operando' : '🟢 Online'}
        </span>
      </div>
      <div style="font-size:10px;color:#5a8a65">🚁 ${pilot.drone || 'Drone agrícola'}</div>
      <div style="font-size:10px;color:#5a8a65;margin-top:2px">⏱ ${pilot.hoursTotal || 0}h · ${pilot.opsTotal || 0} operações</div>
    </div>`;

  if (_markers[pilot.id]) {
    _markers[pilot.id].setLatLng([pilot.lat, pilot.lon]);
    _markers[pilot.id].setIcon(icon);
    _markers[pilot.id].setPopupContent(popupHTML);
  } else {
    _markers[pilot.id] = L.marker([pilot.lat, pilot.lon], { icon })
      .bindPopup(popupHTML, {
        className:   'amx-popup',
        maxWidth:    220,
        closeButton: false,
      })
      .addTo(_map);
  }
}

export function removePilot(id) {
  if (_markers[id]) { _markers[id].remove(); delete _markers[id]; }
}

// ── Spawnar bots ao redor de uma localização ─────────────────
export function spawnBots(centerLat, centerLon, weatherState) {
  const hour    = new Date().getHours();
  const isDay   = hour >= 5 && hour <= 18;
  const goodWind = (weatherState?.wind || 0) <= 20;

  // Bots só operam de dia com vento ok
  const activeBots = BOTS.filter((_, i) => {
    if (!isDay) return i < 2; // alguns ficam online à noite
    if (!goodWind) return i < 4; // menos ativos com vento ruim
    return true;
  });

  activeBots.forEach((bot, i) => {
    // Posição aleatória num raio de 5~40km
    const angle  = (i / activeBots.length) * Math.PI * 2 + Math.random() * 0.5;
    const radius = (5 + Math.random() * 35) / 111; // graus
    const lat    = centerLat + Math.cos(angle) * radius;
    const lon    = centerLon + Math.sin(angle) * radius / Math.cos(centerLat * Math.PI / 180);

    const isOperating = isDay && goodWind && Math.random() > 0.35;

    upsertPilot({
      ...bot,
      lat,
      lon,
      status: isOperating ? 'operating' : 'online',
    });
  });
}

// ── Atualizar bots periodicamente (movimento sutil) ──────────
export function startBotUpdates(centerLat, centerLon) {
  if (_botInterval) clearInterval(_botInterval);
  _botInterval = setInterval(() => {
    Object.entries(_markers).forEach(([id, marker]) => {
      if (!id.startsWith('bot_')) return;
      const pos = marker.getLatLng();
      // Movimento pequeno simulando operação
      const dlat = (Math.random() - 0.5) * 0.003;
      const dlon = (Math.random() - 0.5) * 0.003;
      marker.setLatLng([pos.lat + dlat, pos.lng + dlon]);
    });
  }, 15000); // a cada 15s
}

export function stopBotUpdates() {
  if (_botInterval) clearInterval(_botInterval);
}

// ── Rastrear localização do usuário ──────────────────────────
export function startLocationTracking(uid, onUpdate) {
  let lastLat = null, lastLon = null;

  function update() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude: lat, longitude: lon } = pos.coords;
      const dist = lastLat
        ? Math.sqrt(Math.pow((lat - lastLat) * 111000, 2) + Math.pow((lon - lastLon) * 111000, 2))
        : 9999;

      if (dist >= 300 || !lastLat) {
        lastLat = lat; lastLon = lon;
        onUpdate(lat, lon);
      }
    }, null, { enableHighAccuracy: true, timeout: 10000 });
  }

  update();
  if (_locationInterval) clearInterval(_locationInterval);
  _locationInterval = setInterval(update, 30000);
}

export function stopLocationTracking() {
  if (_locationInterval) clearInterval(_locationInterval);
}

// ── Modo Operação ─────────────────────────────────────────────
export function startOperation(weatherState, lat, lon) {
  _operationActive = true;
  _operationStart  = Date.now();
  _operationData   = {
    startTime:   new Date().toISOString(),
    lat, lon,
    weather:     { ...weatherState },
    pauses:      0,
    lastActive:  Date.now(),
  };
  return _operationData;
}

export function endOperation(weatherState) {
  if (!_operationActive) return null;
  _operationActive = false;

  const duration = Math.round((Date.now() - _operationStart) / 60000); // minutos
  const score    = calcAMXScore(duration, weatherState, _operationData);

  return {
    ..._operationData,
    endTime:  new Date().toISOString(),
    duration, // minutos
    score,
  };
}

export function isOperating() { return _operationActive; }

// ── AMX Score ─────────────────────────────────────────────────
export function calcAMXScore(durationMin, weather, opData) {
  let score = 100;
  const w   = weather || {};

  // Clima
  const dt   = w.deltaT || 5;
  const wind = w.wind   || 0;
  const hum  = w.humidity || 70;
  const temp = w.temp   || 25;

  // Delta T ideal 2-8
  if (dt < 2 || dt > 10) score -= 20;
  else if (dt > 8)        score -= 10;

  // Vento
  if (wind > 20) score -= 25;
  else if (wind > 15) score -= 15;
  else if (wind > 10) score -= 5;

  // Umidade
  if (hum > 90) score -= 10;
  if (hum < 40) score -= 10;

  // Temperatura
  if (temp > 35) score -= 15;
  if (temp < 10) score -= 10;

  // Duração mínima coerente (>10 min)
  if (durationMin < 5)  score -= 30;
  else if (durationMin < 10) score -= 15;

  // Horário (bônus madrugada penaliza)
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 4) score -= 20;
  if (hour >= 5 && hour <= 9) score += 5; // manhã cedo é ideal

  score = Math.max(0, Math.min(100, Math.round(score)));

  return score;
}

export function amxLabel(score) {
  if (score >= 90) return { label: 'Excelente', color: '#3da866' };
  if (score >= 75) return { label: 'Ótimo',     color: '#5ec880' };
  if (score >= 60) return { label: 'Bom',        color: '#1e88d0' };
  if (score >= 40) return { label: 'Moderado',   color: '#e07a00' };
  return               { label: 'Risco',        color: '#e03535' };
}

export function getMap() { return _map; }
