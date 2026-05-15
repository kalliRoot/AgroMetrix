// ══════════════════════════════════════════════════════════════════
// AGROMETRIX RADAR — BOTS AGRÍCOLAS + SISTEMA DE DOMÍNIO DE ÁREA
// ══════════════════════════════════════════════════════════════════
//
// COMO USAR:
//   1. No index.html, SUBSTITUA o bloco que começa em
//      "const CIDADES_BRASIL = [" e termina em
//      "function updateBotCount() {" pelo conteúdo deste arquivo.
//   2. Mantenha tudo que vem depois de updateBotCount() intacto.
//   3. Chame initDominioArea(R.map) logo após setupMap() inicializar o mapa.
//      Exemplo (dentro de setupMap):
//        R.map = initMap('mapEl', lat, lon);
//        initDominioArea(R.map);   // ← adicionar esta linha
//
// ══════════════════════════════════════════════════════════════════


// ── 1. ARRAY DE 25 BOTS AGRÍCOLAS REALISTAS ──────────────────────
//
// Distribuição:
//   • 20 homens, 5 mulheres
//   • Regiões: MT, GO, MS, Oeste BA, PR, Interior SP,
//              Triângulo Mineiro, TO, MATOPIBA, Manaus
//   • Ha entre 10–100 (maioria 10–60)
//   • Posições fixas em zonas agrícolas, sem litoral/oceano

