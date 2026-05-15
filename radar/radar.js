// ═══════════════════════════════════════════════════════════════
//  AgroMetrix Radar — radar.js v5.1
//  Mapa Leaflet · Pilotos reais · Bots espalhados · SOS · Operações
// ═══════════════════════════════════════════════════════════════

let _map = null;
let _markers = {};         // apenas pilotos (bots + reais)
let _beaconMarkers = {};   // beacons de área (separado dos pilotos)
let _botInterval = null;
let _locationInterval = null;
let _operationActive = false;
let _operationStart = null;
let _operationData = {};
let _operationConfig = {};
let _pauseTimer = null;
let _autoEndTimer = null;
let _currentUid = null;

// ═══════════════════════════════════════════════════════════════
// SISTEMA "DONO DA ÁREA" v2 - VISUAL FUTURISTA LIMPO
// ═══════════════════════════════════════════════════════════════

const areaOwners = {};
const areaBeacons = {};
const GRID_SIZE = 0.5;

function getGridKey(lat, lon) {
  return `${Math.floor(lat / GRID_SIZE)}_${Math.floor(lon / GRID_SIZE)}`;
}

function updateAreaOwner(pilot) {
  if (!_map || !pilot.lat || !pilot.lon) return;
  
  const key = getGridKey(pilot.lat, pilot.lon);
  const hectares = Math.min(
    Number(pilot.hectares || pilot.opsTotal * 2.5 || 0),
    500
  );
  
  const current = areaOwners[key];
  
  if (current && current.pilotId === pilot.id) {
    current.hectares = hectares;
    current.lastUpdate = Date.now();
    if (current.beaconRef) updateBeaconVisual(current);
    return;
  }
  
  if (!current || hectares > current.hectares) {
    areaOwners[key] = {
      pilotId: pilot.id,
      name: (pilot.name || pilot.nickname || 'Piloto').substring(0, 20),
      photo: pilot.photo || '👨‍✈️',
      city: (pilot.city || '').split(',')[0],
      drone: pilot.drone || 'Drone Agrícola',
      hectares: hectares,
      since: new Date().toLocaleDateString('pt-BR'),
      lastUpdate: Date.now(),
      lat: pilot.lat,
      lon: pilot.lon,
      beaconRef: null
    };
    renderBeacon(key);
  }
}

function renderBeacon(key) {
  if (!_map) return;
  
  const owner = areaOwners[key];
  if (!owner || owner.hectares < 10) return;
  
  if (areaBeacons[key]) {
    if (owner.beaconRef) owner.beaconRef.off('click');
    areaBeacons[key].remove();
    delete areaBeacons[key];
    // remove do índice de beacon markers
    delete _beaconMarkers[key];
  }
  
  const beaconHtml = `
    <div class="agro-beacon" data-key="${key}" style="position: relative; width: 24px; height: 24px; cursor: pointer;">
      <div style="position: absolute; top: 50%; left: 50%; width: 8px; height: 8px; background: #3da866; border-radius: 50%; transform: translate(-50%, -50%); box-shadow: 0 0 8px #3da866, 0 0 16px rgba(61,168,102,0.6); animation: beaconPulse 2s ease-in-out infinite;"></div>
      <div style="position: absolute; top: 50%; left: 50%; width: 20px; height: 20px; border: 1.5px solid rgba(61,168,102,0.6); border-radius: 50%; transform: translate(-50%, -50%); animation: beaconRing 2s ease-in-out infinite;"></div>
      <div style="position: absolute; top: 50%; left: 50%; width: 32px; height: 32px; transform: translate(-50%, -50%);">
        <div style="position: absolute; top: 0; left: 50%; width: 2px; height: 16px; background: linear-gradient(180deg, #3da866 0%, transparent 100%); transform-origin: 50% 100%; animation: beaconScan 3s linear infinite;"></div>
      </div>
      <div class="beacon-label" style="position: absolute; bottom: -20px; left: 50%; transform: translateX(-50%); background: rgba(6,14,8,0.85); backdrop-filter: blur(4px); padding: 2px 6px; border-radius: 12px; font-size: 9px; font-weight: 600; color: #5ec880; white-space: nowrap; font-family: 'Syne', monospace; letter-spacing: 0.5px; border: 0.5px solid rgba(61,168,102,0.3); opacity: 0; transition: opacity 0.2s ease; pointer-events: none;">${owner.name}</div>
    </div>
  `;
  
  const icon = L.divIcon({
    html: beaconHtml,
    className: 'agro-beacon-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -20]
  });
  
  const marker = L.marker([owner.lat, owner.lon], { icon, zIndexOffset: 200, interactive: true });
  
  marker.on('click', (e) => {
    e.originalEvent.stopPropagation();
    openOwnerPanel(key, owner, marker.getLatLng());
  });
  
  marker.addTo(_map);
  areaBeacons[key] = marker;
  _beaconMarkers[key] = marker; // índice separado para não afetar contagem de pilotos
  owner.beaconRef = marker;
  
  const updateLabelVisibility = () => {
    const zoom = _map.getZoom();
    const el = marker.getElement();
    const label = el?.querySelector('.beacon-label');
    if (label) label.style.opacity = zoom >= 8 ? '1' : '0';
  };
  
  marker.on('add', updateLabelVisibility);
  _map.on('zoomend', updateLabelVisibility);
  updateLabelVisibility();
}

