// ═══════════════════════════════════════════════════════════════
// AgroMetrix Radar — auth.js (Versão Corrigida - Redirect Flow)
// ═══════════════════════════════════════════════════════════════

import { firebaseConfig } from './firebase-config.js';

let _auth = null;
let _db = null;

export async function initFirebase() {
  const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
  const { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence }
    = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
  const { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp }
    = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  _auth = getAuth(app);
  _db = getFirestore(app);

  // Garante persistência LOCAL (indexedDB) que é mais estável que SESSION em WebViews
  try {
    await setPersistence(_auth, browserLocalPersistence);
    console.log('[Auth] Persistência configurada para LOCAL');
  } catch (e) {
    console.warn('[Auth] Erro ao configurar persistência:', e);
  }

  // 1. IMPLEMENTAR getRedirectResult E 4. LOGS
  console.log('[Auth] 1/4 - Inicializando Firebase. Verificando resultado de redirect...');

  getRedirectResult(_auth)
    .then(async (result) => {
      if (result) {
        console.log('[Auth] 2/4 - Redirect retornado com sucesso! Usuário:', result.user.email);
        await ensureProfile(result.user);

        // Somente redireciona para index se estivermos na página de handler do Firebase
        // ou se explicitamente solicitado via URL, preservando a permanência em radar.html
        if (window.location.href.includes('__/auth/handler') || window.location.search.includes('apiKey')) {
          console.log('[Auth] Redirecionando para Dashboard...');
          window.location.href = "../index.html";
        }
      } else {
        // Se não há resultado de redirect, verifica se o usuário já está logado
        if (_auth.currentUser) {
            console.log('[Auth] Usuário já persistido:', _auth.currentUser.email);
            if (window.location.href.includes('__/auth/handler')) {
                window.location.href = "../index.html";
            }
        } else {
            console.log('[Auth] - Nenhum redirect pendente ou usuário logado.');
            if (window.location.href.includes('__/auth/handler')) {
               console.warn('[Auth] Preso no handler sem resultado. Forçando saída...');
               window.location.href = "../index.html";
            }
        }
      }
    })
    .catch((error) => {
      console.error('[Auth] Erro crítico no retorno do redirect:', error.code, error.message);
      if (window.location.href.includes('auth/handler')) {
          window.location.href = "../index.html";
      }
    });

  window._firebaseAuth = _auth;
  window._firebaseDB = _db;
  window._fsDoc = doc;
  window._fsGetDoc = getDoc;
  window._fsSetDoc = setDoc;
  window._fsUpdateDoc = updateDoc;
  window._fsTimestamp = serverTimestamp;
  window._GoogleProvider = GoogleAuthProvider;
  window._signInWithPopup = signInWithPopup;
  window._signInWithRedirect = signInWithRedirect;
  window._getRedirectResult = getRedirectResult;
  window._signOut = signOut;
  window._onAuthStateChanged = onAuthStateChanged;

  console.log('[Auth] 4/4 - Handlers registrados e prontos.');
  return { auth: _auth, db: _db };
}

export async function loginGoogle() {
  try {
    const provider = new window._GoogleProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });

    console.log('[Auth] Iniciando Login Google...');

    // No Capacitor Android, usamos Popup Flow interno via WebChromeClient configurado na MainActivity
    const isNative = window.location.hostname === "localhost" || window.location.hostname === "agrometrix.radar";

    if (isNative) {
      console.log('[Auth] Usando Popup flow interno para Capacitor');
      try {
        const result = await window._signInWithPopup(window._firebaseAuth, provider);
        if (result.user) {
          await ensureProfile(result.user);
          return result.user;
        }
      } catch (popupErr) {
        console.warn('[Auth] Erro no popup nativo, tentando redirect...', popupErr);
      }
    }

    // Fallback para Redirect flow (Web ou se o Popup falhar)
    console.log('[Auth] Usando Redirect flow');
    await window._signInWithRedirect(window._firebaseAuth, provider);
    return null;
  } catch (err) {
    console.error('[Auth] Falha ao iniciar fluxo de login:', err);
    // Fallback agressivo se o redirect falhar ou for bloqueado
    try {
       const result = await window._signInWithPopup(window._firebaseAuth, new window._GoogleProvider());
       return result.user;
    } catch(e) {
       return null;
    }
  }
}

export async function logout() {
  await window._signOut(window._firebaseAuth);
  window.AgroRadar.currentUser = null;
  window.location.reload();
}

export function onAuthChange(callback) {
  if (!window._onAuthStateChanged) return;
  window._onAuthStateChanged(window._firebaseAuth, async user => {
    if (user) {
      console.log('[Auth] Usuário logado detectado:', user.email);
      // BUG FIX: Usar ensureProfile em vez de getProfile para garantir criação do documento
      const profile = await ensureProfile(user);
      callback(user, profile);
    } else {
      console.log('[Auth] Estado: Deslogado');
      callback(null, null);
    }
  });
}

export async function ensureProfile(user) {
  const db = window._firebaseDB;
  const ref = window._fsDoc(db, 'pilots', user.uid);
  const snap = await window._fsGetDoc(ref);

  if (!snap.exists()) {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 7);

    await window._fsSetDoc(ref, {
      uid: user.uid,
      name: user.displayName || 'Piloto',
      photo: user.photoURL || null,
      email: user.email,
      city: '',
      drone: '',
      status: 'online',
      amxScore: 0,
      hoursTotal: 0,
      opsTotal: 0,
      plan: 'trial',
      trialEnd: trialEnd.toISOString(),
      paidUntil: null,
      visibility: 'online',
      lat: null,
      lon: null,
      lastSeen: window._fsTimestamp(),
      createdAt: window._fsTimestamp(),
    });
    return await getProfile(user.uid);
  }
  return snap.data();
}

export async function getProfile(uid) {
  const db = window._firebaseDB;
  const ref = window._fsDoc(db, 'pilots', uid);
  const snap = await window._fsGetDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function updateProfile(uid, data) {
  const db = window._firebaseDB;
  const ref = window._fsDoc(db, 'pilots', uid);
  await window._fsUpdateDoc(ref, { ...data, updatedAt: window._fsTimestamp() });
}

export function getPlanStatus(profile) {
  if (!profile) return { active: false, plan: null, daysLeft: 0 };

  if (profile.plan === 'paid') {
    if (!profile.paidUntil) return { active: true, plan: 'paid', daysLeft: 999 };
    const diff = new Date(profile.paidUntil) - new Date();
    const days = Math.ceil(diff / 86400000);
    return { active: days > 0, plan: 'paid', daysLeft: Math.max(0, days) };
  }

  if (profile.plan === 'trial') {
    const diff = new Date(profile.trialEnd) - new Date();
    const days = Math.ceil(diff / 86400000);
    return { active: days > 0, plan: 'trial', daysLeft: Math.max(0, days) };
  }

  return { active: false, plan: 'expired', daysLeft: 0 };
}
