// ═══════════════════════════════════════════════════════════════
//  AgroMetrix Radar — radar.js v3.1 (Com Sistema de Chamados)
//  Mapa Leaflet · Pilotos reais · Bots · SOS · Operações · Chamados
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

// ── SISTEMA DE CHAMADOS (Máx 1 ativo) ─────────────────────────
const activeCallsMap = new Map(); // { callId: { uid, timestamp, location, type, accepted } }
let currentCallId = null;
let _callTimerInterval = null;

// ── Bots simulados (pilotos realistas) ───────────────────────
const BOTS = [
  { id: 'bot_001', name: 'Carlos Mendonça',   city: 'Sorriso, MT',      drone: 'DJI Agras T40',  score: 87, photo: '👨‍✈️', hoursTotal: 1240, opsTotal: 312 },
  { id: 'bot_002', name: 'Rafael Bueno',      city: 'Rondonópolis, MT', drone: 'XAG P100 Pro',   score: 92, photo: '🧑‍✈️', hoursTotal: 890,  opsTotal: 198 },
  { id: 'bot_003', name: 'Marcos Figueiredo', city: 'Lucas do Rio Verde', drone: 'DJI Agras T30', score: 74, photo: '👨‍✈️', hoursTotal: 560,  opsTotal: 143 },
  { id: 'bot_004', name: 'Thiago Cavalcante', city: 'Primavera do Leste', drone: 'XAG V40',      score: 95, photo: '🧑‍✈️', hoursTotal: 2100, opsTotal: 487 },
  { id: 'bot_005', name: 'Diego Almeida',     city: 'Campo Verde, MT',   drone: 'DJI Agras T50', score: 81, photo: '👨‍✈️', hoursTotal: 720,  opsTotal: 201 },
  { id: 'bot_006', name: 'Leandro Souza',     city: 'Nova Mutum, MT',    drone: 'Pegasus Agri 10', score: 68, photo: '🧑‍✈️', hoursTotal: 430,  opsTotal: 98 },
  { id: 'bot_007', name: 'Fabio Martins',     city: 'Sapezal, MT',       drone: 'DJI Agras T40', score: 89, photo: '👨‍✈️', hoursTotal: 1560, opsTotal: 389 },
  { id: 'bot_008', name: 'Anderson Lima',     city: 'Sinop, MT',         drone: 'XAG P100 Pro',  score: 77, photo: '🧑‍✈️', hoursTotal: 680,  opsTotal: 167 },
];

// ── Inicializar mapa ──────────────────────────────────────────
export function initMap(containerId, lat, lon) {
  if (_map) { _map.remove(); _map = null; }

  _map = L.map(containerId, {
    zoomControl: false,
    attributionControl: false,
  }).setView([lat || -15.7801, lon || -47.9292], 10);

  const osmTile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap',
  });
  osmTile.addTo(_map);

  L.control.zoom({ position: 'bottomright' }).addTo(_map);
  L.control.attribution({ position: 'bottomleft' }).addTo(_map);

  return _map;
}

