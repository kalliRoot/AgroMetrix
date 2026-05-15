// ═══════════════════════════════════════════════════════════════
//  AgroMetrix Radar — radar.js v5.0
//  25 Bots Agrícolas Reais · Sistema de Domínio · Chamados · SOS
// ═══════════════════════════════════════════════════════════════

// ── Estado global ─────────────────────────────────────────────
let _map             = null;
let _markers         = {};          // markers de pilotos
let _domainLayers    = {};          // beacons de domínio
let _botInterval     = null;
let _locationInterval= null;
let _operationActive = false;
let _operationStart  = null;
let _operationData   = {};
let _operationConfig = {};
let _pauseTimer      = null;
let _autoEndTimer    = null;
let _currentUid      = null;
let _loopSoundInt    = null;
let _callTimerInt    = null;

// Sistema de chamados
const _activeCalls   = new Map();   // callId → call
let _currentCallId   = null;
const _shownCalls    = new Set();   // IDs já exibidos nesta sessão

// ── 25 BOTS AGRÍCOLAS — regiões reais do agro brasileiro ──────
export const AGRO_BOTS = [
  // MATO GROSSO (8 bots)
  { id:'abot_01', name:'Carlos Mendonça',   sex:'m', city:'Sorriso, MT',          lat:-12.549, lon:-55.720, drone:'DJI Agras T40',   score:87, hoursTotal:1240, opsTotal:312, ha:48, photo:'👨‍✈️' },
  { id:'abot_02', name:'Rafael Bueno',      sex:'m', city:'Lucas do Rio Verde, MT',lat:-13.055, lon:-55.917, drone:'XAG P100 Pro',    score:92, hoursTotal:890,  opsTotal:198, ha:61, photo:'🧑‍✈️' },
  { id:'abot_03', name:'Marcos Figueiredo', sex:'m', city:'Sinop, MT',             lat:-11.864, lon:-55.508, drone:'DJI Agras T30',   score:74, hoursTotal:560,  opsTotal:143, ha:33, photo:'👨‍✈️' },
  { id:'abot_04', name:'Thiago Cavalcante', sex:'m', city:'Primavera do Leste, MT',lat:-15.552, lon:-54.289, drone:'XAG V40',         score:95, hoursTotal:2100, opsTotal:487, ha:72, photo:'🧑‍✈️' },
  { id:'abot_05', name:'Diego Almeida',     sex:'m', city:'Campo Verde, MT',       lat:-15.540, lon:-55.160, drone:'DJI Agras T50',   score:81, hoursTotal:720,  opsTotal:201, ha:55, photo:'👨‍✈️' },
  { id:'abot_06', name:'Leandro Souza',     sex:'m', city:'Nova Mutum, MT',        lat:-13.830, lon:-56.084, drone:'Pegasus Agri 10', score:68, hoursTotal:430,  opsTotal:98,  ha:27, photo:'🧑‍✈️' },
  { id:'abot_07', name:'Fabio Martins',     sex:'m', city:'Sapezal, MT',           lat:-13.543, lon:-58.820, drone:'DJI Agras T40',   score:89, hoursTotal:1560, opsTotal:389, ha:64, photo:'👨‍✈️' },
  { id:'abot_08', name:'Anderson Lima',     sex:'m', city:'Rondonópolis, MT',      lat:-16.473, lon:-54.635, drone:'XAG P100 Pro',    score:77, hoursTotal:680,  opsTotal:167, ha:41, photo:'🧑‍✈️' },

  // GOIÁS + TRIÂNGULO MINEIRO (4 bots)
  { id:'abot_09', name:'Bruno Ferreira',    sex:'m', city:'Rio Verde, GO',         lat:-17.793, lon:-50.928, drone:'DJI Agras T40',   score:83, hoursTotal:940,  opsTotal:228, ha:57, photo:'👨‍✈️' },
  { id:'abot_10', name:'Rodrigo Gomes',     sex:'m', city:'Jataí, GO',             lat:-17.880, lon:-51.715, drone:'XAG V40',         score:79, hoursTotal:510,  opsTotal:134, ha:39, photo:'🧑‍✈️' },
  { id:'abot_11', name:'Gustavo Pereira',   sex:'m', city:'Uberlândia, MG',        lat:-18.918, lon:-48.277, drone:'DJI Agras T50',   score:91, hoursTotal:1750, opsTotal:421, ha:68, photo:'👨‍✈️' },
  { id:'abot_12', name:'Leonardo Teixeira', sex:'m', city:'Uberaba, MG',           lat:-19.748, lon:-47.931, drone:'XAG P100 Pro',    score:73, hoursTotal:390,  opsTotal:102, ha:29, photo:'🧑‍✈️' },

  // OESTE DA BAHIA + MATOPIBA (4 bots)
  { id:'abot_13', name:'Felipe Nogueira',   sex:'m', city:'Barreiras, BA',         lat:-12.152, lon:-44.988, drone:'DJI Agras T40',   score:85, hoursTotal:1100, opsTotal:267, ha:53, photo:'👨‍✈️' },
  { id:'abot_14', name:'Ricardo Farias',    sex:'m', city:'Luís Eduardo Magalhães, BA',lat:-12.096,lon:-45.793,drone:'EAVision U10',  score:70, hoursTotal:445,  opsTotal:118, ha:36, photo:'🧑‍✈️' },
  { id:'abot_15', name:'Alexandre Nunes',   sex:'m', city:'Balsas, MA',            lat:-7.532,  lon:-46.036, drone:'XAG P100 Pro',    score:76, hoursTotal:620,  opsTotal:155, ha:44, photo:'👨‍✈️' },
  { id:'abot_16', name:'Henrique Lima',     sex:'m', city:'Palmas, TO',            lat:-10.249, lon:-48.324, drone:'DJI Agras T30',   score:65, hoursTotal:320,  opsTotal:87,  ha:22, photo:'🧑‍✈️' },

  // PARANÁ + INTERIOR SP (4 bots)
  { id:'abot_17', name:'Marcelo Batista',   sex:'m', city:'Cascavel, PR',          lat:-24.955, lon:-53.455, drone:'DJI Agras T50',   score:88, hoursTotal:1340, opsTotal:335, ha:60, photo:'👨‍✈️' },
  { id:'abot_18', name:'Daniel Martins',    sex:'m', city:'Maringá, PR',           lat:-23.420, lon:-51.933, drone:'XAG V40',         score:80, hoursTotal:710,  opsTotal:189, ha:46, photo:'🧑‍✈️' },
  { id:'abot_19', name:'Paulo Rezende',     sex:'m', city:'Ribeirão Preto, SP',    lat:-21.178, lon:-47.810, drone:'DJI Agras T40',   score:82, hoursTotal:830,  opsTotal:214, ha:50, photo:'👨‍✈️' },
  { id:'abot_20', name:'Sérgio Andrade',    sex:'m', city:'Barretos, SP',          lat:-20.558, lon:-48.567, drone:'XAG P100 Pro',    score:69, hoursTotal:395,  opsTotal:101, ha:31, photo:'🧑‍✈️' },

  // MULHERES — 5 bots espalhadas
  { id:'abot_21', name:'Ana Costa',         sex:'f', city:'Sorriso, MT',           lat:-12.630, lon:-55.640, drone:'DJI Agras T40',   score:94, hoursTotal:1820, opsTotal:443, ha:70, photo:'👩‍✈️' },
  { id:'abot_22', name:'Fernanda Souza',    sex:'f', city:'Rio Verde, GO',         lat:-17.710, lon:-50.840, drone:'XAG P100 Pro',    score:86, hoursTotal:1010, opsTotal:252, ha:58, photo:'👩‍✈️' },
  { id:'abot_23', name:'Camila Duarte',     sex:'f', city:'Barreiras, BA',         lat:-12.060, lon:-45.010, drone:'EAVision U10',    score:78, hoursTotal:540,  opsTotal:138, ha:40, photo:'👩‍✈️' },
  { id:'abot_24', name:'Renata Viana',      sex:'f', city:'Cascavel, PR',          lat:-24.890, lon:-53.500, drone:'DJI Agras T50',   score:90, hoursTotal:1610, opsTotal:397, ha:66, photo:'👩‍✈️' },
  { id:'abot_25', name:'Bianca Amaral',     sex:'f', city:'Uberlândia, MG',        lat:-18.850, lon:-48.300, drone:'XAG V40',         score:72, hoursTotal:460,  opsTotal:119, ha:34, photo:'👩‍✈️' },
];