let activePanel = null;
let panelCloseHandler = null;

function openOwnerPanel(key, owner, latLng) {
  if (activePanel) {
    activePanel.remove();
    activePanel = null;
    if (panelCloseHandler) {
      document.removeEventListener('click', panelCloseHandler);
      panelCloseHandler = null;
    }
  }
  
  const isEmoji = owner.photo && owner.photo.length <= 2 && !owner.photo.includes('http');
  const avatarHtml = isEmoji 
    ? `<div style="font-size: 32px; line-height: 1;">${owner.photo}</div>`
    : `<img src="${owner.photo}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover;" onerror="this.outerHTML='<div style=font-size:32px>👨‍✈️</div>'">`;
  
  const panelHtml = `
    <div class="agro-owner-panel" style="position: absolute; background: rgba(6, 14, 8, 0.95); backdrop-filter: blur(16px); border-radius: 20px; border: 1px solid rgba(61, 168, 102, 0.3); padding: 16px; min-width: 220px; max-width: 280px; box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(61,168,102,0.1); font-family: 'Syne', sans-serif; z-index: 1000; animation: panelSlideIn 0.2s ease-out;">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
        <div style="width: 56px; height: 56px; background: linear-gradient(135deg, #163d26, #0a1f12); border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #3da866; box-shadow: 0 0 12px rgba(61,168,102,0.3);">${avatarHtml}</div>
        <div style="flex: 1;">
          <div style="font-weight: 700; font-size: 16px; color: #e8f5eb; letter-spacing: -0.3px;">${owner.name}</div>
          <div style="font-size: 11px; color: #5ec880; margin-top: 2px;">🏆 Domina a área</div>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; padding: 8px 0; border-top: 1px solid rgba(61,168,102,0.15); border-bottom: 1px solid rgba(61,168,102,0.15);">
        <div>
          <div style="font-size: 9px; color: #5a8a65; text-transform: uppercase; letter-spacing: 0.5px;">Cidade</div>
          <div style="font-size: 12px; font-weight: 500; color: #9ac8a6;">${owner.city || '—'}</div>
        </div>
        <div>
          <div style="font-size: 9px; color: #5a8a65; text-transform: uppercase; letter-spacing: 0.5px;">Drone</div>
          <div style="font-size: 11px; font-weight: 500; color: #9ac8a6;">${owner.drone.split(' ')[0] || 'Drone'}</div>
        </div>
        <div>
          <div style="font-size: 9px; color: #5a8a65; text-transform: uppercase; letter-spacing: 0.5px;">Hectares</div>
          <div style="font-size: 20px; font-weight: 800; color: #3da866; font-family: 'JetBrains Mono';">${owner.hectares}</div>
          <div style="font-size: 8px; color: #5a8a65;">pulverizados</div>
        </div>
        <div>
          <div style="font-size: 9px; color: #5a8a65; text-transform: uppercase; letter-spacing: 0.5px;">Desde</div>
          <div style="font-size: 12px; font-weight: 500; color: #9ac8a6;">${owner.since}</div>
        </div>
      </div>
    </div>
  `;
  
  const panel = document.createElement('div');
  panel.innerHTML = panelHtml;
  panel.className = 'agro-owner-panel-container';
  document.body.appendChild(panel);
  activePanel = panel;
  
  const point = _map.latLngToContainerPoint(latLng);
  const mapContainer = _map.getContainer();
  const mapRect = mapContainer.getBoundingClientRect();
  
  panel.style.left = `${mapRect.left + point.x + 15}px`;
  panel.style.top = `${mapRect.top + point.y - 80}px`;
  
  setTimeout(() => {
    const rect = panel.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      panel.style.left = `${mapRect.left + point.x - rect.width - 15}px`;
    }
    if (rect.top < 0) {
      panel.style.top = `${mapRect.top + point.y + 20}px`;
    }
  }, 10);
  
  panelCloseHandler = (e) => {
    if (!panel.contains(e.target)) {
      panel.remove();
      activePanel = null;
      document.removeEventListener('click', panelCloseHandler);
      panelCloseHandler = null;
    }
  };
  setTimeout(() => document.addEventListener('click', panelCloseHandler), 100);
}

