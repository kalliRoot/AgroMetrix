// ═══════════════════════════════════════════════════════════════
//  AgroMetrix — db.js  |  IndexedDB wrapper
//  Stores: operations, settings, weather_cache
// ═══════════════════════════════════════════════════════════════

const DB_NAME    = 'agrometrix';
const DB_VERSION = 3;

let _db = null;

// ── Abrir / migrar DB ─────────────────────────────────────────────
export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = e => {
      const db = e.target.result;

      // Store de operações de campo
      if (!db.objectStoreNames.contains('operations')) {
        const os = db.createObjectStore('operations', { keyPath: 'id' });
        os.createIndex('by_date',   'timestamp',  { unique: false });
        os.createIndex('by_status', 'syncStatus', { unique: false });
        os.createIndex('by_crop',   'crop',       { unique: false });
      }

      // Store de configurações do usuário
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }

      // Cache de dados meteorológicos para offline
      if (!db.objectStoreNames.contains('weather_cache')) {
        const wc = db.createObjectStore('weather_cache', { keyPath: 'locKey' });
        wc.createIndex('by_updated', 'updatedAt', { unique: false });
      }
    };

    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror   = e => reject(e.target.error);
  });
}

// ── Helpers genéricos ─────────────────────────────────────────────
function tx(storeName, mode = 'readonly') {
  return _db.transaction(storeName, mode).objectStore(storeName);
}
function p(req) {
  return new Promise((res, rej) => {
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}

// ═══════════════════════════════════════════════════════════════
//  OPERATIONS
// ═══════════════════════════════════════════════════════════════

export async function saveOperation(data) {
  await openDB();
  const op = {
    id:          data.id || `op_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
    timestamp:   data.timestamp   || Date.now(),
    syncStatus:  data.syncStatus  || 'pending',  // pending | synced
    locName:     data.locName     || '—',
    lat:         data.lat         || null,
    lon:         data.lon         || null,
    crop:        data.crop        || '',
    product:     data.product     || '',
    dosage:      data.dosage      || '',
    area:        data.area        || '',
    appType:     data.appType     || '',        // herbicida | fungicida | inseticida | adubacao
    notes:       data.notes       || '',
    // Snapshot meteorológico no momento da operação
    weather: {
      temp:      data.weather?.temp      ?? null,
      humidity:  data.weather?.humidity  ?? null,
      wind:      data.weather?.wind      ?? null,
      gust:      data.weather?.gust      ?? null,
      windDir:   data.weather?.windDir   ?? null,
      deltaT:    data.weather?.deltaT    ?? null,
      rainProb:  data.weather?.rainProb  ?? null,
      cloud:     data.weather?.cloud     ?? null,
      uv:        data.weather?.uv        ?? null,
      pressure:  data.weather?.pressure  ?? null,
      condition: data.weather?.condition ?? null,
      appScore:  data.weather?.appScore  ?? null,
    }
  };
  await p(tx('operations', 'readwrite').put(op));
  return op;
}

export async function getAllOperations() {
  await openDB();
  return p(tx('operations').getAll());
}

export async function getOperation(id) {
  await openDB();
  return p(tx('operations').get(id));
}

export async function deleteOperation(id) {
  await openDB();
  return p(tx('operations', 'readwrite').delete(id));
}

export async function getPendingOperations() {
  await openDB();
  const idx = tx('operations').index('by_status');
  return p(idx.getAll('pending'));
}

export async function markOperationSynced(id) {
  await openDB();
  const op = await getOperation(id);
  if (!op) return;
  op.syncStatus = 'synced';
  return p(tx('operations', 'readwrite').put(op));
}

// ═══════════════════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════════════════

export async function saveSetting(key, value) {
  await openDB();
  return p(tx('settings', 'readwrite').put({ key, value, updatedAt: Date.now() }));
}

export async function getSetting(key, defaultValue = null) {
  await openDB();
  const row = await p(tx('settings').get(key));
  return row ? row.value : defaultValue;
}

export async function getAllSettings() {
  await openDB();
  const rows = await p(tx('settings').getAll());
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

// ═══════════════════════════════════════════════════════════════
//  WEATHER CACHE (offline)
// ═══════════════════════════════════════════════════════════════

export async function cacheWeather(lat, lon, data) {
  await openDB();
  const locKey = `${(+lat).toFixed(3)}_${(+lon).toFixed(3)}`;
  return p(tx('weather_cache', 'readwrite').put({
    locKey,
    lat, lon,
    data,
    updatedAt: Date.now()
  }));
}

export async function getCachedWeather(lat, lon, maxAgeMs = 3_600_000) { // 1h default
  await openDB();
  const locKey = `${(+lat).toFixed(3)}_${(+lon).toFixed(3)}`;
  const row = await p(tx('weather_cache').get(locKey));
  if (!row) return null;
  if (Date.now() - row.updatedAt > maxAgeMs) return null; // expirado
  return row.data;
}

// ═══════════════════════════════════════════════════════════════
//  EXPORT HELPERS
// ═══════════════════════════════════════════════════════════════

export async function exportOperationsCSV() {
  const ops = await getAllOperations();
  const cols = [
    'ID','Data','Hora','Local','Latitude','Longitude','Cultura',
    'Produto','Dosagem','Área (ha)','Tipo Aplicação','Notas',
    'Temp (°C)','Umidade (%)','Vento (km/h)','Rajada (km/h)',
    'Direção Vento','Delta T (°C)','Prob. Chuva (%)','Nuvens (%)',
    'UV','Pressão (hPa)','Condição','Score Aplicação','Status Sync'
  ];
  const rows = ops.map(o => {
    const d = new Date(o.timestamp);
    const w = o.weather || {};
    return [
      o.id,
      d.toLocaleDateString('pt-BR'),
      d.toLocaleTimeString('pt-BR'),
      o.locName,
      o.lat ?? '',
      o.lon ?? '',
      o.crop,
      o.product,
      o.dosage,
      o.area,
      o.appType,
      o.notes,
      w.temp ?? '', w.humidity ?? '', w.wind ?? '', w.gust ?? '',
      w.windDir ?? '', w.deltaT ?? '', w.rainProb ?? '', w.cloud ?? '',
      w.uv ?? '', w.pressure ?? '', w.condition ?? '', w.appScore ?? '',
      o.syncStatus
    ];
  });
  const bom = '\uFEFF';
  const csv = bom + [cols, ...rows].map(r =>
    r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')
  ).join('\r\n');
  return csv;
}

export async function getStats() {
  const ops = await getAllOperations();
  const total = ops.length;
  const byType = {};
  ops.forEach(o => { byType[o.appType] = (byType[o.appType] || 0) + 1; });
  const lastOp = ops.sort((a,b) => b.timestamp - a.timestamp)[0] || null;
  const totalArea = ops.reduce((s, o) => s + (parseFloat(o.area) || 0), 0);
  return { total, byType, lastOp, totalArea };
}
