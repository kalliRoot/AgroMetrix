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

// ═══════════════════════════════════════════════════════════════
// PATCH 01 — SISTEMA "DONO DA ÁREA" NO MAPA
// ═══════════════════════════════════════════════════════════════

const areaOwners = {};
const areaMarkers = {};
const GRID_SIZE = 1.0;

function getGridKey(lat, lon) {
  return `${Math.floor(lat / GRID_SIZE)}_${Math.floor(lon / GRID_SIZE)}`;
}

function updateAreaOwner(pilot) {
  if (!_map) return;
  const lat = pilot.lat, lon = pilot.lon;
  if (!lat || !lon) return;
  const key = getGridKey(lat, lon);
  const ha = Number(pilot.hectares || pilot.opsTotal * 15 || 0);
  const current = areaOwners[key];

  if (current && current.pilotId !== pilot.id && ha <= current.hectares) return;

  const since = current?.pilotId === pilot.id ? current.since : new Date().toLocaleDateString('pt-BR');
  areaOwners[key] = {
    pilotId: pilot.id,
    name: pilot.name || pilot.nickname || 'Piloto',
    photo: pilot.photo || '👨‍✈️',
    city: pilot.city || '',
    hectares: ha,
    since,
    lat, lon,
  };
  renderAreaOwnerMarker(key);
}

function renderAreaOwnerMarker(key) {
  if (!_map) return;
  const owner = areaOwners[key];
  if (!owner || owner.hectares < 20) return;

  if (areaMarkers[key]) {
    areaMarkers[key].remove();
    delete areaMarkers[key];
  }

  const isPhoto = owner.photo && !['👨‍✈️','🧑‍✈️','👨‍🚀','👨‍🌾','👩‍✈️','👩‍🚀','👩‍🌾'].includes(owner.photo);
  const avatarHtml = isPhoto
    ? `<img src="${owner.photo}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid #3da866" onerror="this.outerHTML='<span style=font-size:20px>👨‍✈️</span>'">`
    : `<span style="font-size:20px">${owner.photo}</span>`;

  const html = `
    <div style="
      background:rgba(6,14,8,.96);
      border:1.5px solid #3da866;
      border-radius:14px;
      padding:8px 10px 6px;
      min-width:140px;
      max-width:170px;
      box-shadow:0 0 18px rgba(61,168,102,.35),0 4px 24px rgba(0,0,0,.7);
      font-family:'Syne',sans-serif;
      position:relative;
      animation:ownerFloat 3s ease-in-out infinite;
    ">
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:5px">
        <div style="
          width:34px;height:34px;border-radius:50%;
          background:#163d26;
          display:flex;align-items:center;justify-content:center;
          border:2px solid #3da866;
          overflow:hidden;flex-shrink:0;
        ">${avatarHtml}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:11px;font-weight:800;color:#e8f5eb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${owner.name}</div>
          <div style="font-size:9px;color:#5ec880;margin-top:1px">🏆 Dono da Área</div>
        </div>
      </div>
      <div style="border-top:1px solid rgba(61,168,102,.2);padding-top:5px;display:grid;grid-template-columns:1fr 1fr;gap:3px">
        <div style="text-align:center">
          <div style="font-size:13px;font-weight:800;color:#3da866;font-family:'JetBrains Mono',monospace">${owner.hectares}ha</div>
          <div style="font-size:8px;color:#5a8a65;text-transform:uppercase;letter-spacing:.05em">Pulv.</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:9px;color:#9ac8a6">${owner.city.split(',')[0] || '—'}</div>
          <div style="font-size:8px;color:#5a8a65">desde ${owner.since}</div>
        </div>
      </div>
      <div style="
        position:absolute;top:-20px;left:50%;transform:translateX(-50%);
        width:3px;height:20px;
        background:linear-gradient(to top,#3da866,transparent);
      "></div>
      <div style="
        position:absolute;top:-26px;left:50%;transform:translateX(-50%);
        width:8px;height:8px;border-radius:50%;
        background:#5ec880;
        box-shadow:0 0 8px #3da866,0 0 16px rgba(61,168,102,.5);
        animation:ownerPulse 1.8s ease-in-out infinite;
      "></div>
    </div>
  `;

  const icon = L.divIcon({
    html,
    className: 'area-owner-marker',
    iconAnchor: [85, 80],
    iconSize: [170, 80],
    popupAnchor: [0, -80],
  });

  const marker = L.marker([owner.lat, owner.lon], { icon, zIndexOffset: -100, interactive: false });
  marker.addTo(_map);
  areaMarkers[key] = marker;
}