function updateBeaconVisual(owner) {
  const marker = owner.beaconRef;
  if (!marker || !_map) return;
  const intensity = Math.min(0.5 + (owner.hectares / 500), 1.5);
  const element = marker.getElement();
  if (element) {
    const core = element.querySelector('div:first-child');
    if (core) core.style.boxShadow = `0 0 ${8 * intensity}px #3da866, 0 0 ${16 * intensity}px rgba(61,168,102,${0.4 * intensity})`;
  }
}

(function injectBeaconStyles() {
  if (document.getElementById('agro-beacon-styles')) return;
  const style = document.createElement('style');
  style.id = 'agro-beacon-styles';
  style.textContent = `
    @keyframes beaconPulse { 0%,100% { opacity: 1; transform: translate(-50%, -50%) scale(1); } 50% { opacity: 0.7; transform: translate(-50%, -50%) scale(1.2); } }
    @keyframes beaconRing { 0%,100% { opacity: 0.6; transform: translate(-50%, -50%) scale(1); } 50% { opacity: 0.2; transform: translate(-50%, -50%) scale(1.5); } }
    @keyframes beaconScan { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    @keyframes panelSlideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .agro-beacon-marker { background: transparent !important; border: none !important; }
    .agro-beacon-marker:hover .beacon-label { opacity: 1 !important; }
    .agro-owner-panel-container { position: fixed; z-index: 10000; animation: panelSlideIn 0.2s ease-out; }
  `;
  document.head.appendChild(style);
})();

// ═══════════════════════════════════════════════════════════════
// BOTS — 30 pilotos, espalhados pelo Brasil, posição diária
// ═══════════════════════════════════════════════════════════════

const CIDADES_BRASIL = [
  { name:'Sorriso, MT',            lat:-12.5500, lon:-55.7200 },
  { name:'Lucas do Rio Verde, MT', lat:-13.0600, lon:-55.9100 },
  { name:'Nova Mutum, MT',         lat:-13.8300, lon:-56.0800 },
  { name:'Sinop, MT',              lat:-11.8600, lon:-55.5000 },
  { name:'Rondonópolis, MT',       lat:-16.4700, lon:-54.6350 },
  { name:'Primavera do Leste, MT', lat:-15.5500, lon:-54.2900 },
  { name:'Rio Verde, GO',          lat:-17.7981, lon:-50.9278 },
  { name:'Jataí, GO',              lat:-17.8831, lon:-51.7158 },
  { name:'Campo Grande, MS',       lat:-20.4697, lon:-54.6201 },
  { name:'Dourados, MS',           lat:-22.2211, lon:-54.8056 },
  { name:'Ribeirão Preto, SP',     lat:-21.1787, lon:-47.8103 },
  { name:'Uberlândia, MG',         lat:-18.9186, lon:-48.2772 },
  { name:'Londrina, PR',           lat:-23.3107, lon:-51.1628 },
  { name:'Cascavel, PR',           lat:-24.9578, lon:-53.4595 },
  { name:'Passo Fundo, RS',        lat:-28.2620, lon:-52.4063 },
  { name:'Chapecó, SC',            lat:-27.1003, lon:-52.6150 },
  { name:'Barreiras, BA',          lat:-12.1522, lon:-44.9989 },
  { name:'Palmas, TO',             lat:-10.2491, lon:-48.3243 },
  { name:'Imperatriz, MA',         lat: -5.5267, lon:-47.4919 },
  { name:'Balsas, MA',             lat: -7.5322, lon:-46.0353 },
  { name:'Luís Eduardo Magalhães, BA', lat:-12.0964, lon:-45.7919 },
  { name:'Cristalina, GO',         lat:-16.7683, lon:-47.6142 },
  { name:'Sete Lagoas, MG',        lat:-19.4653, lon:-44.2461 },
  { name:'Patos de Minas, MG',     lat:-18.5784, lon:-46.5185 },
  { name:'Unaí, MG',               lat:-16.3594, lon:-46.9032 },
  { name:'Coxim, MS',              lat:-18.5072, lon:-54.7600 },
  { name:'Maracaju, MS',           lat:-21.6139, lon:-55.1681 },
  { name:'Querência, MT',          lat:-12.5950, lon:-52.1878 },
  { name:'Tangará da Serra, MT',   lat:-14.6233, lon:-57.4950 },
  { name:'Porto Nacional, TO',     lat:-10.7077, lon:-48.4169 },
];

