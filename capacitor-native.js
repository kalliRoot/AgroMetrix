// ═══════════════════════════════════════════════════════════════
//  AgroMetrix — capacitor-native.js
//  Integração nativa com Capacitor: GPS · Notificações · Backbutton
//  Este arquivo só é importado quando o app roda no Capacitor
// ═══════════════════════════════════════════════════════════════

// Detecta ambiente Capacitor
const isNative = () => typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.();
const isAndroid = () => isNative() && window.Capacitor?.getPlatform?.() === 'android';
const isIOS     = () => isNative() && window.Capacitor?.getPlatform?.() === 'ios';

// ═══════════════════════════════════════════════════════════════
//  STATUS BAR
// ═══════════════════════════════════════════════════════════════
async function initStatusBar() {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0d2b1a' });
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch (e) { console.warn('[Native] StatusBar:', e); }
}

// ═══════════════════════════════════════════════════════════════
//  SPLASH SCREEN
// ═══════════════════════════════════════════════════════════════
async function hideSplash() {
  if (!isNative()) return;
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide({ fadeOutDuration: 500 });
  } catch (e) { console.warn('[Native] SplashScreen:', e); }
}

// ═══════════════════════════════════════════════════════════════
//  BACKBUTTON (Android)
// ═══════════════════════════════════════════════════════════════
function initBackButton() {
  if (!isNative()) return;
  import('@capacitor/app').then(({ App }) => {
    App.addListener('backButton', ({ canGoBack }) => {
      // Se há modal/panel aberto, fecha primeiro
      const modal = document.getElementById('opFormModal');
      if (modal) { modal.remove(); return; }

      const hist = document.getElementById('historyPanel');
      if (hist && hist.classList.contains('panel-open')) {
        hist.classList.remove('panel-open');
        return;
      }

      // Se pode voltar na webview, volta
      if (canGoBack) { window.history.back(); return; }

      // Pergunta se quer sair do app
      confirmAppExit();
    });
  }).catch(() => {});
}

let _exitConfirmShown = false;
async function confirmAppExit() {
  if (_exitConfirmShown) {
    const { App } = await import('@capacitor/app');
    App.exitApp();
    return;
  }
  _exitConfirmShown = true;
  showNativeToast('Pressione voltar novamente para sair');
  setTimeout(() => { _exitConfirmShown = false; }, 2500);
}

function showNativeToast(msg) {
  // Usa o sistema de toast da PWA
  if (window.AgroPWA?.showToast) {
    window.AgroPWA.showToast(msg, 'info', 2500);
  }
}

// ═══════════════════════════════════════════════════════════════
//  GPS NATIVO (alta precisão, bypass browser permission)
// ═══════════════════════════════════════════════════════════════
export async function getNativeGPS() {
  if (!isNative()) {
    // Fallback para web Geolocation API
    return getWebGPS();
  }
  try {
    const { Geolocation } = await import('@capacitor/geolocation');

    // Pede permissão
    const perms = await Geolocation.requestPermissions();
    if (perms.location !== 'granted') throw new Error('Permissão GPS negada');

    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30000,
    });
    return {
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      source: 'native-gps',
    };
  } catch (err) {
    console.warn('[Native] GPS falhou, fallback web:', err);
    return getWebGPS();
  }
}

function getWebGPS() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Geolocation não suportado')); return; }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, source: 'web-gps' }),
      err => reject(err),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  });
}

// ═══════════════════════════════════════════════════════════════
//  NOTIFICAÇÕES LOCAIS (Capacitor)
// ═══════════════════════════════════════════════════════════════
export async function scheduleWeatherAlert(title, body, delaySeconds = 0) {
  if (!isNative()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.requestPermissions();
    await LocalNotifications.schedule({
      notifications: [{
        id:    Math.floor(Math.random() * 100000),
        title,
        body,
        schedule: delaySeconds > 0
          ? { at: new Date(Date.now() + delaySeconds * 1000) }
          : undefined,
        smallIcon:  'ic_stat_icon_config_sample',
        channelId:  'agrometrix-alerts',
        actionTypeId: 'OPEN_APP',
      }]
    });
  } catch (e) { console.warn('[Native] LocalNotifications:', e); }
}