// Injetar CSS dos markers
(function injectAreaOwnerStyles() {
  if (document.getElementById('area-owner-styles')) return;
  const style = document.createElement('style');
  style.id = 'area-owner-styles';
  style.textContent = `
    @keyframes ownerFloat {
      0%,100% { transform: translateY(0); }
      50% { transform: translateY(-5px); }
    }
    @keyframes ownerPulse {
      0%,100% { box-shadow: 0 0 8px #3da866, 0 0 16px rgba(61,168,102,.5); }
      50% { box-shadow: 0 0 14px #3da866, 0 0 28px rgba(61,168,102,.8); }
    }
    .area-owner-marker { background: transparent !important; border: none !important; }
  `;
  document.head.appendChild(style);
})();

// ═══════════════════════════════════════════════════════════════
// PATCH 02 — BOTS MELHORADOS (substitui completamente os antigos)
// ═══════════════════════════════════════════════════════════════

const CIDADES_BRASIL = [
  { name:'Sorriso, MT', lat:-12.5500, lon:-55.7200 },
  { name:'Lucas do Rio Verde, MT', lat:-13.0600, lon:-55.9100 },
  { name:'Nova Mutum, MT', lat:-13.8300, lon:-56.0800 },
  { name:'Sinop, MT', lat:-11.8600, lon:-55.5000 },
  { name:'Rondonópolis, MT', lat:-16.4700, lon:-54.6350 },
  { name:'Campo Novo do Parecis, MT', lat:-13.6700, lon:-57.8900 },
  { name:'Primavera do Leste, MT', lat:-15.5500, lon:-54.2900 },
  { name:'Cuiabá, MT', lat:-15.5989, lon:-56.0949 },
  { name:'Rio Verde, GO', lat:-17.7981, lon:-50.9278 },
  { name:'Jataí, GO', lat:-17.8831, lon:-51.7158 },
  { name:'Cristalina, GO', lat:-16.7681, lon:-47.6147 },
  { name:'Mineiros, GO', lat:-17.5700, lon:-52.5500 },
  { name:'Chapadão do Céu, GO', lat:-18.4000, lon:-52.5100 },
  { name:'Goiânia, GO', lat:-16.6869, lon:-49.2648 },
  { name:'Campo Grande, MS', lat:-20.4697, lon:-54.6201 },
  { name:'Dourados, MS', lat:-22.2211, lon:-54.8056 },
  { name:'Maracaju, MS', lat:-21.6100, lon:-55.1700 },
  { name:'Sidrolândia, MS', lat:-20.9300, lon:-54.9600 },
  { name:'Ribeirão Preto, SP', lat:-21.1787, lon:-47.8103 },
  { name:'Campinas, SP', lat:-22.9099, lon:-47.0626 },
  { name:'Presidente Prudente, SP', lat:-22.1255, lon:-51.3887 },
  { name:'Araçatuba, SP', lat:-21.2092, lon:-50.4328 },
  { name:'Barretos, SP', lat:-20.5573, lon:-48.5665 },
  { name:'Franca, SP', lat:-20.5386, lon:-47.4008 },
  { name:'Uberlândia, MG', lat:-18.9186, lon:-48.2772 },
  { name:'Uberaba, MG', lat:-19.7472, lon:-47.9381 },
  { name:'Patos de Minas, MG', lat:-18.5796, lon:-46.5183 },
  { name:'Ituiutaba, MG', lat:-18.9726, lon:-49.4654 },
  { name:'Londrina, PR', lat:-23.3107, lon:-51.1628 },
  { name:'Maringá, PR', lat:-23.4205, lon:-51.9333 },
  { name:'Cascavel, PR', lat:-24.9578, lon:-53.4595 },
  { name:'Ponta Grossa, PR', lat:-25.0950, lon:-50.1619 },
  { name:'Guarapuava, PR', lat:-25.3936, lon:-51.4578 },
  { name:'Campo Mourão, PR', lat:-24.0468, lon:-52.3841 },
  { name:'Passo Fundo, RS', lat:-28.2620, lon:-52.4063 },
  { name:'Cruz Alta, RS', lat:-28.6394, lon:-53.6061 },
  { name:'Ijuí, RS', lat:-28.3878, lon:-53.9150 },
  { name:'Santa Maria, RS', lat:-29.6842, lon:-53.8069 },
  { name:'Não-Me-Toque, RS', lat:-28.4573, lon:-52.8166 },
  { name:'Chapecó, SC', lat:-27.1003, lon:-52.6150 },
  { name:'Xanxerê, SC', lat:-26.8759, lon:-52.4031 },
  { name:'Barreiras, BA', lat:-12.1522, lon:-44.9989 },
  { name:'Luís Eduardo Magalhães, BA', lat:-12.0956, lon:-45.7869 },
  { name:'São Desidério, BA', lat:-12.3600, lon:-44.9700 },
  { name:'Palmas, TO', lat:-10.2491, lon:-48.3243 },
  { name:'Gurupi, TO', lat:-11.7278, lon:-49.0658 },
  { name:'Pedro Afonso, TO', lat:-8.9700, lon:-48.1700 },
  { name:'Balsas, MA', lat:-7.5328, lon:-46.0358 },
  { name:'Uruçuí, PI', lat:-7.2328, lon:-44.5561 },
  { name:'Bom Jesus, PI', lat:-9.0728, lon:-44.3561 },
];

