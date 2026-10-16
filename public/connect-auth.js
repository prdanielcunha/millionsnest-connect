import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js';
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  getToken as readAppCheckToken,
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-app-check.js';

let authPromise = null;
let appCheckPromise = null;
const APPCHECK_SITE_KEY = '6LcpY-EtAAAAAElqBbIL_K7nAkm2wpuF6fbhsggG';

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
  try {
    return await authPromise;
  } catch (error) {
    // Transient startup failures must not poison all later sign-in attempts.
    authPromise = null;
    throw error;
  }
}

// Warm auth configuration before the login button is tapped. Safari may block
// a popup if the click's user activation expires while Firebase initializes.
void getConnectAuth().catch(() => {});

async function getAppCheckToken() {
  if (!appCheckPromise) {
    appCheckPromise = (async () => {
      const config = await getConfig();
      const app = getApps().find((candidate) => candidate.name === '[DEFAULT]') || initializeApp(config);
      return initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(APPCHECK_SITE_KEY),
        isTokenAutoRefreshEnabled: true,
      });
    })();
  }
  const appCheck = await appCheckPromise;
  return (await readAppCheckToken(appCheck, false)).token;
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
  // The direct Google flow now uses popup authentication. Reading a redirect
  // result on every page load can reintroduce Safari cross-origin storage
  // failures even after a successful popup login.
  const user = auth.currentUser || await waitForUser(auth);
  if (!user) return null;
  return { uid: user.uid, idToken: await user.getIdToken(true) };
}

async function signInGoogle() {
  const auth = await getConnectAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  // Redirect-based Firebase OAuth can lose its cross-origin auth state on
  // Safari/iOS when Connect runs on a custom Hosting domain. Keep Google sign-in
  // on this origin, then re-bootstrap through the canonical Hub session API.
  try {
    await signInWithPopup(auth, provider);
    window.location.reload();
  } catch (error) {
    // Popup support varies across browsers and embedded web views. In those
    // environments, use the existing, Hub-owned SSO flow instead of returning
    // to a Firebase redirect flow that may lose state again.
    if (
      error?.code === 'auth/popup-blocked' ||
      error?.code === 'auth/operation-not-supported-in-this-environment'
    ) {
      window.location.assign('https://www.millionsnest.com/connect/launch');
      return;
    }
    throw error;
  }
}

async function signOutConnect() {
  const auth = await getConnectAuth();
  await signOut(auth);
}

window.ConnectFirebaseAuth = Object.freeze({
  restore,
  signInGoogle,
  signOut: signOutConnect,
  getAppCheckToken,
});
