#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  AgroMetrix — generate-icons.js
//  Gera ícones PNG profissionais para PWA/Capacitor
//  Requer: npm install sharp
// ═══════════════════════════════════════════════════════════════
//
//  USO: node scripts/generate-icons.js
//
//  Gera todos os tamanhos necessários a partir do SVG master.
//  Coloca os ícones em /icons/ prontos para manifest.json
// ═══════════════════════════════════════════════════════════════

const fs   = require('fs');
const path = require('path');

let sharp;
try { sharp = require('sharp'); }
catch { console.error('❌ sharp não instalado. Execute: npm install sharp'); process.exit(1); }

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const ICON_DIR = path.join(__dirname, '..', 'icons');

if (!fs.existsSync(ICON_DIR)) fs.mkdirSync(ICON_DIR, { recursive: true });

// SVG master do ícone AgroMetrix
const ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <!-- Fundo com safe zone maskable -->
  <rect width="512" height="512" fill="#0d2b1a" rx="96"/>

  <!-- Círculo decorativo -->
  <circle cx="256" cy="256" r="180" fill="none" stroke="#1f5534" stroke-width="3" opacity="0.5"/>
  <circle cx="256" cy="256" r="150" fill="none" stroke="#286b42" stroke-width="1.5" opacity="0.3"/>

  <!-- Folha central -->
  <path d="M256 120 C256 120 340 180 340 270 C340 316 302 350 256 350 C210 350 172 316 172 270 C172 180 256 120 256 120Z"
        fill="#2f8450"/>
  <path d="M256 120 C256 120 340 180 340 270 C340 316 302 350 256 350 L256 120Z"
        fill="#3da866" opacity="0.6"/>

  <!-- Nervura central -->
  <path d="M256 350 L256 190" stroke="#5ec880" stroke-width="3" stroke-linecap="round" opacity="0.7"/>

  <!-- Nervuras laterais -->
  <path d="M256 240 C256 240 290 220 310 200" stroke="#5ec880" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
  <path d="M256 270 C256 270 285 255 300 240" stroke="#5ec880" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
  <path d="M256 240 C256 240 222 220 202 200" stroke="#5ec880" stroke-width="2" stroke-linecap="round" opacity="0.5"/>

  <!-- Gota (símbolo meteorológico) -->
  <path d="M256 380 C256 380 228 360 228 342 C228 327 241 316 256 316 C271 316 284 327 284 342 C284 360 256 380 256 380Z"
        fill="#1e88d0" opacity="0.9"/>

  <!-- Letras AM (monograma) -->
  <text x="256" y="460" font-family="Arial Black, sans-serif" font-size="38" font-weight="900"
        fill="#5ec880" text-anchor="middle" opacity="0.7" letter-spacing="4">AM</text>
</svg>
`;

const SPLASH_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2732 2732">
  <rect width="2732" height="2732" fill="#0d2b1a"/>
  <circle cx="1366" cy="1100" r="320" fill="none" stroke="#1f5534" stroke-width="4" opacity="0.4"/>
  <path d="M1366 800 C1366 800 1600 960 1600 1140 C1600 1260 1490 1360 1366 1360 C1242 1360 1132 1260 1132 1140 C1132 960 1366 800 1366 800Z"
        fill="#2f8450"/>
  <path d="M1366 800 C1366 800 1600 960 1600 1140 C1600 1260 1490 1360 1366 1360 L1366 800Z"
        fill="#3da866" opacity="0.6"/>
  <path d="M1366 1360 L1366 900" stroke="#5ec880" stroke-width="5" stroke-linecap="round" opacity="0.7"/>
  <path d="M1366 1460 C1366 1460 1286 1400 1286 1350 C1286 1308 1323 1280 1366 1280 C1409 1280 1446 1308 1446 1350 C1446 1400 1366 1460 1366 1460Z"
        fill="#1e88d0" opacity="0.85"/>
  <text x="1366" y="1620" font-family="Arial Black, sans-serif" font-size="120" font-weight="900"
        fill="white" text-anchor="middle" letter-spacing="-3">AgroMetrix</text>
  <text x="1366" y="1700" font-family="Arial, sans-serif" font-size="52"
        fill="#5ec880" text-anchor="middle" opacity="0.7">Clima certo, aplicação perfeita</text>
</svg>
`;

async function generateIcons() {
  console.log('🎨 Gerando ícones AgroMetrix...\n');

  const svgBuffer = Buffer.from(ICON_SVG);

  for (const size of SIZES) {
    const outPath = path.join(ICON_DIR, `icon-${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(outPath);
    console.log(`  ✓ icon-${size}.png`);
  }

  // Ícone Apple Touch
  await sharp(Buffer.from(ICON_SVG))
    .resize(180, 180)
    .png({ quality: 100 })
    .toFile(path.join(ICON_DIR, 'apple-touch-icon.png'));
  console.log('  ✓ apple-touch-icon.png (180x180)');

  // Favicon
  await sharp(Buffer.from(ICON_SVG))
    .resize(32, 32)
    .png({ quality: 100 })
    .toFile(path.join(ICON_DIR, 'favicon-32.png'));
  console.log('  ✓ favicon-32.png');

  // Splash screen
  const splashBuffer = Buffer.from(SPLASH_SVG);
  const splashSizes = [
    { w: 2732, h: 2732, name: 'splash-2732.png' },
    { w: 1284, h: 2778, name: 'splash-ios-portrait.png' },
    { w: 1125, h: 2436, name: 'splash-iphone-x.png' },
  ];
  for (const { w, h, name } of splashSizes) {
    await sharp(splashBuffer)
      .resize(w, h, { fit: 'contain', background: '#0d2b1a' })
      .png({ quality: 95 })
      .toFile(path.join(ICON_DIR, '..', 'screenshots', name));
    console.log(`  ✓ screenshots/${name}`);
  }

  console.log('\n✅ Todos os ícones gerados em /icons/');
}

generateIcons().catch(err => {
  console.error('Erro ao gerar ícones:', err);
  process.exit(1);
});