const BOT_NAMES_MASC = [
  'João Silva','Pedro Oliveira','Lucas Lima','Rafael Alves','Gustavo Pereira',
  'Bruno Ferreira','Rodrigo Gomes','Thiago Monteiro','Felipe Nogueira','Marcelo Batista',
  'Daniel Martins','Leonardo Teixeira','Ricardo Farias','Eduardo Santos','Marcos Rocha',
  'André Costa','Paulo Souza','Diego Almeida','Vinicius Nunes','Carlos Moreira',
  'Henrique Pinto','Gabriel Cardoso','Mateus Araújo','Leandro Vieira','Roberto Lima',
];

const BOT_NAMES_FEM = [
  'Maria Santos','Ana Costa','Fernanda Souza','Patrícia Rocha','Carla Mendes',
];

const BOT_PHOTOS_MASC = ['👨‍✈️','🧑‍✈️','👨‍🚀','👨‍🌾','🧑‍🌾'];
const BOT_PHOTOS_FEM  = ['👩‍✈️','👩‍🚀','👩‍🌾'];

function gerarDataRecente() {
  const diasAtras = Math.floor(Math.random() * 14);
  const horasAtras = Math.floor(Math.random() * 8);
  return new Date(Date.now() - diasAtras * 86400000 - horasAtras * 3600000).toISOString();
}