const BOTS = [
  // ── Mato Grosso (5 pilotos) ──────────────────────────────────
  {
    id: 'bot_001',
    name: 'Renato Borges',
    city: 'Sorriso, MT',
    drone: 'DJI Agras T50',
    photo: '👨‍✈️',
    score: 82,
    hoursTotal: 1840,
    opsTotal: 312,
    haTotal: 48,
    lat: -12.548, lon: -55.721,
    status: 'operating',
    isCurrentUser: false,
  },
  {
    id: 'bot_002',
    name: 'Cleiton Figueiredo',
    city: 'Lucas do Rio Verde, MT',
    drone: 'XAG P100 Pro',
    photo: '👨‍✈️',
    score: 76,
    hoursTotal: 1320,
    opsTotal: 241,
    haTotal: 62,
    lat: -13.056, lon: -55.913,
    status: 'online',
    isCurrentUser: false,
  },
  {
    id: 'bot_003',
    name: 'Deivid Machado',
    city: 'Sinop, MT',
    drone: 'DJI Agras T40',
    photo: '👨‍✈️',
    score: 69,
    hoursTotal: 980,
    opsTotal: 178,
    haTotal: 35,
    lat: -11.862, lon: -55.504,
    status: 'online',
    isCurrentUser: false,
  },
  {
    id: 'bot_004',
    name: 'Adriana Queiroz',
    city: 'Campos de Júlio, MT',
    drone: 'XAG V40',
    photo: '👩‍✈️',
    score: 88,
    hoursTotal: 2100,
    opsTotal: 390,
    haTotal: 57,
    lat: -13.518, lon: -59.268,
    status: 'operating',
    isCurrentUser: false,
  },
  {
    id: 'bot_005',
    name: 'Márcio Cavalcante',
    city: 'Primavera do Leste, MT',
    drone: 'DJI Agras T50',
    photo: '👨‍✈️',
    score: 91,
    hoursTotal: 2650,
    opsTotal: 510,
    haTotal: 73,
    lat: -15.559, lon: -54.284,
    status: 'operating',
    isCurrentUser: false,
  },

  // ── Goiás (3 pilotos) ────────────────────────────────────────
  {
    id: 'bot_006',
    name: 'Fábio Rezende',
    city: 'Rio Verde, GO',
    drone: 'XAG P100 Pro',
    photo: '👨‍✈️',
    score: 78,
    hoursTotal: 1540,
    opsTotal: 288,
    haTotal: 41,
    lat: -17.793, lon: -50.928,
    status: 'online',
    isCurrentUser: false,
  },
  {
    id: 'bot_007',
    name: 'Tatiane Moreira',
    city: 'Jataí, GO',
    drone: 'DJI Agras T40',
    photo: '👩‍✈️',
    score: 84,
    hoursTotal: 1760,
    opsTotal: 320,
    haTotal: 53,
    lat: -17.881, lon: -51.713,
    status: 'operating',
    isCurrentUser: false,
  },
  {
    id: 'bot_008',
    name: 'Wendel Carneiro',
    city: 'Mineiros, GO',
    drone: 'EAVision U10',
    photo: '👨‍✈️',
    score: 65,
    hoursTotal: 730,
    opsTotal: 140,
    haTotal: 22,
    lat: -17.567, lon: -52.552,
    status: 'online',
    isCurrentUser: false,
  },

  // ── Mato Grosso do Sul (2 pilotos) ───────────────────────────
  {
    id: 'bot_009',
    name: 'Leandro Pavan',
    city: 'Dourados, MS',
    drone: 'DJI Agras T50',
    photo: '👨‍✈️',
    score: 87,
    hoursTotal: 2010,
    opsTotal: 367,
    haTotal: 66,
    lat: -22.223, lon: -54.805,
    status: 'operating',
    isCurrentUser: false,
  },
  {
    id: 'bot_010',
    name: 'Robson Menezes',
    city: 'Maracaju, MS',
    drone: 'XAG V40',
    photo: '👨‍✈️',
    score: 72,
    hoursTotal: 1100,
    opsTotal: 198,
    haTotal: 38,
    lat: -21.630, lon: -55.168,
    status: 'online',
    isCurrentUser: false,
  },

  // ── Oeste da Bahia (2 pilotos) ───────────────────────────────
  {
    id: 'bot_011',
    name: 'Gilson Patriota',
    city: 'Luís Eduardo Magalhães, BA',
    drone: 'DJI Agras T40',
    photo: '👨‍✈️',
    score: 79,
    hoursTotal: 1420,
    opsTotal: 260,
    haTotal: 44,
    lat: -12.096, lon: -45.789,
    status: 'operating',
    isCurrentUser: false,
  },
  {
    id: 'bot_012',
    name: 'Simone Barros',
    city: 'Barreiras, BA',
    drone: 'XAG P100 Pro',
    photo: '👩‍✈️',
    score: 81,
    hoursTotal: 1680,
    opsTotal: 305,
    haTotal: 59,
    lat: -12.152, lon: -44.987,
    status: 'online',
    isCurrentUser: false,
  },

  // ── Paraná (3 pilotos) ───────────────────────────────────────
  {
    id: 'bot_013',
    name: 'Emerson Krauss',
    city: 'Cascavel, PR',
    drone: 'DJI Agras T25',
    photo: '👨‍✈️',
    score: 74,
    hoursTotal: 1180,
    opsTotal: 212,
    haTotal: 31,
    lat: -24.957, lon: -53.456,
    status: 'online',
    isCurrentUser: false,
  },
  {
    id: 'bot_014',
    name: 'Alex Witkoski',
    city: 'Toledo, PR',
    drone: 'XAG V40',
    photo: '👨‍✈️',
    score: 86,
    hoursTotal: 1900,
    opsTotal: 348,
    haTotal: 55,
    lat: -24.724, lon: -53.742,
    status: 'operating',
    isCurrentUser: false,
  },
  {
    id: 'bot_015',
    name: 'Cristiane Luz',
    city: 'Palotina, PR',
    drone: 'DJI Agras T40',
    photo: '👩‍✈️',
    score: 70,
    hoursTotal: 960,
    opsTotal: 172,
    haTotal: 28,
    lat: -24.284, lon: -53.843,
    status: 'online',
    isCurrentUser: false,
  },

  // ── Interior de SP (2 pilotos) ───────────────────────────────
  {
    id: 'bot_016',
    name: 'Vinicius Salles',
    city: 'Ribeirão Preto, SP',
    drone: 'DJI Agras T50',
    photo: '👨‍✈️',
    score: 93,
    hoursTotal: 2800,
    opsTotal: 535,
    haTotal: 85,
    lat: -21.025, lon: -47.724,
    status: 'operating',
    isCurrentUser: false,
  },
  {
    id: 'bot_017',
    name: 'Hélio Junqueira',
    city: 'Barretos, SP',
    drone: 'XAG P100 Pro',
    photo: '👨‍✈️',
    score: 77,
    hoursTotal: 1350,
    opsTotal: 247,
    haTotal: 43,
    lat: -20.558, lon: -48.567,
    status: 'online',
    isCurrentUser: false,
  },

  // ── Triângulo Mineiro (2 pilotos) ────────────────────────────
  {
    id: 'bot_018',
    name: 'Augusto Braga',
    city: 'Uberaba, MG',
    drone: 'DJI Agras T40',
    photo: '👨‍✈️',
    score: 80,
    hoursTotal: 1610,
    opsTotal: 294,
    haTotal: 49,
    lat: -19.747, lon: -47.931,
    status: 'online',
    isCurrentUser: false,
  },
  {
    id: 'bot_019',
    name: 'Nilton Saraiva',
    city: 'Patos de Minas, MG',
    drone: 'EAVision U10',
    photo: '👨‍✈️',
    score: 67,
    hoursTotal: 820,
    opsTotal: 151,
    haTotal: 27,
    lat: -18.579, lon: -46.517,
    status: 'online',
    isCurrentUser: false,
  },

  // ── Tocantins (2 pilotos) ────────────────────────────────────
  {
    id: 'bot_020',
    name: 'Dorneles Aguiar',
    city: 'Pedro Afonso, TO',
    drone: 'XAG P100 Pro',
    photo: '👨‍✈️',
    score: 75,
    hoursTotal: 1290,
    opsTotal: 233,
    haTotal: 40,
    lat: -8.969, lon: -48.174,
    status: 'operating',
    isCurrentUser: false,
  },
  {
    id: 'bot_021',
    name: 'Edmar Fontes',
    city: 'Gurupi, TO',
    drone: 'DJI Agras T25',
    photo: '👨‍✈️',
    score: 63,
    hoursTotal: 690,
    opsTotal: 128,
    haTotal: 19,
    lat: -11.729, lon: -49.065,
    status: 'online',
    isCurrentUser: false,
  },

  // ── MATOPIBA — MA/PI (2 pilotos) ─────────────────────────────
  {
    id: 'bot_022',
    name: 'Tarcísio Leal',
    city: 'Balsas, MA',
    drone: 'DJI Agras T40',
    photo: '👨‍✈️',
    score: 71,
    hoursTotal: 1040,
    opsTotal: 186,
    haTotal: 34,
    lat: -7.531, lon: -46.037,
    status: 'online',
    isCurrentUser: false,
  },
  {
    id: 'bot_023',
    name: 'Wenderson Pires',
    city: 'Uruçuí, PI',
    drone: 'XAG V40',
    photo: '👨‍✈️',
    score: 73,
    hoursTotal: 1130,
    opsTotal: 204,
    haTotal: 37,
    lat: -7.228, lon: -44.555,
    status: 'operating',
    isCurrentUser: false,
  },

  // ── Manaus — AM (1 piloto) ───────────────────────────────────
  {
    id: 'bot_024',
    name: 'Kelven Andrade',
    city: 'Manaus, AM',
    drone: 'DJI Agras T25',
    photo: '👨‍✈️',
    score: 61,
    hoursTotal: 640,
    opsTotal: 117,
    haTotal: 16,
    lat: -3.119, lon: -60.022,
    status: 'online',
    isCurrentUser: false,
  },

  // ── Interior SP extra (1 piloto) ─────────────────────────────
  {
    id: 'bot_025',
    name: 'Patricia Vidal',
    city: 'Araçatuba, SP',
    drone: 'DJI Agras T50',
    photo: '👩‍✈️',
    score: 89,
    hoursTotal: 2230,
    opsTotal: 412,
    haTotal: 78,
    lat: -21.209, lon: -50.426,
    status: 'operating',
    isCurrentUser: false,
  },
];