// ── Ícone de piloto ───────────────────────────────────────────
function pilotIcon(status, isUser = false) {
  const isSOS = status === 'sos';
  const isOperating = status === 'operating';
  const isRequest = status === 'request';

  let color = '#1e88d0';
  if (isOperating) color = '#3da866';
  if (isSOS) color = '#e03535';
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
  
  if (isOperating) {
    svg += `<circle cx="20" cy="20" r="15" fill="none" stroke="${color}" stroke-width="1.5">
      <animate attributeName="r" from="13" to="22" dur="1.8s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.5;0" dur="1.8s" repeatCount="indefinite"/>
    </circle>`;
  }
  
  svg += `<circle cx="20" cy="20" r="14" fill="${color}" opacity="0.15"/>
    <circle cx="20" cy="20" r="10" fill="${color}" opacity="0.95"/>`;
  
  if (isUser) {
    svg += `<circle cx="20" cy="20" r="5" fill="white" opacity="0.95"/>`;
  }
  
  if (isSOS) {
    svg += `<text x="20" y="25" text-anchor="middle" font-size="13" fill="white">🚨</text>`;
  } else if (isRequest) {
    svg += `<text x="20" y="25" text-anchor="middle" font-size="13" fill="white">🔧</text>`;
  } else if (isOperating) {
    svg += `<text x="20" y="25" text-anchor="middle" font-size="13" fill="white">🚁</text>`;
  }
  
  svg += `</svg>`;

  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// ── Popup com botões (integrado com chamados) ─────────────────
function buildPopup(pilot) {
  const reqBtn = (pilot.status === 'request' && !pilot.isCurrentUser) ?
    `<button onclick="window.acceptCallFromPopup('${pilot.id}', '${(pilot.requestMsg || '').replace(/'/g, "\\'")}', '${pilot.name.replace(/'/g, "\\'")}')"
      style="margin-top:8px;width:100%;padding:7px;border-radius:8px;border:none;background:#f5a623;color:#0d1a0f;font-weight:700;font-size:12px;cursor:pointer">
      ✅ Aceitar chamado</button>` : '';

  const sosBtn = (pilot.status === 'sos' && !pilot.isCurrentUser) ?
    `<button onclick="window.respondToSOS('${pilot.id}', '${pilot.name.replace(/'/g, "\\'")}')"
      style="margin-top:8px;width:100%;padding:7px;border-radius:8px;border:none;background:#e03535;color:white;font-weight:700;font-size:12px;cursor:pointer">
      🚨 Responder SOS</button>` : '';

  let statusText = '🟢 Online';
  if (pilot.status === 'sos') statusText = '🚨 SOS';
  else if (pilot.status === 'request') statusText = '🔧 Pedido';
  else if (pilot.status === 'operating') statusText = '🚁 Operando';

  return `<div style="font-family:'Syne',sans-serif;min-width:190px;padding:4px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <div style="font-size:24px">${pilot.photo || '👨‍✈️'}</div>
      <div>
        <div style="font-weight:700;font-size:14px;color:#e8f5eb">${pilot.name || 'Piloto'}</div>
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
    ${reqBtn}${sosBtn}
  </div>`;
}

// ── Funções do Sistema de Chamados ────────────────────────────

// Criar novo chamado (máximo 1 ativo)
export async function createCall(type, description) {
  // Verificar se já existe chamado ativo
  if (currentCallId) {
    const existing = activeCallsMap.get(currentCallId);
    if (existing && !existing.accepted && Date.now() - existing.timestamp < 30000) {
      showToastMessage('⚠️ Já existe um chamado ativo. Aguarde resolução.', 'warning');
      return null;
    }
  }

  // Parar sons de loop anteriores
  stopLoopSound();

  const callId = 'call_' + Date.now();
  currentCallId = callId;

  const userData = window.R || { user: null, profile: null, lat: -15.7801, lon: -47.9292 };
  
  activeCallsMap.set(callId, {
    id: callId,
    uid: userData.user?.uid || 'unknown',
    name: userData.profile?.nickname || userData.profile?.name || 'Piloto',
    type: type,
    description: description,
    location: { lat: userData.lat || -15.7801, lon: userData.lon || -47.9292 },
    timestamp: Date.now(),
    accepted: false
  });

  // Auto-reject após 30s se ninguém aceitar
  setTimeout(() => {
    const call = activeCallsMap.get(callId);
    if (call && !call.accepted) {
      activeCallsMap.delete(callId);
      if (currentCallId === callId) {
        currentCallId = null;
        stopLoopSound();
      }
      showToastMessage('⏱️ Ninguém aceitou seu chamado. Tente novamente.', 'info');
    }
  }, 30000);

  // Notificar pilotos próximos (todos visíveis)
  notifyNearbyPilots(callId, type, description);
  
  showToastMessage(`📢 Chamado de ${type} enviado para pilotos próximos!`, 'success');
  playSoundEffect('sos');
  
  return callId;
}

// Notificar pilotos próximos (raio 100km)
function notifyNearbyPilots(callId, type, description) {
  const call = activeCallsMap.get(callId);
  if (!call) return;
  
  // Percorrer todos os marcadores (pilotos reais e bots)
  Object.values(_markers).forEach(marker => {
    const pilot = marker._pilotData;
    if (!pilot || pilot.isCurrentUser) return;
    
    // Calcular distância
    const distance = calculateDistance(
      call.location.lat, call.location.lon,
      pilot.lat, pilot.lon
    );
    
    // Se estiver dentro de 100km, mostrar notificação
    if (distance <= 100) {
      showCallModal(callId, type, description, pilot);
    }
  });
}

// Calcular distância entre dois pontos (km)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Mostrar modal de chamado para o piloto
function showCallModal(callId, type, description, pilot) {
  const call = activeCallsMap.get(callId);
  if (!call || call.accepted) return;
  
  const icons = {
    'tow': '🚜',
    'maintenance': '🔧',
    'sos': '🚨',
    'fuel': '⛽',
    'weather': '🌦️'
  };
  
  // Criar modal se não existir
  let modal = document.getElementById('callModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'callModal';
    modal.innerHTML = `
      <div id="callModalOverlay" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:10001;display:none"></div>
      <div id="callModalContent" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#0d1a0f;border-radius:16px;padding:24px;width:320px;z-index:10002;display:none;border:1px solid #3da866;box-shadow:0 8px 32px rgba(0,0,0,0.4)">
        <div style="text-align:center;font-size:48px;margin-bottom:12px" id="callModalIcon">🚨</div>
        <h3 style="color:#e8f5eb;margin:0 0 8px 0;text-align:center" id="callModalTitle">Chamado de Emergência</h3>
        <p style="color:#9ac8a6;margin:0 0 16px 0;text-align:center;font-size:14px" id="callModalMsg">Mensagem</p>
        <div style="text-align:center;margin-bottom:20px">
          <span style="background:#1f5534;color:#5ec880;padding:4px 12px;border-radius:20px;font-size:12px" id="callModalTimer">Expira em 30s</span>
        </div>
        <div style="display:flex;gap:12px">
          <button id="callModalAccept" style="flex:1;padding:12px;background:#3da866;border:none;border-radius:8px;color:white;font-weight:700;cursor:pointer">✅ Aceitar</button>
          <button id="callModalIgnore" style="flex:1;padding:12px;background:#e03535;border:none;border-radius:8px;color:white;font-weight:700;cursor:pointer">❌ Ignorar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  const overlay = document.getElementById('callModalOverlay');
  const content = document.getElementById('callModalContent');
  const iconEl = document.getElementById('callModalIcon');
  const titleEl = document.getElementById('callModalTitle');
  const msgEl = document.getElementById('callModalMsg');
  const timerEl = document.getElementById('callModalTimer');
  
  iconEl.textContent = icons[type] || '🔧';
  titleEl.textContent = `Chamado de ${call.name || 'Piloto'}`;
  msgEl.textContent = description;
  
  overlay.style.display = 'block';
  content.style.display = 'block';
  
  // Timer visual
  let secs = 30;
  if (_callTimerInterval) clearInterval(_callTimerInterval);
  _callTimerInterval = setInterval(() => {
    secs--;
    timerEl.textContent = `Expira em ${secs}s`;
    if (secs <= 0) {
      clearInterval(_callTimerInterval);
      closeCallModal();
    }
  }, 1000);
  
  // Som de alerta contínuo (loop durante 30s)
  playLoopSound('request', 30000);
  
  // Configurar botões
  const acceptBtn = document.getElementById('callModalAccept');
  const ignoreBtn = document.getElementById('callModalIgnore');
  
  acceptBtn.onclick = () => {
    acceptCall(callId, pilot);
    closeCallModal();
  };
  
  ignoreBtn.onclick = () => {
    closeCallModal();
  };
}

function closeCallModal() {
  const overlay = document.getElementById('callModalOverlay');
  const content = document.getElementById('callModalContent');
  if (overlay) overlay.style.display = 'none';
  if (content) content.style.display = 'none';
  if (_callTimerInterval) clearInterval(_callTimerInterval);
  stopLoopSound();
}

// Aceitar chamado
export async function acceptCall(callId, pilot) {
  const call = activeCallsMap.get(callId);
  if (!call || call.accepted) return;
  
  call.accepted = true;
  
  // Parar sons
  stopLoopSound();
  playSoundEffect('accept');
  
  // Notificar quem fez o chamado via Firestore
  if (window._firebaseDB) {
    try {
      const db = window._firebaseDB;
      const timestamp = window._fsTimestamp ? window._fsTimestamp() : new Date().toISOString();
      await window._fsAddDoc(window._fsCollection(db, 'notifications'), {
        to: call.uid,
        from: window.R?.user?.uid || 'unknown',
        fromName: window.R?.profile?.nickname || window.R?.profile?.name || 'Piloto',
        type: 'request_accepted',
        accepterName: pilot.name,
        accepterId: pilot.id,
        message: call.description,
        createdAt: timestamp,
        read: false
      });
    } catch (error) {
      console.error('❌ Erro ao enviar notificação:', error);
    }
  }
  
  // Abrir chat para ambos
  if (window.openChatWith) {
    window.openChatWith(call.uid, pilot.name);
  }
  
  showToastMessage(`✅ ${pilot.name} aceitou seu chamado! Chat aberto para ambos.`, 'success');
  
  // Remover chamado
  activeCallsMap.delete(callId);
  if (currentCallId === callId) currentCallId = null;
}

// Função global para aceitar do popup
window.acceptCallFromPopup = async function(pilotId, message, pilotName) {
  // Encontrar o chamado ativo mais recente
  const calls = Array.from(activeCallsMap.values());
  const activeCall = calls.find(c => !c.accepted && Date.now() - c.timestamp < 30000);
  
  if (activeCall) {
    const pilot = _markers[pilotId]?._pilotData;
    if (pilot) {
      await acceptCall(activeCall.id, pilot);
    }
  } else {
    showToastMessage('❌ Nenhum chamado ativo encontrado.', 'error');
  }
};

// Responder SOS
window.respondToSOS = function(pilotId, pilotName) {
  showToastMessage(`🚨 Respondendo SOS de ${pilotName}...`, 'warning');
  playSoundEffect('sos');
  
  window.dispatchEvent(new CustomEvent('amx:respond-sos', {
    detail: { pilotId: pilotId, name: pilotName }
  }));
  
  // Abrir chat com o piloto em SOS
  if (window.openChat) {
    window.openChat(pilotId);
  }
};

// ── Filtro de Conversas Reais ─────────────────────────────────
export function loadRealChatsOnly(chats) {
  if (!Array.isArray(chats)) return [];
  
  return chats.filter(chat => {
    // Descartar IDs que contêm 'demo', 'test', 'fake'
    if (chat.uid?.includes('demo') || chat.id?.includes('demo')) return false;
    if (chat.fake === true) return false;
    
    // Manter apenas chats com usuários reais
    return chat.uid && chat.uid.length > 5;
  });
}

// ── Pilotos Próximos Helper ───────────────────────────────────
export function findNearbyPilots(lat, lon, radiusKm) {
  const nearby = [];
  
  Object.values(_markers).forEach(marker => {
    const pilot = marker._pilotData;
    if (!pilot || pilot.isCurrentUser) return;
    
    const distance = calculateDistance(lat, lon, pilot.lat, pilot.lon);
    if (distance <= radiusKm) {
      nearby.push(pilot);
    }
  });
  
  return nearby;
}

// ── Adicionar/atualizar piloto ────────────────────────────────
export function upsertPilot(pilot) {
  if (!_map || !pilot.lat || !pilot.lon) return;

  const icon = pilotIcon(pilot.status || 'online', pilot.isCurrentUser === true);
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

// ── Utilitários de UI ─────────────────────────────────────────
function showToastMessage(message, type = 'info') {
  let toast = document.getElementById('amx-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'amx-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 20px;
      background: #1f5534;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      font-family: 'Syne', sans-serif;
    `;
    document.body.appendChild(toast);
  }
  
  toast.textContent = message;
  toast.style.opacity = '1';
  
  setTimeout(() => {
    toast.style.opacity = '0';
  }, 3000);
}

let _audioCtx = null;
function getAudioContext() {
  if (_audioCtx) return _audioCtx;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  _audioCtx = new AudioContext();
  return _audioCtx;
}

function playSoundEffect(type) {
  try {
    const audioCtx = getAudioContext();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'sos') {
      oscillator.frequency.value = 880;
      gainNode.gain.value = 0.3;
      oscillator.start();
      setTimeout(() => oscillator.stop(), 500);
    } else if (type === 'accept') {
      oscillator.frequency.value = 523.25;
      gainNode.gain.value = 0.2;
      oscillator.start();
      setTimeout(() => oscillator.stop(), 300);
    } else {
      oscillator.frequency.value = 523.25;
      gainNode.gain.value = 0.2;
      oscillator.start();
      setTimeout(() => oscillator.stop(), 250);
    }
  } catch(e) { console.log('Sound not supported'); }
}