function generateRealisticBots(count) {
  const bots = [];
  const cidades = [...CIDADES_BRASIL].sort(() => Math.random() - 0.5);
  const drones = ['DJI Agras T40','DJI Agras T50','XAG P100 Pro','XAG V40','EAVision U10','DJI Agras T25'];

  for (let i = 0; i < Math.min(count, cidades.length); i++) {
    const cidade = cidades[i];
    const isFem = i < 5;
    const names = isFem ? BOT_NAMES_FEM : BOT_NAMES_MASC;
    const photos = isFem ? BOT_PHOTOS_FEM : BOT_PHOTOS_MASC;
    const nameIdx = isFem ? i : (i - 5);

    let hectaresBase;
    if (Math.random() < 0.12) {
      hectaresBase = 200 + Math.floor(Math.random() * 300);
    } else if (Math.random() < 0.3) {
      hectaresBase = 100 + Math.floor(Math.random() * 100);
    } else {
      hectaresBase = 30 + Math.floor(Math.random() * 70);
    }

    const score     = 45 + Math.floor(Math.random() * 50);
    const opsTotal  = 5  + Math.floor(Math.random() * 150);
    const hoursTotal= 10 + Math.floor(Math.random() * 600);

    const statusRoll = Math.random();
    let status;
    if (statusRoll < 0.25)      status = 'operating';
    else if (statusRoll < 0.72) status = 'online';
    else                        status = 'offline';

    const jitterLat = (Math.random() - 0.5) * 0.28;
    const jitterLon = (Math.random() - 0.5) * 0.28;

    bots.push({
      id:         `bot_${Date.now()}_${i}`,
      name:       names[nameIdx % names.length],
      city:       cidade.name,
      drone:      drones[Math.floor(Math.random() * drones.length)],
      score,
      amxScore:   score,
      photo:      photos[Math.floor(Math.random() * photos.length)],
      hoursTotal,
      opsTotal,
      hectares:   hectaresBase,
      lat:        cidade.lat + jitterLat,
      lon:        cidade.lon + jitterLon,
      status,
      lastOp:     gerarDataRecente(),
    });
  }
  return bots;
}

// Variável global para bots ativos (usada pelo startBotMovement)
let activeBots = [];

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
  if (pilot.status === 'sos')        statusText = '🚨 SOS';
  else if (pilot.status === 'request')   statusText = '🔧 Pedido';
  else if (pilot.status === 'operating') statusText = '🚁 Operando';

  let photoHtml = '👨‍✈️';
  if (pilot.photo && !pilot.photo.startsWith('http') && pilot.photo.length < 10) {
    photoHtml = pilot.photo;
  } else if (pilot.photo && pilot.photo.startsWith('http') && !pilot.photo.includes('googleusercontent.com')) {
    photoHtml = `<img src="${pilot.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.outerHTML='👨‍✈️'">`;
  } else if (pilot.photo && pilot.photo.includes('googleusercontent.com')) {
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

// ── Adicionar/atualizar piloto (MODIFICADO com PATCH 01) ─────
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
  
  // ═══════════════════════════════════════════════════════════
  // PATCH 01: Atualizar Dono da Área sempre que um piloto é inserido
  // ═══════════════════════════════════════════════════════════
  updateAreaOwner(pilot);
}

export function removePilot(id) {
  if (_markers[id]) {
    _markers[id].remove();
    delete _markers[id];
  }
}

// ── Listen Pilots (Firestore + bots) MODIFICADO ──────────────
export async function listenPilots(centerLat, centerLon, currentUid) {
  _currentUid = currentUid;

  Object.keys(_markers).forEach(id => {
    if (id !== currentUid) removePilot(id);
  });

  // Usar novo sistema de bots realistas
  await spawnRealisticBots(centerLat, centerLon);
  startBotMovement(); // Nova função de movimento
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

// NOVA função: spawn bots realistas
async function spawnRealisticBots(lat, lon) {
  const bots = generateRealisticBots(30);
  activeBots = bots;
  
  bots.forEach(bot => {
    upsertPilot({ ...bot, isCurrentUser: false });
  });
}

// NOVA função de movimento dos bots (evita oceano)
function startBotMovement() {
  if (_botInterval) clearInterval(_botInterval);
  _botInterval = setInterval(() => {
    activeBots.forEach(bot => {
      if (Math.random() > 0.88) {
        const novaCidade = CIDADES_BRASIL[Math.floor(Math.random() * CIDADES_BRASIL.length)];
        bot.lat = novaCidade.lat + (Math.random() - 0.5) * 0.22;
        bot.lon = novaCidade.lon + (Math.random() - 0.5) * 0.22;
        bot.city = novaCidade.name;
      } else {
        bot.lat += (Math.random() - 0.5) * 0.008;
        bot.lon += (Math.random() - 0.5) * 0.008;
      }
      upsertPilot(bot);
    });
    _updatePilotCount();
  }, 60000);
}

// Função mantida para compatibilidade (mas usa o novo sistema)
export function spawnBots(lat, lon, weather) {
  // Não faz nada - substituído pelo spawnRealisticBots
  console.log('spawnBots deprecated - usando generateRealisticBots');
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