// ── 2. LÓGICA DE MOVIMENTO DOS BOTS ─────────────────────────────
//
// Cada bot tem uma posição-base fixa (lat/lon originais).
// A cada intervalo, drifta ±0.025° (~2.7 km) — simula voo em fazendas
// próximas. Nunca atravessa estado.

let activeBots = [...BOTS];
let botMovementInterval = null;

/** Spawn inicial: upserta todos os bots, ajustando status pelo horário */
function spawnBotsAgro() {
  const hour = new Date().getHours();
  const isDay = hour >= 5 && hour <= 18;

  activeBots.forEach(bot => {
    const statusAjustado = !isDay
      ? (Math.random() > 0.7 ? 'online' : 'offline')
      : bot.status;
    upsertPilot({ ...bot, status: statusAjustado });
  });
}

/** Movimento orgânico: drift leve na posição-base */
function startBotMovement() {
  if (botMovementInterval) clearInterval(botMovementInterval);
  botMovementInterval = setInterval(() => {
    const hour = new Date().getHours();
    const isDay = hour >= 5 && hour <= 18;

    activeBots.forEach(bot => {
      // Drift pequeno, máximo ~3 km
      const dlat = (Math.random() - 0.5) * 0.025;
      const dlon = (Math.random() - 0.5) * 0.025;
      bot.lat += dlat;
      bot.lon += dlon;

      // Evolução diária de ha (+10–20 ha por dia, acumulado por hora ≈ +0.5–0.8 ha)
      bot.haTotal = Math.min(100, bot.haTotal + (Math.random() * 0.8 + 0.4));

      const novoStatus = !isDay
        ? (Math.random() > 0.8 ? 'online' : 'offline')
        : (Math.random() > 0.45 ? 'operating' : 'online');

      upsertPilot({ ...bot, status: novoStatus });
    });

    // Atualiza domínio de área após movimento
    _renderDominioBeacons();
    updatePilotCount();
  }, 15000); // a cada 15s (mesmo intervalo do startBotUpdates original)
}

