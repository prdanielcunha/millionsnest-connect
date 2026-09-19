import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js';
import {
  browserLocalPersistence,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithRedirect,
  signOut,
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';

let authPromise = null;

async function getConfig() {
  const response = await fetch('/__/firebase/init.json', {
    headers: { Accept: 'application/json', 'Cache-Control': 'no-store' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('FIREBASE_CONFIG_UNAVAILABLE');
  const config = await response.json();
  if (!config?.apiKey || !config?.projectId) throw new Error('FIREBASE_CONFIG_UNAVAILABLE');
  return config;
}

async function getConnectAuth() {
  if (!authPromise) {
    authPromise = (async () => {
      const config = await getConfig();
      const app = getApps().find((candidate) => candidate.name === '[DEFAULT]') || initializeApp(config);
      const auth = getAuth(app);
      await setPersistence(auth, browserLocalPersistence);
      return auth;
    })();
  }
  return authPromise;
}

function waitForUser(auth) {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      unsubscribe();
      reject(new Error('AUTH_STATE_TIMEOUT'));
    }, 12000);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      window.clearTimeout(timeout);
      unsubscribe();
      resolve(user);
    }, (error) => {
      window.clearTimeout(timeout);
      unsubscribe();
      reject(error);
    });
  });
}

async function restore() {
  const auth = await getConnectAuth();
  await getRedirectResult(auth);
  const user = auth.currentUser || await waitForUser(auth);
  if (!user) return null;
  return { uid: user.uid, idToken: await user.getIdToken(true) };
}

async function signInGoogle() {
  const auth = await getConnectAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithRedirect(auth, provider);
}

async function signOutConnect() {
  const auth = await getConnectAuth();
  await signOut(auth);
}

window.ConnectFirebaseAuth = Object.freeze({
  restore,
  signInGoogle,
  signOut: signOutConnect,
});