let _loopSoundInterval = null;
function playLoopSound(type, duration) {
  stopLoopSound();
  _loopSoundInterval = setInterval(() => {
    playSoundEffect(type);
  }, 2000);
  
  setTimeout(() => {
    stopLoopSound();
  }, duration);
}

function stopLoopSound() {
  if (_loopSoundInterval) {
    clearInterval(_loopSoundInterval);
    _loopSoundInterval = null;
  }
}

// ── Listen Pilots (compatível) ────────────────────────────────
export async function listenPilots(centerLat, centerLon, currentUid) {
  _currentUid = currentUid;
  
  Object.keys(_markers).forEach(id => {
    if (!id.startsWith('user_')) removePilot(id);
  });
  
  spawnBots(centerLat, centerLon, { wind: 10, temp: 25 });
  startBotUpdates();
  updatePilotCount();
  
  if (window._firebaseDB && typeof firebase !== 'undefined') {
    try {
      const { collection, onSnapshot, query, where } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      const q = query(collection(window._firebaseDB, 'pilots'), where('visibility', '!=', 'invisible'));
      
      if (window._firestoreUnsub) window._firestoreUnsub();
      window._firestoreUnsub = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(change => {
          const d = change.doc.data();
          if (change.type === 'removed' || d.visibility === 'invisible') {
            removePilot(d.uid);
            return;
          }
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
            lat: d.lat,
            lon: d.lon,
            status: d.status || 'online',
            requestMsg: d.requestMsg || null,
            isCurrentUser: d.uid === currentUid,
          });
        });
        updatePilotCount();
      });
      return true;
    } catch (e) {
      console.log('Modo offline: apenas bots');
    }
  }
  return false;
}