function updateBotCount() {
  // Mantém compatibilidade com chamadas existentes em setInterval
  updatePilotCount();
}


// ── 3. SISTEMA DE DOMÍNIO DE ÁREA ───────────────────────────────
//
// Grid de 0.5° (~55 km). O piloto (bot ou real) com mais haTotal
// naquele grid é o "dominante". Exibido como beacon pulse verde
// discreto no mapa. Nome só aparece no hover/click.

const GRID_SIZE = 0.5; // graus
let _dominioLayer = null;
let _dominioMap   = null;
let _dominioMarkers = {}; // chave: "gridLat_gridLon"

/** Inicializa o sistema no mapa Leaflet */
function initDominioArea(map) {
  _dominioMap = map;
  _dominioLayer = L.layerGroup().addTo(map);
  _renderDominioBeacons();
}

/** Calcula qual piloto domina cada grid e renderiza beacons */
function _renderDominioBeacons() {
  if (!_dominioMap) return;

  // Coletar todos os pilotos visíveis (bots + user)
  const todos = [];

  // Bots
  activeBots.forEach(b => {
    if (b.status !== 'offline') {
      todos.push({ id: b.id, name: b.name, city: b.city, drone: b.drone,
                   ha: b.haTotal, lat: b.lat, lon: b.lon, photo: b.photo });
    }
  });

  // Piloto real (se existir)
  const R = window.AgroRadar;
  if (R?.profile && R?.lat && R?.lon) {
    todos.push({
      id: R.user?.uid || 'user',
      name: R.profile.nickname || R.profile.name || 'Você',
      city: R.profile.city || '',
      drone: R.profile.drone || '',
      ha: R.profile.haTotal || 0,
      lat: R.lat, lon: R.lon,
      photo: R.profile.photo || '👨‍✈️',
    });
  }

  // Agrupar por grid
  const gridMap = {};
  todos.forEach(p => {
    const gLat = Math.floor(p.lat / GRID_SIZE) * GRID_SIZE;
    const gLon = Math.floor(p.lon / GRID_SIZE) * GRID_SIZE;
    const key = `${gLat}_${gLon}`;
    if (!gridMap[key] || p.ha > gridMap[key].ha) {
      gridMap[key] = { ...p, gLat, gLon };
    }
  });

  // Remover beacons antigos que já não têm dominante
  Object.keys(_dominioMarkers).forEach(key => {
    if (!gridMap[key]) {
      _dominioLayer.removeLayer(_dominioMarkers[key]);
      delete _dominioMarkers[key];
    }
  });

  // Criar/atualizar beacons
  Object.entries(gridMap).forEach(([key, dominante]) => {
    const centerLat = dominante.gLat + GRID_SIZE / 2;
    const centerLon = dominante.gLon + GRID_SIZE / 2;

    if (_dominioMarkers[key]) {
      // Apenas atualiza dados do popup sem recriar o marker
      _dominioMarkers[key]._dominioData = dominante;
      return;
    }

    const icon = _criarBeaconIcon();
    const marker = L.marker([centerLat, centerLon], {
      icon,
      zIndexOffset: -100, // fica abaixo dos pilotos
      interactive: true,
    });

    marker._dominioData = dominante;

    marker.on('click', () => _abrirPainelDominio(marker._dominioData));

    // Zoom-based visibility: só mostra label no zoom ≥ 9
    _dominioMap.on('zoomend', () => {
      const zoom = _dominioMap.getZoom();
      const el = marker.getElement();
      if (!el) return;
      el.querySelector('.beacon-label').style.display = zoom >= 9 ? 'block' : 'none';
    });

    _dominioLayer.addLayer(marker);
    _dominioMarkers[key] = marker;
  });

  // Atualiza contador de áreas dominadas
  _atualizarContadorDominio(Object.keys(gridMap).length);
}

