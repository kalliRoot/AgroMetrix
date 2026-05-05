# 🌿 AgroMetrix — Guia Completo de Build e Publicação

## Estrutura do Projeto

```
agrometrix-pwa/
├── index.html            ← App principal (coloque seu HTML aqui)
├── sw.js                 ← Service Worker (PWA)
├── manifest.json         ← Web App Manifest
├── offline.html          ← Tela offline personalizada
├── pwa.js                ← PWA Manager (ES Module)
├── db.js                 ← IndexedDB wrapper
├── history.js            ← Histórico de operações
├── capacitor-native.js   ← Integração Capacitor (nativo)
├── capacitor.config.json ← Config do Capacitor
├── package.json          ← Dependências
├── scripts/
│   └── generate-icons.js ← Gerador de ícones
├── icons/                ← Ícones gerados (PNG)
└── screenshots/          ← Screenshots para manifest
```

---

## 1. Integração no index.html

Adicione no `<head>` do seu `index.html`:

```html
<!-- PWA Meta Tags -->
<meta name="theme-color" content="#1f5534">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="AgroMetrix">
<meta name="application-name" content="AgroMetrix">
<meta name="msapplication-TileColor" content="#0d2b1a">

<!-- Manifest -->
<link rel="manifest" href="/manifest.json">

<!-- Apple Icons -->
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152.png">
<link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.png">

<!-- Favicon -->
<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png">
```

Adicione antes do `</body>`:

```html
<!-- Network Indicator -->
<div id="networkIndicator" class="network-indicator"></div>

<!-- Scripts PWA (ES Modules) -->
<script type="module">
  import { initPWA, showToast } from '/pwa.js';
  import { openDB, cacheWeather, getCachedWeather, saveSetting, getSetting } from '/db.js';
  import { injectHistoryStyles, renderHistoryPanel, setWeatherStateGetter } from '/history.js';
  import { initCapacitor, saveLastLocation, loadLastLocation } from '/capacitor-native.js';

  // ── Inicialização ──
  document.addEventListener('DOMContentLoaded', async () => {

    // 1. Inicia PWA (SW + install + rede)
    await initPWA();

    // 2. Inicia Capacitor (só em nativo)
    await initCapacitor();

    // 3. Injeta estilos do histórico
    injectHistoryStyles();

    // 4. Expõe estado meteorológico ao history.js
    setWeatherStateGetter(() => ({
      temp:      window._weatherState?.temp,
      humidity:  window._weatherState?.humid,
      wind:      window._weatherState?.wind,
      gust:      window._weatherState?.gust,
      windDir:   window._weatherState?.windDir,
      deltaT:    window._weatherState?.dt,
      rainProb:  window._weatherState?.rainProb,
      cloud:     window._weatherState?.cloud,
      uv:        window._weatherState?.uv,
      pressure:  window._weatherState?.press,
      condition: window._weatherState?.cond,
      appScore:  window._weatherState?.appScore,
    }));

    // 5. Recupera última localização
    const lastLoc = await loadLastLocation();
    if (lastLoc && (Date.now() - lastLoc.savedAt) < 86400000) { // 24h
      // Auto-carrega última localização
      // fetchWeather(lastLoc.lat, lastLoc.lon, lastLoc.name);
    }

    // 6. Escuta eventos PWA
    window.addEventListener('agrometrix:network', e => {
      if (e.detail.online) renderHistoryPanel();
    });

    window.addEventListener('agrometrix:app-active', () => {
      // App voltou ao foreground — refresca se > 10 min
      const lastUpdate = parseInt(localStorage.getItem('agrometrix-last-update') || '0');
      if (Date.now() - lastUpdate > 600000) {
        // window.reloadWeather?.();
      }
    });
  });

  // ── Salva estado meteorológico após fetchWeather ──
  // Adicione no final do seu fetchWeather():
  //
  //   window._weatherState = { temp, humid, wind, gust, windDir, dt, rainProb, cloud, uv, press, cond };
  //   localStorage.setItem('agrometrix-last-update', Date.now().toString());
  //   await cacheWeather(lat, lon, fullData);
  //   await saveLastLocation(lat, lon, locName);
  //   await renderHistoryPanel();
</script>
```

---

## 2. Gerar Ícones

```bash
npm install
node scripts/generate-icons.js
```

Ícones gerados em `/icons/`. Para personalizar, edite o SVG dentro de `generate-icons.js`.

---

## 3. Setup Capacitor

```bash
# 1. Instalar dependências
npm install

# 2. Inicializar Capacitor (já configurado)
npx cap init AgroMetrix com.agrometrix.app --web-dir .

# 3. Adicionar plataformas
npx cap add android
npx cap add ios      # (apenas em macOS)

# 4. Sincronizar arquivos web
npx cap sync

# 5. Abrir no Android Studio
npx cap open android

# 6. Abrir no Xcode (macOS)
npx cap open ios
```