// Drift máximo por bot (permanece na região de origem)
const BOT_DRIFT_KM = 12; // km max de desvio da base

// ── Inicializar mapa ──────────────────────────────────────────
export function initMap(containerId, lat, lon) {
  if (_map) { _map.remove(); _map = null; }

  _map = L.map(containerId, { zoomControl: false, attributionControl: false })
           .setView([lat || -15.78, lon || -47.93], 10);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© OpenStreetMap',
  }).addTo(_map);

  L.control.zoom({ position: 'bottomright' }).addTo(_map);
  L.control.attribution({ position: 'bottomleft' }).addTo(_map);

  // Debounce no evento de zoom — evita render excessivo
  let _zoomTimeout = null;
  _map.on('zoomend', () => {
    if (_zoomTimeout) clearTimeout(_zoomTimeout);
    _zoomTimeout = setTimeout(() => _refreshDomainLabels(), 300);
  });

  return _map;
}

// ── Ícone de piloto ───────────────────────────────────────────
function pilotIcon(status, isUser = false) {
  const isSOS     = status === 'sos';
  const isOp      = status === 'operating';
  const isReq     = status === 'request';
  let color = isOp ? '#3da866' : isSOS ? '#e03535' : isReq ? '#f5a623' : '#1e88d0';
  const size = isUser ? 48 : 36;
  let svg = `<svg width="${size}" height="${size}" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">`;

  if (isSOS)  svg += `<circle cx="20" cy="20" r="14" fill="none" stroke="#e03535" stroke-width="2.5"><animate attributeName="r" from="14" to="28" dur="1s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.8;0" dur="1s" repeatCount="indefinite"/></circle><circle cx="20" cy="20" r="14" fill="none" stroke="#e03535" stroke-width="1.5"><animate attributeName="r" from="14" to="38" dur="1s" begin=".35s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.5;0" dur="1s" begin=".35s" repeatCount="indefinite"/></circle>`;
  if (isReq)  svg += `<circle cx="20" cy="20" r="14" fill="none" stroke="#f5a623" stroke-width="2"><animate attributeName="r" from="14" to="26" dur="1.4s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.6;0" dur="1.4s" repeatCount="indefinite"/></circle>`;
  if (isOp)   svg += `<circle cx="20" cy="20" r="14" fill="none" stroke="${color}" stroke-width="1.5"><animate attributeName="r" from="13" to="22" dur="1.8s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.5;0" dur="1.8s" repeatCount="indefinite"/></circle>`;

  svg += `<circle cx="20" cy="20" r="13" fill="${color}" opacity="0.15"/>
          <circle cx="20" cy="20" r="9"  fill="${color}" opacity="0.95"/>`;
  if (isUser) svg += `<circle cx="20" cy="20" r="4" fill="white" opacity="0.95"/>`;
  if (isSOS)  svg += `<text x="20" y="24" text-anchor="middle" font-size="11" fill="white">🚨</text>`;
  else if (isReq) svg += `<text x="20" y="24" text-anchor="middle" font-size="11" fill="white">🔧</text>`;
  else if (isOp)  svg += `<text x="20" y="24" text-anchor="middle" font-size="11" fill="white">🚁</text>`;
  svg += `</svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [size, size], iconAnchor: [size/2, size/2] });
}

// ── Ícone de domínio (beacon discreto) ───────────────────────
function domainIcon(pilotName) {
  const html = `<div style="position:relative;width:22px;height:22px">
    <div style="position:absolute;inset:0;border-radius:50%;border:1.5px solid rgba(94,200,128,.6);animation:dmPulse 2.4s ease-in-out infinite"></div>
    <div style="position:absolute;inset:4px;border-radius:50%;background:rgba(61,168,102,.8);box-shadow:0 0 8px rgba(94,200,128,.6)"></div>
  </div>`;
  return L.divIcon({ html, className: '', iconSize: [22, 22], iconAnchor: [11, 11] });
}

// ── Popup piloto ──────────────────────────────────────────────
function buildPopup(pilot) {
  const sn = (s) => (s || '').replace(/'/g, "\\'");
  const reqBtn = pilot.status === 'request' && !pilot.isCurrentUser
    ? `<button onclick="window.acceptReq('${pilot.id}','${sn(pilot.name)}','${sn(pilot.requestMsg)}')" style="margin-top:8px;width:100%;padding:7px;border-radius:8px;border:none;background:#f5a623;color:#0d1a0f;font-weight:700;font-size:12px;cursor:pointer">✅ Aceitar chamado</button>` : '';
  const sosBtn = pilot.status === 'sos' && !pilot.isCurrentUser
    ? `<button onclick="window.acceptReq('${pilot.id}','${sn(pilot.name)}','🚨 SOS — Preciso de ajuda!')" style="margin-top:8px;width:100%;padding:7px;border-radius:8px;border:none;background:#e03535;color:white;font-weight:700;font-size:12px;cursor:pointer">🚨 Responder SOS</button>` : '';
  const chatBtn = !pilot.isCurrentUser
    ? `<button onclick="window.openChatWith('${pilot.id}','${sn(pilot.name)}')" style="margin-top:6px;width:100%;padding:6px;border-radius:8px;border:1px solid rgba(61,168,102,.4);background:transparent;color:#5ec880;font-size:12px;cursor:pointer">💬 Chat</button>` : '';
  const statusText = pilot.status === 'sos' ? '🚨 SOS' : pilot.status === 'request' ? '🔧 Pedido' : pilot.status === 'operating' ? '🚁 Operando' : '🟢 Online';

  return `<div style="font-family:'Syne',sans-serif;min-width:190px;padding:4px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <div style="font-size:22px">${pilot.photo || '👨‍✈️'}</div>
      <div>
        <div style="font-weight:700;font-size:14px;color:#e8f5eb">${pilot.name || 'Piloto'}</div>
        <div style="font-size:10px;color:#5a8a65">${pilot.city || ''}</div>
      </div>
    </div>
    <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px">
      <span style="background:#1f5534;color:#5ec880;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700">AMX ${pilot.score || 0}</span>
      <span style="background:#111d14;color:#9ac8a6;padding:2px 8px;border-radius:6px;font-size:10px">${statusText}</span>
      ${pilot.ha ? `<span style="background:#111d14;color:#5ec880;padding:2px 8px;border-radius:6px;font-size:10px">${pilot.ha} ha</span>` : ''}
    </div>
    ${pilot.requestMsg ? `<div style="font-size:11px;color:#f5a623;margin-bottom:4px">📢 ${pilot.requestMsg}</div>` : ''}
    <div style="font-size:10px;color:#5a8a65">🚁 ${pilot.drone || 'Drone agrícola'}</div>
    <div style="font-size:10px;color:#5a8a65;margin-top:2px">⏱ ${pilot.hoursTotal || 0}h · ${pilot.opsTotal || 0} ops</div>
    ${reqBtn}${sosBtn}${chatBtn}
  </div>`;
}

// Popup do beacon de domínio
function buildDomainPopup(pilot, since) {
  return `<div style="font-family:'Syne',sans-serif;padding:6px;min-width:180px">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#5a8a65;margin-bottom:6px">🏆 Domina esta área</div>
    <div style="display:flex;align-items:center;gap:8px">
      <div style="font-size:20px">${pilot.photo || '👨‍✈️'}</div>
      <div>
        <div style="font-weight:700;font-size:13px;color:#e8f5eb">${pilot.name}</div>
        <div style="font-size:10px;color:#5a8a65">${pilot.city}</div>
      </div>
    </div>
    <div style="margin-top:8px;display:flex;gap:5px;flex-wrap:wrap">
      <span style="background:#1f5534;color:#5ec880;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700">${pilot.ha} ha</span>
      <span style="background:#111d14;color:#9ac8a6;padding:2px 8px;border-radius:6px;font-size:10px">AMX ${pilot.score}</span>
    </div>
    <div style="font-size:10px;color:#5a8a65;margin-top:5px">🚁 ${pilot.drone}</div>
    ${since ? `<div style="font-size:9px;color:#3a6a45;margin-top:3px">Dominando desde ${since}</div>` : ''}
  </div>`;
}

// ── UPSERT PILOTO ─────────────────────────────────────────────
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
      .bindPopup(popup, { className: 'amx-popup', maxWidth: 240, closeButton: false })
      .addTo(_map);
    m._pilotData = pilot;
    _markers[pilot.id] = m;
  }
}

export function removePilot(id) {
  if (_markers[id]) { _markers[id].remove(); delete _markers[id]; }
}

// ── SISTEMA DE DOMÍNIO DE ÁREA (grid 0.5°) ───────────────────
function _gridKey(lat, lon) {
  return `${Math.floor(lat / 0.5) * 0.5}_${Math.floor(lon / 0.5) * 0.5}`;
}

function _buildDomainMap(bots) {
  const grids = {};
  bots.forEach(bot => {
    const key = _gridKey(bot.lat, bot.lon);
    if (!grids[key] || (bot.ha || 0) > (grids[key].ha || 0)) grids[key] = bot;
  });
  return grids;
}

function _renderDomainBeacons(bots) {
  // Limpar beacons antigos
  Object.values(_domainLayers).forEach(m => m.remove());
  _domainLayers = {};

  const grids = _buildDomainMap(bots);
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

  Object.entries(grids).forEach(([key, pilot]) => {
    // Beacon no centro do grid
    const [glat, glon] = key.split('_').map(Number);
    const clat = glat + 0.25, clon = glon + 0.25;

    const icon = domainIcon(pilot.name);
    const m = L.marker([clat, clon], { icon, zIndexOffset: -100 })
      .bindPopup(buildDomainPopup(pilot, today), { className: 'amx-popup', maxWidth: 220, closeButton: false })
      .addTo(_map);
    _domainLayers[key] = m;
  });
}

// Mostra label de domínio só em zoom alto
function _refreshDomainLabels() {
  if (!_map) return;
  const zoom = _map.getZoom();
  Object.entries(_domainLayers).forEach(([, m]) => {
    const el = m.getElement();
    if (!el) return;
    // Zoom ≥ 12 → mostra tooltip com nome
    if (zoom >= 12) {
      if (!m._tooltipBound) {
        const pilot = AGRO_BOTS.find(b => b.id === m._botId) || {};
        m.bindTooltip(pilot.name || '', { permanent: true, direction: 'top', offset: [0, -14], className: 'amx-domain-label' });
        m._tooltipBound = true;
      }
    } else {
      if (m._tooltipBound) { m.unbindTooltip(); m._tooltipBound = false; }
    }
  });
}

// ── SPAWN BOTS — posição base + drift pequeno ─────────────────
export function spawnBots(centerLat, centerLon, weather) {
  const hour     = new Date().getHours();
  const isDay    = hour >= 5 && hour <= 18;
  const goodWind = (weather?.wind || 0) <= 20;

  // Quantos bots ficam ativos
  const active = AGRO_BOTS.filter((_, i) => {
    if (!isDay)    return i < 8;   // madrugada: 8 bots
    if (!goodWind) return i < 16;  // vento alto: 16 bots
    return true;                    // dia bom:   todos 25
  });

  active.forEach(bot => {
    // Drift orgânico — máx BOT_DRIFT_KM km da base
    const driftLat = (Math.random() - 0.5) * (BOT_DRIFT_KM / 111) * 2;
    const driftLon = (Math.random() - 0.5) * (BOT_DRIFT_KM / 111) * 2;
    const blat = bot.lat + driftLat;
    const blon = bot.lon + driftLon;
    const isOp = isDay && goodWind && Math.random() > 0.38;

    upsertPilot({
      ...bot,
      lat: blat, lon: blon,
      status: isOp ? 'operating' : 'online',
      isCurrentUser: false,
    });
  });

  // Beacons de domínio (baseados na posição fixa, não drift)
  _renderDomainBeacons(active);
  _updatePilotCount();
}

export function startBotUpdates() {
  if (_botInterval) clearInterval(_botInterval);

  // Atualização leve a cada 90s (não 15s — evita sobrecarregar)
  _botInterval = setInterval(() => {
    const hour  = new Date().getHours();
    const isDay = hour >= 5 && hour <= 18;

    AGRO_BOTS.forEach(bot => {
      const m = _markers[bot.id];
      if (!m) return;
      const p = m.getLatLng();

      // Drift orgânico pequeno — máx 300m por tick
      const dlat = (Math.random() - 0.5) * 0.003;
      const dlon = (Math.random() - 0.5) * 0.003;

      // Garantir que não saia da área base (BOT_DRIFT_KM)
      const newLat = p.lat + dlat;
      const newLon = p.lng + dlon;
      const distFromBase = calcDistance(bot.lat, bot.lon, newLat, newLon);
      if (distFromBase > BOT_DRIFT_KM) return; // mantém na área

      m.setLatLng([newLat, newLon]);
      if (m._pilotData) { m._pilotData.lat = newLat; m._pilotData.lon = newLon; }
    });
  }, 90000);
}

export function stopBotUpdates() {
  if (_botInterval) clearInterval(_botInterval);
}

// ── LISTEN PILOTS (Firestore + bots offline) ──────────────────
export async function listenPilots(centerLat, centerLon, currentUid) {
  _currentUid = currentUid;
  Object.keys(_markers).forEach(id => { if (id !== currentUid) removePilot(id); });

  spawnBots(centerLat, centerLon, { wind: 10, temp: 25 });
  startBotUpdates();

  if (!window._firebaseDB) return;
  try {
    const { collection, onSnapshot, query, where } =
      await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const q = query(collection(window._firebaseDB, 'pilots'), where('visibility', '!=', 'invisible'));
    if (window._firestoreUnsub) window._firestoreUnsub();
    window._firestoreUnsub = onSnapshot(q, snap => {
      snap.docChanges().forEach(ch => {
        const d = ch.doc.data();
        if (ch.type === 'removed' || d.visibility === 'invisible') { removePilot(d.uid); return; }
        if (!d.lat || !d.lon) return;
        upsertPilot({
          id: d.uid, name: d.nickname || d.name || 'Piloto', photo: d.photo || '👨‍✈️',
          city: d.city || '', drone: d.drone || '', score: d.amxScore || 0,
          hoursTotal: d.hoursTotal || 0, opsTotal: d.opsTotal || 0,
          lat: d.lat, lon: d.lon, status: d.status || 'online',
          requestMsg: d.requestMsg || null, isCurrentUser: d.uid === currentUid,
        });
      });
      _updatePilotCount();
    });
  } catch (e) { console.log('Modo offline: apenas bots'); }
}

// ── SISTEMA DE CHAMADOS ───────────────────────────────────────
// FIX PRINCIPAL: botões nunca congelam porque usamos delegação de evento
// e recriamos o conteúdo interno sem clonar o elemento pai

export async function createCall(type, message, userCtx) {
  // Bloquear se já existe chamado ativo não aceito
  if (_currentCallId) {
    const ex = _activeCalls.get(_currentCallId);
    if (ex && !ex.accepted && Date.now() - ex.timestamp < 30000) return null;
  }

  _stopLoopSound();
  const callId = 'call_' + Date.now();
  _currentCallId = callId;

  _activeCalls.set(callId, {
    id: callId,
    uid:     userCtx?.uid     || 'anon',
    name:    userCtx?.name    || 'Piloto',
    type, message,
    lat:     userCtx?.lat     || -15.78,
    lon:     userCtx?.lon     || -47.93,
    timestamp: Date.now(),
    accepted: false,
  });

  // Auto-expirar após 30s
  setTimeout(() => {
    const c = _activeCalls.get(callId);
    if (c && !c.accepted) {
      _activeCalls.delete(callId);
      if (_currentCallId === callId) _currentCallId = null;
      _stopLoopSound();
    }
  }, 30000);

  return callId;
}

// FIX: Exibir modal de chamado sem congelar botões
// Usamos innerHTML limpo + addEventListener (sem cloneNode)
export function showCallModal(callData) {
  if (_shownCalls.has(callData.id)) return;
  _shownCalls.add(callData.id);

  const icons = { sos:'🚨', tow:'🚜', battery:'🔋', helice:'🚁', part:'🔧', support:'🛠️', fuel:'⛽' };

  // Criar ou reusar modal
  let wrap = document.getElementById('amxCallModal');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'amxCallModal';
    document.body.appendChild(wrap);
  }

  // FIX: innerHTML direto — não usa cloneNode que deixa eventos velhos presos
  wrap.innerHTML = `
    <div id="amxCallOverlay" style="position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;backdrop-filter:blur(3px)"></div>
    <div id="amxCallBox" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10000;background:#0d1a0f;border:1px solid rgba(61,168,102,.3);border-radius:20px;padding:24px;width:min(300px,calc(100vw - 32px));text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.7)">
      <div style="font-size:48px;margin-bottom:10px">${icons[callData.type] || '🔧'}</div>
      <div style="font-size:17px;font-weight:800;color:#e8f5eb;margin-bottom:6px">${callData.type === 'sos' ? '⚠️ SOS URGENTE!' : 'Novo Chamado'}</div>
      <div style="font-size:13px;color:#9ac8a6;margin-bottom:6px;line-height:1.4">${callData.pilotName || 'Piloto'}: ${callData.message}</div>
      <div style="margin-bottom:16px"><span id="amxCallTimer" style="background:#1f5534;color:#5ec880;padding:3px 12px;border-radius:20px;font-size:11px">Expira em 30s</span></div>
      <div style="display:flex;gap:10px">
        <button id="amxCallAccept" style="flex:1;padding:12px;background:#3da866;border:none;border-radius:12px;color:white;font-weight:800;font-size:13px;cursor:pointer;font-family:'Syne',sans-serif">✅ Aceitar</button>
        <button id="amxCallIgnore" style="flex:1;padding:12px;background:#1a2a1f;border:1px solid rgba(61,168,102,.3);border-radius:12px;color:#9ac8a6;font-weight:700;font-size:13px;cursor:pointer;font-family:'Syne',sans-serif">❌ Ignorar</button>
      </div>
    </div>`;

  // FIX: addEventListener direto (sem onclick em linha que pode ficar preso)
  let secs = 30;
  if (_callTimerInt) clearInterval(_callTimerInt);
  _callTimerInt = setInterval(() => {
    secs--;
    const el = document.getElementById('amxCallTimer');
    if (el) el.textContent = `Expira em ${secs}s`;
    if (secs <= 0) { clearInterval(_callTimerInt); _closeCallModal(); }
  }, 1000);

  _startLoopSound(callData.type === 'sos' ? 'sos' : 'request', 30000);

  // FIX: referência direta, sem cloneNode, sem onclick inline
  const btnAccept = document.getElementById('amxCallAccept');
  const btnIgnore = document.getElementById('amxCallIgnore');

  // Remove listeners antigos garantindo funções nomeadas
  btnAccept.onclick = null;
  btnIgnore.onclick = null;

  btnAccept.onclick = () => {
    clearInterval(_callTimerInt);
    _stopLoopSound();
    _closeCallModal();
    // Disparar evento para o radar.html tratar o aceite
    window.dispatchEvent(new CustomEvent('amx:call-accepted', { detail: callData }));
  };

  btnIgnore.onclick = () => {
    clearInterval(_callTimerInt);
    _stopLoopSound();
    _closeCallModal();
  };
}

function _closeCallModal() {
  const wrap = document.getElementById('amxCallModal');
  if (wrap) wrap.innerHTML = '';
}

// ── LOCALIZAÇÃO ───────────────────────────────────────────────
export function startLocationTracking(uid, onUpdate) {
  let lastLat = null, lastLon = null;
  const update = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude: lat, longitude: lon } = pos.coords;
      const dist = lastLat ? Math.sqrt(Math.pow((lat-lastLat)*111000,2)+Math.pow((lon-lastLon)*111000,2)) : 9999;
      if (dist >= 300 || !lastLat) { lastLat = lat; lastLon = lon; onUpdate(lat, lon); }
    }, null, { enableHighAccuracy: true, timeout: 10000 });
  };
  update();
  if (_locationInterval) clearInterval(_locationInterval);
  _locationInterval = setInterval(update, 60000);
}

export function stopLocationTracking() {
  if (_locationInterval) clearInterval(_locationInterval);
}

// ── OPERAÇÕES ─────────────────────────────────────────────────
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
  const vazao = parseFloat(config?.vazao) || 10;
  const faixa = parseFloat(config?.faixa) || 9;
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
  if (hum > 90) score -= 10; if (hum < 40) score -= 10;
  if (temp > 35) score -= 15; if (temp < 10) score -= 10;
  if (durationMin < 5) score -= 30; else if (durationMin < 10) score -= 15;
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 4) score -= 20;
  if (hour >= 5 && hour <= 9) score += 5;
  if ((parseFloat(config?.vazao) || 10) >= 5 && (parseFloat(config?.vazao) || 10) <= 30) score += 5;
  if ((opData?.pauses || 0) > 3) score -= 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function amxLabel(score) {
  if (score >= 90) return { label: 'Excelente', color: '#3da866' };
  if (score >= 75) return { label: 'Ótimo',     color: '#5ec880' };
  if (score >= 60) return { label: 'Bom',        color: '#1e88d0' };
  if (score >= 40) return { label: 'Moderado',   color: '#e07a00' };
  return { label: 'Risco', color: '#e03535' };
}

// ── SONS ──────────────────────────────────────────────────────
let _audioCtx = null;
function _getAudioCtx() {
  if (!_audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) _audioCtx = new AC();
  }
  return _audioCtx;
}

export function playSound(type) {
  const ctx = _getAudioCtx(); if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  const seqs = {
    request: { f:[523,659,784],     d:[.2,.2,.3]  },
    sos:     { f:[880,880,440,440], d:[.15,.15,.15,.3] },
    accept:  { f:[523,659,784,1047],d:[.1,.1,.1,.4] },
    message: { f:[440,550],         d:[.08,.08] },
  };
  const s = seqs[type] || seqs.request;
  let t = ctx.currentTime;
  s.f.forEach((freq, i) => {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.frequency.value = freq; g.gain.value = 0.22;
    osc.start(t); g.gain.exponentialRampToValueAtTime(0.00001, t + s.d[i]); osc.stop(t + s.d[i]);
    t += s.d[i];
  });
}

function _startLoopSound(type, durationMs) {
  _stopLoopSound();
  let elapsed = 0;
  const interval = 800;
  const tick = () => {
    if (elapsed >= durationMs) { _stopLoopSound(); return; }
    playSound(type);
    elapsed += interval;
    _loopSoundInt = setTimeout(tick, interval);
  };
  playSound(type);
  _loopSoundInt = setTimeout(tick, interval);
}

function _stopLoopSound() {
  if (_loopSoundInt) { clearTimeout(_loopSoundInt); _loopSoundInt = null; }
}

// Exportar sons para uso externo
export { _startLoopSound as startLoopSound, _stopLoopSound as stopLoopSound };

// ── HELPERS ───────────────────────────────────────────────────
export function calcDistance(lat1, lon1, lat2, lon2) {
  const R = 6371, dL = (lat2-lat1)*Math.PI/180, dN = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dL/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dN/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export function findNearbyPilots(lat, lon, radiusKm) {
  return Object.values(_markers)
    .map(m => m._pilotData)
    .filter(p => p && !p.isCurrentUser && calcDistance(lat, lon, p.lat, p.lon) <= radiusKm);
}

export function loadRealChatsOnly(chats) {
  if (!Array.isArray(chats)) return [];
  return chats.filter(c => c.uid && c.uid.length > 5 && !c.uid.includes('demo') && c.fake !== true);
}

export function isOperating()  { return _operationActive; }
export function getMap()       { return _map; }
export function getMarkers()   { return _markers; }
export function getActiveCall(){ return _currentCallId ? _activeCalls.get(_currentCallId) : null; }

function _updatePilotCount() {
  const pilotos  = Object.keys(_markers).length;
  const dominios = Object.keys(_domainLayers).length;
  const el = document.getElementById('pilotCount');
  if (el) el.textContent = `${pilotos} pilotos · ${dominios} áreas`;
}

// ── CSS de suporte injetado uma vez ──────────────────────────
(function injectCSS() {
  if (document.getElementById('radar-js-css')) return;
  const s = document.createElement('style');
  s.id = 'radar-js-css';
  s.textContent = `
    @keyframes dmPulse{0%,100%{transform:scale(1);opacity:.7}50%{transform:scale(1.5);opacity:1}}
    .amx-domain-label{background:rgba(11,22,13,.9)!important;border:1px solid rgba(61,168,102,.3)!important;color:#5ec880!important;font-size:10px!important;font-family:'Syne',sans-serif!important;padding:2px 7px!important;border-radius:6px!important;box-shadow:none!important}
    .amx-domain-label::before{display:none!important}
    #amxCallAccept:hover{filter:brightness(1.15)}
    #amxCallIgnore:hover{border-color:rgba(224,53,53,.5)!important;color:#ff8080!important}
  `;
  document.head.appendChild(s);
})();
