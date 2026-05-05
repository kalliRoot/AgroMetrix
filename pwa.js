// ═══════════════════════════════════════════════════════════════
//  AgroMetrix — pwa.js  |  PWA Manager
//  Registro SW · Install prompt · Notificações · Status rede
// ═══════════════════════════════════════════════════════════════

import { saveSetting, getSetting } from './db.js';

// ── Estado global PWA ─────────────────────────────────────────────
window.AgroPWA = {
  swRegistration: null,
  installPrompt:  null,
  isOnline:       navigator.onLine,
  isInstalled:    false,
  notifGranted:   false,
};

// ═══════════════════════════════════════════════════════════════
//  SERVICE WORKER
// ═══════════════════════════════════════════════════════════════

export async function registerSW() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[PWA] Service Worker não suportado');
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none'
    });
    window.AgroPWA.swRegistration = reg;
    console.log('[PWA] SW registrado:', reg.scope);

    // Verifica atualizações a cada 5 min
    setInterval(() => reg.update(), 5 * 60 * 1000);

    // Detecta nova versão disponível
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateToast();
        }
      });
    });

    // Escuta mensagens do SW
    navigator.serviceWorker.addEventListener('message', onSWMessage);

    // Registra Periodic Sync (Android)
    if (reg.periodicSync) {
      try {
        await reg.periodicSync.register('weather-refresh', { minInterval: 3600 * 1000 });
      } catch {}
    }

    return reg;
  } catch (err) {
    console.error('[PWA] Falha ao registrar SW:', err);
    return null;
  }
}

function onSWMessage(event) {
  const { type } = event.data;
  if (type === 'NETWORK_STATUS') {
    setNetworkStatus(event.data.online);
  } else if (type === 'SYNC_OPERATIONS') {
    window.dispatchEvent(new CustomEvent('agrometrix:sync'));
  } else if (type === 'BG_REFRESH') {
    window.dispatchEvent(new CustomEvent('agrometrix:bg-refresh'));
  }
}