// Cria canal de notificação no Android
async function createNotificationChannel() {
  if (!isAndroid()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.createChannel({
      id:          'agrometrix-alerts',
      name:        'Alertas Climáticos',
      description: 'Notificações de condições meteorológicas para aplicação',
      importance:  4, // HIGH
      visibility:  1,
      sound:       'beep.wav',
      vibration:   true,
      lights:      true,
      lightColor:  '#3DA866',
    });
  } catch (e) {}
}

// ═══════════════════════════════════════════════════════════════
//  NETWORK (Capacitor)
// ═══════════════════════════════════════════════════════════════
async function initNativeNetwork() {
  if (!isNative()) return;
  try {
    const { Network } = await import('@capacitor/network');

    // Estado inicial
    const status = await Network.getStatus();
    window.AgroPWA.isOnline = status.connected;

    // Listener de mudanças
    Network.addListener('networkStatusChange', status => {
      const online = status.connected;
      window.AgroPWA.isOnline = online;
      window.dispatchEvent(new CustomEvent('agrometrix:network', { detail: { online } }));
      if (online) {
        scheduleWeatherAlert('🌐 Conexão restaurada', 'Sincronizando dados do AgroMetrix...');
      }
    });
  } catch (e) {}
}

// ═══════════════════════════════════════════════════════════════
//  SHARE (nativo)
// ═══════════════════════════════════════════════════════════════
export async function nativeShare(title, text, url) {
  if (!isNative()) {
    if (navigator.share) {
      navigator.share({ title, text, url });
    } else {
      navigator.clipboard.writeText(url || text);
      if (window.AgroPWA?.showToast) window.AgroPWA.showToast('📋 Copiado para área de transferência', 'info');
    }
    return;
  }
  try {
    const { Share } = await import('@capacitor/share');
    await Share.share({ title, text, url, dialogTitle: 'Compartilhar via AgroMetrix' });
  } catch (e) {}
}

// ═══════════════════════════════════════════════════════════════
//  HAPTICS
// ═══════════════════════════════════════════════════════════════
export async function hapticImpact(style = 'MEDIUM') {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle[style] });
  } catch {}
}

export async function hapticNotification(type = 'SUCCESS') {
  if (!isNative()) return;
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    await Haptics.notification({ type: NotificationType[type] });
  } catch {}
}

// ═══════════════════════════════════════════════════════════════
//  PERSISTÊNCIA DE SESSÃO (última localização)
// ═══════════════════════════════════════════════════════════════
export async function saveLastLocation(lat, lon, name) {
  const data = { lat, lon, name, savedAt: Date.now() };
  localStorage.setItem('agrometrix-last-location', JSON.stringify(data));

  // Também salva via Capacitor Preferences se nativo
  if (isNative()) {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key: 'last-location', value: JSON.stringify(data) });
    } catch {}
  }
}

export async function loadLastLocation() {
  // Tenta Capacitor primeiro, depois localStorage
  if (isNative()) {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key: 'last-location' });
      if (value) return JSON.parse(value);
    } catch {}
  }
  const stored = localStorage.getItem('agrometrix-last-location');
  return stored ? JSON.parse(stored) : null;
}

// ═══════════════════════════════════════════════════════════════
//  INIT PRINCIPAL NATIVO
// ═══════════════════════════════════════════════════════════════
export async function initCapacitor() {
  if (!isNative()) {
    console.log('[Native] Rodando em modo web — Capacitor ignorado');
    return;
  }

  console.log(`[Native] Capacitor ativo — plataforma: ${window.Capacitor.getPlatform()}`);

  await Promise.allSettled([
    initStatusBar(),
    initNativeNetwork(),
    createNotificationChannel(),
  ]);

  initBackButton();

  // Esconde splash após setup
  setTimeout(() => hideSplash(), 1500);

  // Listener de mudança de estado do app (foreground/background)
  import('@capacitor/app').then(({ App }) => {
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        // App voltou ao foreground — refresca dados
        window.dispatchEvent(new CustomEvent('agrometrix:app-active'));
      }
    });

    App.addListener('appRestoredResult', data => {
      console.log('[Native] App restaurado:', data);
    });
  }).catch(() => {});

  console.log('[Native] Capacitor configurado com sucesso');
}

// ── Expõe globalmente para uso no HTML ──
window.CapacitorNative = {
  initCapacitor,
  getNativeGPS,
  scheduleWeatherAlert,
  nativeShare,
  hapticImpact,
  hapticNotification,
  saveLastLocation,
  loadLastLocation,
  isNative,
  isAndroid,
  isIOS,
};
