// ═══════════════════════════════════════════════════════════════
// Firebase Config - AgroMetrix Radar
// ═══════════════════════════════════════════════════════════════

export const firebaseConfig = {
  apiKey: "AIzaSyCKLsuxwP9KIi51-h1FJuvQFjI0kdnTvio",
  authDomain: "agrometrix-radar.firebaseapp.com",
  projectId: "agrometrix-radar",
  storageBucket: "agrometrix-radar.firebasestorage.app",
  messagingSenderId: "65595075086",
  appId: "1:65595075086:web:1e78e9e5529cb7022caa5f",
  measurementId: "G-JNLFZ10WQ9"
};

export function isFirebaseConfigured() {
  // Verifica se as credenciais estão presentes
  return firebaseConfig.apiKey && 
         firebaseConfig.apiKey !== "SUA_API_KEY_AQUI" &&
         firebaseConfig.authDomain &&
         firebaseConfig.authDomain !== "SEU_PROJETO.firebaseapp.com";
}
