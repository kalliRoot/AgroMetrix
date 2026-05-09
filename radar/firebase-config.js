// ═══════════════════════════════════════════════════════════════
//  AgroMetrix Radar — firebase-config.js
//  ⚠️  SUBSTITUA AS LINHAS ABAIXO COM SEUS DADOS DO FIREBASE
//  Firebase Console → Configurações → Seus apps → SDK config
// ═══════════════════════════════════════════════════════════════

export const firebaseConfig = {
  apiKey:            "COLE_AQUI_SUA_API_KEY",
  authDomain:        "COLE_AQUI.firebaseapp.com",
  projectId:         "COLE_AQUI_PROJECT_ID",
  storageBucket:     "COLE_AQUI.appspot.com",
  messagingSenderId: "COLE_AQUI_SENDER_ID",
  appId:             "COLE_AQUI_APP_ID"
};

// ── Verificação ───────────────────────────────────────────────
export function isFirebaseConfigured() {
  return !firebaseConfig.apiKey.includes('COLE_AQUI');
}