function showUpdateToast() {
  const toast = document.createElement('div');
  toast.className = 'agro-toast agro-toast--update';
  toast.innerHTML = `
    <span>🔄 Nova versão disponível!</span>
    <button onclick="window.location.reload()">Atualizar</button>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('visible'), 100);
}

// ═══════════════════════════════════════════════════════════════
//  INSTALL PROMPT
// ═══════════════════════════════════════════════════════════════

let _installPromptEvent = null;

export function initInstallPrompt() {
  // Detecta se já está instalado
  if (window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true) {
    window.AgroPWA.isInstalled = true;
    document.documentElement.classList.add('pwa-installed');
    return;
  }

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    _installPromptEvent = e;
    window.AgroPWA.installPrompt = e;
    showInstallButton();
    // Salva que o prompt foi disparado
    saveSetting('installPromptShown', true).catch(() => {});
  });

  window.addEventListener('appinstalled', () => {
    window.AgroPWA.isInstalled = true;
    _installPromptEvent = null;
    hideInstallButton();
    showToast('✅ AgroMetrix instalado com sucesso!', 'success');
    saveSetting('appInstalled', true).catch(() => {});
  });
}

export async function triggerInstall() {
  if (!_installPromptEvent) {
    showToast('💡 Use o menu do navegador → "Adicionar à tela inicial"', 'info');
    return false;
  }
  _installPromptEvent.prompt();
  const { outcome } = await _installPromptEvent.userChoice;
  _installPromptEvent = null;
  if (outcome === 'accepted') {
    showToast('🎉 Instalando AgroMetrix...', 'success');
    return true;
  }
  return false;
}

function showInstallButton() {
  const btn = document.getElementById('installBtn');
  if (btn) { btn.style.display = 'flex'; btn.classList.add('visible'); }
  // Cria o botão flutuante se não existir
  if (!btn) createInstallFAB();
}

function hideInstallButton() {
  const btn = document.getElementById('installBtn');
  if (btn) btn.style.display = 'none';
}

function createInstallFAB() {
  const fab = document.createElement('button');
  fab.id = 'installBtn';
  fab.className = 'install-fab';
  fab.innerHTML = `<span>📲</span><span>Instalar App</span>`;
  fab.onclick = () => triggerInstall();
  document.body.appendChild(fab);

  // Auto-esconder após 12s se não interagido
  setTimeout(() => {
    if (fab.parentNode) fab.classList.add('collapsed');
  }, 12000);
}

// ═══════════════════════════════════════════════════════════════
//  NOTIFICAÇÕES PUSH
// ═══════════════════════════════════════════════════════════════

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') {
    window.AgroPWA.notifGranted = true;
    return true;
  }
  const perm = await Notification.requestPermission();
  window.AgroPWA.notifGranted = perm === 'granted';
  return perm === 'granted';
}

export async function subscribePush() {
  const reg = window.AgroPWA.swRegistration;
  if (!reg || !reg.pushManager) return null;

  try {
    // VAPID key pública (substituir pela sua chave real em produção)
    const VAPID_PUBLIC = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjZJDGjkDobsRfKuV-aL_HkEMFpxk';
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC)
    });
    console.log('[PWA] Push subscription:', sub);
    await saveSetting('pushSubscription', JSON.stringify(sub));
    return sub;
  } catch (err) {
    console.warn('[PWA] Push não disponível:', err);
    return null;
  }
}

export function sendLocalNotification(title, body, options = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const reg = window.AgroPWA.swRegistration;
  if (reg) {
    reg.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      vibrate: [150, 75, 150],
      ...options
    });
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
}

// ═══════════════════════════════════════════════════════════════
//  STATUS DE REDE
// ═══════════════════════════════════════════════════════════════

export function initNetworkStatus() {
  updateNetworkUI(navigator.onLine);

  window.addEventListener('online',  () => setNetworkStatus(true));
  window.addEventListener('offline', () => setNetworkStatus(false));
}

function setNetworkStatus(online) {
  window.AgroPWA.isOnline = online;
  updateNetworkUI(online);
  window.dispatchEvent(new CustomEvent('agrometrix:network', { detail: { online } }));

  if (online) {
    showToast('🌐 Conexão restaurada', 'success', 2500);
    // Tenta sincronizar operações pendentes
    syncViaSW();
  } else {
    showToast('📵 Modo offline — dados em cache disponíveis', 'warn', 4000);
  }
}

function updateNetworkUI(online) {
  const indicator = document.getElementById('networkIndicator');
  const body = document.body;
  if (indicator) {
    indicator.textContent = online ? '🌐 Online' : '📵 Offline';
    indicator.className = `network-indicator ${online ? 'online' : 'offline'}`;
  }
  body.classList.toggle('is-offline', !online);
}

async function syncViaSW() {
  const reg = window.AgroPWA.swRegistration;
  if (reg?.sync) {
    try { await reg.sync.register('sync-operations'); } catch {}
  }
}

// ═══════════════════════════════════════════════════════════════
//  TOASTS
// ═══════════════════════════════════════════════════════════════

const _toastQueue = [];
let _toastActive = false;

export function showToast(msg, type = 'info', duration = 3500) {
  _toastQueue.push({ msg, type, duration });
  if (!_toastActive) processToastQueue();
}

function processToastQueue() {
  if (!_toastQueue.length) { _toastActive = false; return; }
  _toastActive = true;
  const { msg, type, duration } = _toastQueue.shift();

  const el = document.createElement('div');
  el.className = `agro-toast agro-toast--${type}`;
  el.textContent = msg;
  document.body.appendChild(el);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add('visible'));
  });

  setTimeout(() => {
    el.classList.remove('visible');
    setTimeout(() => { el.remove(); processToastQueue(); }, 350);
  }, duration);
}

// ═══════════════════════════════════════════════════════════════
//  INIT PRINCIPAL
// ═══════════════════════════════════════════════════════════════

export async function initPWA() {
  await registerSW();
  initInstallPrompt();
  initNetworkStatus();

  // Injeta estilos PWA se não existirem no HTML
  injectPWAStyles();

  console.log('[PWA] AgroMetrix PWA Manager iniciado');
}

function injectPWAStyles() {
  if (document.getElementById('pwa-styles')) return;
  const style = document.createElement('style');
  style.id = 'pwa-styles';
  style.textContent = `
    /* ── Toasts ── */
    .agro-toast {
      position: fixed; bottom: 24px; left: 50%;
      transform: translateX(-50%) translateY(80px);
      padding: 11px 20px; border-radius: 12px;
      font-family: var(--font-ui, system-ui); font-size: 13px; font-weight: 600;
      color: white; white-space: nowrap; z-index: 9999;
      box-shadow: 0 4px 24px rgba(0,0,0,.3);
      transition: transform .3s cubic-bezier(.34,1.56,.64,1), opacity .3s;
      display: flex; align-items: center; gap: 10px;
      opacity: 0; pointer-events: none;
    }
    .agro-toast.visible { transform: translateX(-50%) translateY(0); opacity: 1; pointer-events: auto; }
    .agro-toast--info    { background: #1567a0; }
    .agro-toast--success { background: #286b42; }
    .agro-toast--warn    { background: #8c5a1e; }
    .agro-toast--error   { background: #b02020; }
    .agro-toast--update  { background: #1f5534; cursor: pointer; }
    .agro-toast--update button {
      background: rgba(255,255,255,.2); border: 1px solid rgba(255,255,255,.4);
      color: white; border-radius: 7px; padding: 4px 12px;
      font-size: 12px; font-weight: 700; cursor: pointer;
    }

    /* ── Install FAB ── */
    .install-fab {
      position: fixed; bottom: 80px; right: 20px;
      display: none; align-items: center; gap: 8px;
      padding: 12px 20px; border-radius: 28px;
      background: var(--green-700, #1f5534); color: white;
      border: none; font-family: var(--font-ui, system-ui);
      font-size: 13px; font-weight: 700; cursor: pointer;
      box-shadow: 0 4px 20px rgba(0,0,0,.35);
      z-index: 900; transition: all .3s cubic-bezier(.34,1.56,.64,1);
      animation: fabBounce 2s ease-in-out 1s infinite;
    }
    .install-fab.visible { display: flex; }
    .install-fab.collapsed { padding: 12px; border-radius: 50%; }
    .install-fab.collapsed span:last-child { display: none; }
    .install-fab:hover { transform: scale(1.05); }
    @keyframes fabBounce {
      0%,100% { box-shadow: 0 4px 20px rgba(31,85,52,.35); }
      50%      { box-shadow: 0 8px 32px rgba(31,85,52,.55); }
    }

    /* ── Network indicator ── */
    .network-indicator {
      position: fixed; top: 60px; left: 50%;
      transform: translateX(-50%);
      padding: 4px 14px; border-radius: 20px;
      font-size: 11px; font-weight: 600; z-index: 800;
      transition: all .3s; pointer-events: none;
    }
    .network-indicator.online  { display: none; }
    .network-indicator.offline { background: #b02020; color: white; display: block; }

    /* ── Offline mode ── */
    body.is-offline .now-strip::after {
      content: '📵 Dados offline — última atualização disponível';
      display: block; width: 100%;
      font-size: 10px; color: rgba(255,255,255,.5);
      font-family: var(--font-mono, monospace);
      padding-top: 6px;
    }
  `;
  document.head.appendChild(style);
}