function updatePilotCount() {
  const total = Object.keys(_markers).length;
  const el = document.getElementById('pilotCount');
  if (el) el.textContent = `${total} pilotos`;
}

// ── Bots ──────────────────────────────────────────────────────
export function spawnBots(lat, lon, weather) {
  const hour = new Date().getHours();
  const isDay = hour >= 5 && hour <= 18;
  const goodWind = (weather?.wind || 0) <= 20;

  const activeBots = BOTS.filter((_, i) => {
    if (!isDay) return i < 2;
    if (!goodWind) return i < 4;
    return true;
  });

  activeBots.forEach((bot, i) => {
    const angle = (i / activeBots.length) * Math.PI * 2 + Math.random() * 0.5;
    const radius = (5 + Math.random() * 35) / 111;
    const blat = lat + Math.cos(angle) * radius;
    const blon = lon + Math.sin(angle) * radius / Math.cos(lat * Math.PI / 180);
    const isOperating = isDay && goodWind && Math.random() > 0.4;

    upsertPilot({
      ...bot,
      lat: blat,
      lon: blon,
      status: isOperating ? 'operating' : 'online',
      isCurrentUser: false,
    });
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

// ── Localização (60s em vez de 30s) ───────────────────────────
export function startLocationTracking(uid, onUpdate) {
  let lastLat = null, lastLon = null;

  function update() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude: lat, longitude: lon } = pos.coords;
      const dist = lastLat ? Math.sqrt(Math.pow((lat - lastLat) * 111000, 2) + Math.pow((lon - lastLon) * 111000, 2)) : 9999;

      if (dist >= 300 || !lastLat) {
        lastLat = lat; lastLon = lon;
        onUpdate(lat, lon);
      }
    }, null, { enableHighAccuracy: true, timeout: 10000 });
  }

  update();
  if (_locationInterval) clearInterval(_locationInterval);
  _locationInterval = setInterval(update, 60000); // 60 segundos!
}