// Seed diária: gera offset estável por bot+dia, muda todo dia
function dailySeed(botId, component) {
  const dayKey = Math.floor(Date.now() / 86400000); // dia atual em ms
  let hash = 0;
  const str = `${botId}_${component}_${dayKey}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 1000) / 1000; // 0..1
}

// Gera bots com 30 pilotos, cada um fixado na sua cidade
function generateRealisticBots(count = 30) {
  const bots = [];
  const drones = ['DJI Agras T40','DJI Agras T50','XAG P100 Pro','XAG V40','EAVision U10'];
  const mascNames = ['João Silva','Pedro Oliveira','Lucas Lima','Rafael Alves','Gustavo Pereira','Bruno Ferreira','Rodrigo Gomes','Thiago Monteiro','Felipe Nogueira','Marcelo Batista','André Carvalho','Diego Nascimento','Leandro Ribeiro','Vinicius Castro','Eduardo Martins'];
  const femNames  = ['Maria Santos','Ana Costa','Fernanda Souza','Patrícia Rocha','Carla Mendes','Juliana Almeida'];
  const photos    = ['👨‍✈️','🧑‍✈️','👨‍🚀','👨‍🌾','🧑‍🌾','👩‍✈️','👩‍🚀','👩‍🌾'];

  for (let i = 0; i < count; i++) {
    // Cada bot usa sua própria cidade da lista (cycled se count > cidades)
    const cidade = CIDADES_BRASIL[i % CIDADES_BRASIL.length];
    const isFem  = i % 6 === 0;
    const names  = isFem ? femNames : mascNames;
    const botId  = `bot_${i}`;

    // Distribuição realista de hectares
    const rand = Math.random();
    let hectares;
    if (rand < 0.6)      hectares = 5  + Math.floor(Math.random() * 35);
    else if (rand < 0.85) hectares = 40 + Math.floor(Math.random() * 30);
    else                  hectares = 70 + Math.floor(Math.random() * 30);

    const opsTotal   = Math.floor(hectares / 2) + Math.floor(Math.random() * 15);
    const hoursTotal = Math.floor(opsTotal * 1.2) + Math.floor(Math.random() * 30);

    // Posição base = cidade + drift diário de até ±0.25 graus (~28 km)
    // Muda todo dia, mas é estável durante o dia
    const dailyLatOffset = (dailySeed(botId, 'lat') - 0.5) * 0.5;
    const dailyLonOffset = (dailySeed(botId, 'lon') - 0.5) * 0.5;

    bots.push({
      id: botId,
      name: names[i % names.length],
      city: cidade.name,
      drone: drones[i % drones.length],
      score: 45 + Math.floor(Math.random() * 40),
      amxScore: 45 + Math.floor(Math.random() * 40),
      photo: photos[i % photos.length],
      hoursTotal,
      opsTotal,
      hectares,
      // Posição base diária (cidade + drift do dia)
      baseLat: cidade.lat + dailyLatOffset,
      baseLon: cidade.lon + dailyLonOffset,
      status: Math.random() > 0.6 ? 'online' : (Math.random() > 0.5 ? 'operating' : 'offline'),
    });
  }
  return bots;
}

const BOTS = generateRealisticBots(30);

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
    n = user?.displayName || user?.email?.split('@')[0] || 'Piloto';
  }
  if (!n || n.startsWith('http') || n.includes('googleusercontent.com')) n = 'Piloto';
  if (n.length > 25) n = n.substring(0, 22) + '...';
  return n;
}

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
  if (pilot.status === 'sos')            statusText = '🚨 SOS';
  else if (pilot.status === 'request')   statusText = '🔧 Pedido';
  else if (pilot.status === 'operating') statusText = '🚁 Operando';

  let photoHtml = '👨‍✈️';
  if (pilot.photo && !pilot.photo.startsWith('http') && pilot.photo.length < 10) {
    photoHtml = pilot.photo;
  } else if (pilot.photo && pilot.photo.startsWith('http')) {
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
  
  updateAreaOwner(pilot);
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

  Object.keys(_markers).forEach(id => {
    if (id !== currentUid) removePilot(id);
  });

  spawnBots(centerLat, centerLon, { wind: 10, temp: 25 });
  startBotUpdates();
  _updatePilotCount();

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
            hectares: d.hectares || 0,
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

// ── Bots — espalha por todo o Brasil, não apenas ao redor do usuário ──
export function spawnBots(lat, lon, weather) {
  const hour     = new Date().getHours();
  const isDay    = hour >= 5 && hour <= 18;
  const goodWind = (weather?.wind || 0) <= 20;

  // Filtra bots ativos conforme horário/vento
  const activeBots = BOTS.filter((_, i) => {
    if (!isDay)    return i < 3;
    if (!goodWind) return i < 6;
    return true;
  });

  activeBots.forEach((bot) => {
    // Usa posição base diária (cidade + drift do dia) + micro-ruído de sessão
    const sessionJitter = 0.02; // ~2km de ruído de sessão
    const bLat = bot.baseLat + (Math.random() - 0.5) * sessionJitter;
    const bLon = bot.baseLon + (Math.random() - 0.5) * sessionJitter;

    const isOp = isDay && goodWind && Math.random() > 0.4;
    upsertPilot({
      ...bot,
      lat: Math.max(-35, Math.min(5, bLat)),
      lon: Math.max(-75, Math.min(-35, bLon)),
      status: isOp ? 'operating' : 'online',
      isCurrentUser: false,
    });
  });
}

export function startBotUpdates() {
  if (_botInterval) clearInterval(_botInterval);
  // Micro-movimento a cada 15s (simula voo), mantendo próximo da posição base diária
  _botInterval = setInterval(() => {
    Object.entries(_markers).forEach(([id, m]) => {
      if (!id.startsWith('bot_')) return;
      const bot = BOTS.find(b => b.id === id);
      if (!bot) return;
      const p = m.getLatLng();
      // Deriva suave, máximo 0.5 grau da base diária para não vagar demais
      const maxDrift = 0.5;
      const newLat = p.lat + (Math.random() - 0.5) * 0.003;
      const newLon = p.lng + (Math.random() - 0.5) * 0.003;
      // Ancora de volta à base se deriva muito
      const clampedLat = Math.abs(newLat - bot.baseLat) > maxDrift ? bot.baseLat : newLat;
      const clampedLon = Math.abs(newLon - bot.baseLon) > maxDrift ? bot.baseLon : newLon;
      m.setLatLng([
        Math.max(-35, Math.min(5, clampedLat)),
        Math.max(-75, Math.min(-35, clampedLon)),
      ]);
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

// ── Contagem separada: pilotos online + áreas dominadas ───────
function _updatePilotCount() {
  // _markers = apenas pilotos (bots + reais), sem beacons
  const totalPilots = Object.keys(_markers).length;
  const totalAreas  = Object.keys(areaBeacons).length;

  // Elemento principal de pilotos
  const elPilots = document.getElementById('pilotCount');
  if (elPilots) elPilots.textContent = `${totalPilots} pilotos online`;

  // Elemento de áreas dominadas (opcional — crie um #areaCount no HTML se quiser)
  const elAreas = document.getElementById('areaCount');
  if (elAreas) elAreas.textContent = `${totalAreas} áreas dominadas`;
}

// Exporta para uso externo se necessário
export { _updatePilotCount as updatePilotCount };
