export const firebaseConfig = {
  apiKey:            "AIzaSyCKLsuxwP9KIi51-h1FJuvQFjI0kdnTvio",
  authDomain:        "agrometrix-radar.firebaseapp.com",
  projectId:         "agrometrix-radar",
  storageBucket:     "agrometrix-radar.firebasestorage.app",
  messagingSenderId: "65595075086",
  appId:             "1:65595075086:web:1e78e9e5529cb7022caa5f",
  measurementId:     "G-JNLFZ10WQ9"
};

export function isFirebaseConfigured() {
  return !firebaseConfig.apiKey.includes('COLE_AQUI');
}