export function stopLocationTracking() {
  if (_locationInterval) clearInterval(_locationInterval);
}

// ── Operações ─────────────────────────────────────────────────
export function startOperation(config, weatherState, lat, lon) {
  _operationActive = true;
  _operationStart = Date.now();
  _operationConfig = config || {};
  _operationData = {
    startTime: new Date().toISOString(),
    lat, lon,
    weather: { ...weatherState },
    pauses: 0,
    lastActivity: Date.now(),
  };

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
  if (_pauseTimer) clearTimeout(_pauseTimer);

  const durationMin = Math.round((Date.now() - _operationStart) / 60000);
  const score = calcAMXScore(durationMin, weatherState, _operationData, _operationConfig);
  const estimate = calcOperationEstimate(durationMin, _operationConfig, _operationData);

  return {
    ..._operationData,
    endTime: new Date().toISOString(),
    durationMin,
    score,
    estimate,
    config: _operationConfig,
  };
}

export function registerActivity() {
  if (!_operationActive) return;
  _operationData.lastActivity = Date.now();
  if (_pauseTimer) {
    clearTimeout(_pauseTimer);
    _pauseTimer = null;
  }
  _pauseTimer = setTimeout(() => {
    if (_operationActive) {
      _operationData.pauses++;
    }
  }, 5 * 60 * 1000);
}

