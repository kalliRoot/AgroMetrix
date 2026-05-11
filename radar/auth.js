// ═══════════════════════════════════════════════════════════════
// AgroMetrix Radar — auth.js
// Login Google · Perfil · Trial · Paywall
// ═══════════════════════════════════════════════════════════════

import { firebaseConfig } from './firebase-config.js';

let _auth = null;
let _db = null;

export async function initFirebase() {
  const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
  const { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
    = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
  const { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, orderBy, onSnapshot, addDoc }
    = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  _auth = getAuth(app);
  _db = getFirestore(app);

  window._firebaseAuth = _auth;
  window._firebaseDB = _db;
  window._fsDoc = doc;
  window._fsGetDoc = getDoc;
  window._fsSetDoc = setDoc;
  window._fsUpdateDoc = updateDoc;
  window._fsTimestamp = serverTimestamp;
  window._fsCollection = collection;
  window._fsQuery = query;
  window._fsWhere = where;
  window._fsOrderBy = orderBy;
  window._fsOnSnapshot = onSnapshot;
  window._fsAddDoc = addDoc;
  window._GoogleProvider = GoogleAuthProvider;
  window._signInWithPopup = signInWithPopup;
  window._signOut = signOut;
  window._onAuthStateChanged = onAuthStateChanged;

  return { auth: _auth, db: _db };
}

export async function loginGoogle() {
  try {
    const provider = new window._GoogleProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await window._signInWithPopup(window._firebaseAuth, provider);
    const user = result.user;
    await ensureProfile(user);
    return user;
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      console.error('[Auth] Login falhou:', err);
    }
    return null;
  }
}

export async function logout() {
  await window._signOut(window._firebaseAuth);
  window.AgroRadar.currentUser = null;
}

export function onAuthChange(callback) {
  if (!window._onAuthStateChanged) return;
  window._onAuthStateChanged(window._firebaseAuth, async user => {
    if (user) {
      const profile = await getProfile(user.uid);
      callback(user, profile);
    } else {
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