/** Cria o ícone HTML do beacon pulse */
function _criarBeaconIcon() {
  return L.divIcon({
    className: '',
    html: `
      <div class="beacon-wrapper" title="Área dominada">
        <div class="beacon-pulse"></div>
        <div class="beacon-core"></div>
        <div class="beacon-label" style="display:none"></div>
      </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

/** Abre painel premium ao clicar no beacon */
function _abrirPainelDominio(d) {
  if (!d) return;
  const desde = _calcularDesde();
  const fotoHtml = d.photo && !d.photo.startsWith('http')
    ? `<span style="font-size:32px">${d.photo}</span>`
    : `<img src="${d.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.outerHTML='👨‍✈️'">`;

  // Reutiliza o sistema de toast + sheet existente via popup Leaflet temporário
  // Para não criar novo HTML global, injetamos num popup centralizado
  const html = `
    <div style="min-width:190px;font-family:'Syne',sans-serif">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="width:44px;height:44px;border-radius:50%;background:#1f5534;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;border:1.5px solid rgba(61,168,102,.4)">
          ${fotoHtml}
        </div>
        <div>
          <div style="font-size:14px;font-weight:800;color:#e8f5eb">${d.name}</div>
          <div style="font-size:10px;color:#5a8a65;margin-top:1px">📍 ${d.city}</div>
        </div>
      </div>
      <div style="background:rgba(61,168,102,.08);border:1px solid rgba(61,168,102,.2);border-radius:10px;padding:10px;display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <div style="text-align:center">
          <div style="font-size:20px;font-weight:700;color:#3da866">${d.ha.toFixed(0)} ha</div>
          <div style="font-size:9px;color:#5a8a65;text-transform:uppercase;letter-spacing:.07em">Hectares</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:13px;font-weight:700;color:#9ac8a6">${d.drone || '—'}</div>
          <div style="font-size:9px;color:#5a8a65;text-transform:uppercase;letter-spacing:.07em">Drone</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:rgba(61,168,102,.06);border-radius:8px;border:1px solid rgba(61,168,102,.15)">
        <span style="font-size:14px">🏆</span>
        <div style="font-size:11px;color:#9ac8a6">Domina esta área <strong style="color:#3da866">há ${desde}</strong></div>
      </div>
    </div>`;

  // Abre popup Leaflet no centro do grid
  L.popup({ className: 'dominio-popup', closeButton: true, maxWidth: 240 })
    .setLatLng([
      Math.floor(d.lat / GRID_SIZE) * GRID_SIZE + GRID_SIZE / 2,
      Math.floor(d.lon / GRID_SIZE) * GRID_SIZE + GRID_SIZE / 2,
    ])
    .setContent(html)
    .openOn(_dominioMap);
}

/** Simula "desde quando domina" — aleatório entre 3 e 45 dias */
function _calcularDesde() {
  const dias = Math.floor(Math.random() * 42) + 3;
  return dias === 1 ? '1 dia' : `${dias} dias`;
}

/** Atualiza o badge de contagem no header */
function _atualizarContadorDominio(qtd) {
  // Tenta atualizar o pilotCount com formato separado
  const el = document.getElementById('pilotCount');
  if (!el) return;
  const pilotos = document.querySelectorAll('.leaflet-marker-icon').length;
  el.textContent = `${Math.max(pilotos, 8)} pilotos · ${qtd} áreas`;
}


// ── 4. CSS DO BEACON — injetar no <head> ──────────────────────────
//
// Cole este bloco dentro da tag <style> existente no HTML,
// ou deixe o script injetá-lo automaticamente:

(function _injetarCSSBeacon() {
  if (document.getElementById('beaconCSS')) return;
  const style = document.createElement('style');
  style.id = 'beaconCSS';
  style.textContent = `
    /* ── Beacon de Domínio de Área ── */
    .beacon-wrapper {
      position: relative;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .beacon-core {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #3da866;
      box-shadow: 0 0 6px #3da866, 0 0 12px rgba(61,168,102,.5);
      position: relative;
      z-index: 2;
      flex-shrink: 0;
    }
    .beacon-pulse {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: rgba(61, 168, 102, 0.15);
      border: 1px solid rgba(61, 168, 102, 0.35);
      animation: beaconPulse 2.4s ease-out infinite;
      z-index: 1;
    }
    @keyframes beaconPulse {
      0%   { transform: translate(-50%,-50%) scale(0.6); opacity: 0.8; }
      70%  { transform: translate(-50%,-50%) scale(1.9); opacity: 0; }
      100% { transform: translate(-50%,-50%) scale(0.6); opacity: 0; }
    }
    .beacon-label {
      position: absolute;
      bottom: -18px;
      left: 50%;
      transform: translateX(-50%);
      white-space: nowrap;
      font-family: 'Syne', sans-serif;
      font-size: 9px;
      font-weight: 700;
      color: #3da866;
      text-shadow: 0 1px 3px rgba(0,0,0,.8);
      pointer-events: none;
      z-index: 3;
      letter-spacing: .03em;
    }
    /* Popup do domínio */
    .dominio-popup .leaflet-popup-content-wrapper {
      background: rgba(8, 16, 10, 0.97) !important;
      border: 1px solid rgba(61,168,102,.3) !important;
      border-radius: 16px !important;
      box-shadow: 0 12px 40px rgba(0,0,0,.8), 0 0 0 1px rgba(61,168,102,.1) !important;
      backdrop-filter: blur(16px);
    }
    .dominio-popup .leaflet-popup-tip {
      background: rgba(8, 16, 10, 0.97) !important;
    }
  `;
  document.head.appendChild(style);
})();


// ── 5. EXPOSIÇÃO GLOBAL ──────────────────────────────────────────
//
// Necessário para que setupMap() possa chamar estas funções:

window.initDominioArea  = initDominioArea;
window.spawnBotsAgro    = spawnBotsAgro;
window.startBotMovement = startBotMovement;
window.updateBotCount   = updateBotCount;
window.activeBots       = activeBots; // para o ranking funcionar

// ── FIM DO ARQUIVO ───────────────────────────────────────────────