export function calcOperationEstimate(durationMin, config, opData) {
  const avgHaPerH = parseFloat(config?.avgHaPerH) || 20;
  const hoursOp = Math.max(0, (durationMin - (opData?.pauses || 0) * 5)) / 60;
  const estHa = (hoursOp * avgHaPerH).toFixed(1);
  const vazao = parseFloat(config?.vazao) || 10;
  const faixa = parseFloat(config?.faixa) || 9;

  let conf = 100;
  if (vazao < 3 || vazao > 50) conf -= 30;
  if (faixa < 4 || faixa > 20) conf -= 20;
  if (avgHaPerH > 45) conf -= 25;
  if (durationMin < 10) conf -= 40;
  conf = Math.max(0, conf);

  return { estHa, hoursOp: hoursOp.toFixed(1), confiability: conf, label: conf >= 80 ? 'Alta' : conf >= 50 ? 'Média' : 'Baixa' };
}

export function calcAMXScore(durationMin, weather, opData, config) {
  let score = 100;
  const w = weather || {};
  const dt = w.deltaT || 5, wind = w.wind || 0, hum = w.humidity || 70, temp = w.temp || 25;

  if (dt < 2 || dt > 10) score -= 20;
  else if (dt > 8) score -= 10;
  if (wind > 20) score -= 25;
  else if (wind > 15) score -= 15;
  else if (wind > 10) score -= 5;
  if (hum > 90) score -= 10;
  if (hum < 40) score -= 10;
  if (temp > 35) score -= 15;
  if (temp < 10) score -= 10;
  if (durationMin < 5) score -= 30;
  else if (durationMin < 10) score -= 15;

  const hour = new Date().getHours();
  if (hour >= 0 && hour < 4) score -= 20;
  if (hour >= 5 && hour <= 9) score += 5;

  const vazao = parseFloat(config?.vazao) || 10;
  if (vazao >= 5 && vazao <= 30) score += 5;
  if ((opData?.pauses || 0) > 3) score -= 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function amxLabel(score) {
  if (score >= 90) return { label: 'Excelente', color: '#3da866' };
  if (score >= 75) return { label: 'Ótimo', color: '#5ec880' };
  if (score >= 60) return { label: 'Bom', color: '#1e88d0' };
  if (score >= 40) return { label: 'Moderado', color: '#e07a00' };
  return { label: 'Risco', color: '#e03535' };
}

// ── Getters ────────────────────────────────────────────────────
export function isOperating() { return _operationActive; }
export function getMap() { return _map; }
export function getMarkers() { return _markers; }
export function getActiveCall() { return currentCallId ? activeCallsMap.get(currentCallId) : null; }

// ── Funções para testes com bots ──────────────────────────────
export function addBotRequest(botId, message) {
  const bot = _markers[botId];
  if (bot && bot._pilotData && bot._pilotData.id?.startsWith('bot_')) {
    bot._pilotData.status = 'request';
    bot._pilotData.requestMsg = message;
    upsertPilot(bot._pilotData);
  }
}

export function addBotSOS(botId) {
  const bot = _markers[botId];
  if (bot && bot._pilotData && bot._pilotData.id?.startsWith('bot_')) {
    bot._pilotData.status = 'sos';
    upsertPilot(bot._pilotData);
  }
}

export function clearBotStatus(botId) {
  const bot = _markers[botId];
  if (bot && bot._pilotData && bot._pilotData.id?.startsWith('bot_')) {
    bot._pilotData.status = 'online';
    bot._pilotData.requestMsg = null;
    upsertPilot(bot._pilotData);
  }
}

// ── Exportar funções globais para compatibilidade ─────────────
if (typeof window !== 'undefined') {
  window.createCall = createCall;
  window.acceptCall = acceptCall;
  window.findNearbyPilots = findNearbyPilots;
  window.loadRealChatsOnly = loadRealChatsOnly;
  window.acceptCallFromPopup = window.acceptCallFromPopup;
  window.respondToSOS = window.respondToSOS;
}