---

## 4. Permissões Android

O arquivo `android/app/src/main/AndroidManifest.xml` deve conter:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
```

---

## 5. Configurar Splash Screen Android

Em `android/app/src/main/res/`:
- Coloque `splash.png` (2732x2732) em cada pasta `drawable-*/`
- Ou use o Android 12 Splash Screen API no `styles.xml`

```xml
<!-- android/app/src/main/res/values/styles.xml -->
<style name="AppTheme.NoActionBarLaunch" parent="AppTheme.NoActionBar">
    <item name="android:background">@drawable/splash</item>
    <item name="android:windowSplashScreenBackground">#0d2b1a</item>
    <item name="android:windowSplashScreenAnimatedIcon">@drawable/ic_launcher_foreground</item>
    <item name="android:windowSplashScreenIconBackgroundColor">#1f5534</item>
</style>
```

---

## 6. Build de Release Android

```bash
# No Android Studio: Build → Generate Signed Bundle / APK
# Ou via linha de comando:

cd android
./gradlew assembleRelease

# Assinar APK:
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
  -keystore release.keystore \
  app/build/outputs/apk/release/app-release-unsigned.apk \
  agrometrix

zipalign -v 4 \
  app/build/outputs/apk/release/app-release-unsigned.apk \
  agrometrix-release.apk

# Ou use Android App Bundle (recomendado para Play Store):
./gradlew bundleRelease
```

---

## 7. Publicar na Play Store

### Pré-requisitos:
- Conta Google Play Console (USD 25 taxa única)
- APK/AAB assinado
- Ícone 512x512 PNG
- Screenshots: 2-8 por form factor
- Política de privacidade (URL pública)

### Listagem:
```
Título:       AgroMetrix — Clima Agrícola
Categoria:    Ferramentas / Produtividade
Curta desc.:  Clima em tempo real para aplicação de defensivos e fertilizantes
```

### Descrição longa (pt-BR):
```
AgroMetrix é o aplicativo meteorológico desenvolvido especialmente para
o produtor rural e técnico agrícola brasileiro.

✅ FUNCIONALIDADES PRINCIPAIS:
• Clima em tempo real com 7 dias de previsão
• Cálculo automático do Delta T (índice de evaporação)
• Índice de aplicação para fungicidas, herbicidas, inseticidas e adubo foliar
• GPS de alta precisão
• Histórico de operações de campo
• Relatórios profissionais em PDF e CSV
• Funciona offline com dados em cache
• Índice geomagnético Kp (NOAA) para operações de precisão

📊 DELTA T — A MÉTRICA MAIS IMPORTANTE:
O Delta T mede a diferença entre temperatura bulbo seco e bulbo úmido.
Valores entre 2°C e 8°C indicam condição IDEAL para pulverização.

🔒 PRIVACIDADE:
Todos os dados ficam no seu dispositivo. Nenhuma informação é enviada
para servidores externos.

Dados meteorológicos: Open-Meteo (open source, sem chave de API)
```

---

## 8. Configurar VAPID para Push (opcional)

```bash
# Instalar web-push
npm install -g web-push

# Gerar chaves VAPID
web-push generate-vapid-keys

# Saída:
# Public Key: BEl62iUYgUivxIkv...  ← usar em pwa.js
# Private Key: ...                  ← usar no servidor

# Substituir em pwa.js:
# const VAPID_PUBLIC = 'SUA_CHAVE_PUBLICA_AQUI';
```

---

## 9. Checklist de Publicação PWA

- [ ] `manifest.json` com todos os ícones
- [ ] Service Worker registrado e funcionando
- [ ] HTTPS ativo (obrigatório para PWA)
- [ ] Lighthouse score > 90 em PWA
- [ ] Tela offline personalizada
- [ ] Botão de instalação aparece no mobile
- [ ] `meta theme-color` definido
- [ ] Apple touch icons configurados

---

## 10. Deploy Vercel (já existente)

```bash
# O projeto já está em: https://agrometrix-one.vercel.app/

# Para atualizar, basta fazer push no repositório conectado
# Ou deploy manual:
npx vercel --prod

# Configurar headers no vercel.json:
```

```json
{
  "headers": [
    {
      "source": "/sw.js",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" },
        { "key": "Service-Worker-Allowed", "value": "/" }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" }
      ]
    }
  ]
}
```

---

## Suporte e Contato

📧 Para dúvidas de implementação, acesse a documentação do Capacitor:
https://capacitorjs.com/docs

📱 PWA Builder (Microsoft) — gera APK a partir do PWA:
https://www.pwabuilder.com/

🔧 Lighthouse — auditoria PWA:
`chrome://inspect` → Lighthouse tab
