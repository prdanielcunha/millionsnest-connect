import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('public/connect-auth.js', 'utf8');
const executable = source.replace(/^import\s*\{[^}]+\}\s*from\s*'[^']+';\s*/gm, '');
assert.doesNotMatch(executable, /^import\s/m, 'all static Firebase SDK imports must be mocked');

function harness({ signedIn = false, popupError = '', transientConfigFailure = false } = {}) {
  const user = { uid: 'ceo-test-uid', getIdToken: async () => 'firebase-id-token' };
  const auth = { currentUser: signedIn ? user : null };
  const nav = { reloads: 0, redirects: [] };
  let fetches = 0;
  let popupCalls = 0;
  const context = {
    initializeApp: () => ({ name: '[DEFAULT]' }),
    getApps: () => [],
    getAuth: () => auth,
    browserLocalPersistence: {},
    setPersistence: async () => {},
    GoogleAuthProvider: class { setCustomParameters(params) { this.parameters = params; } },
    signInWithPopup: async () => {
      popupCalls++;
      if (popupError) throw Object.assign(new Error('simulated OAuth failure'), { code: popupError });
      auth.currentUser = user;
    },
    onAuthStateChanged: (_auth, callback) => {
      queueMicrotask(() => callback(auth.currentUser));
      return () => {};
    },
    signOut: async () => { auth.currentUser = null; },
    initializeAppCheck: () => ({}),
    ReCaptchaEnterpriseProvider: class {},
    readAppCheckToken: async () => ({ token: 'app-check-token' }),
    fetch: async () => {
      fetches++;
      if (transientConfigFailure && fetches === 1) throw new Error('temporary network outage');
      return { ok: true, json: async () => ({ apiKey: 'public-key', projectId: 'millionsnest' }) };
    },
    window: {
      setTimeout,
      clearTimeout,
      location: {
        reload: () => { nav.reloads++; },
        assign: (url) => { nav.redirects.push(url); },
      },
    },
  };
  vm.runInNewContext(executable, context, { filename: 'public/connect-auth.js' });
  return {
    bridge: context.window.ConnectFirebaseAuth,
    auth, nav,
    get fetches() { return fetches; },
    get popupCalls() { return popupCalls; },
  };
}

{
  const test = harness({ signedIn: true });
  const restored = await test.bridge.restore();
  assert.equal(restored.uid, 'ceo-test-uid', 'existing popup identity persists after reload');
  assert.equal(restored.idToken, 'firebase-id-token', 'restoration provides Firebase ID token');
}
{
  const test = harness();
  assert.equal(await test.bridge.restore(), null, 'signed-out users see the login screen');
  await test.bridge.signInGoogle();
  assert.equal(test.popupCalls, 1, 'Google sign-in uses popup');
  assert.equal(test.nav.reloads, 1, 'successful login restarts Hub canonical context validation');
  assert.equal(test.nav.redirects.length, 0, 'successful Google sign-in does not redirect to Hub');
  assert.equal((await test.bridge.restore()).uid, 'ceo-test-uid', 'popup identity remains accessible');
}
for (const code of ['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment']) {
  const test = harness({ popupError: code });
  await test.bridge.signInGoogle();
  assert.equal(test.nav.redirects[0], 'https://www.millionsnest.com/connect/launch', `${code} uses canonical Hub SSO`);
  assert.equal(test.nav.reloads, 0, 'blocked popups do not loop through reload');
}
{
  const test = harness({ popupError: 'auth/user-disabled' });
  await assert.rejects(test.bridge.signInGoogle(), /simulated OAuth failure/, 'unexpected auth errors are not hidden');
  assert.equal(test.nav.redirects.length, 0, 'real auth denials do not bypass Hub policies');
}
{
  const test = harness({ signedIn: true, transientConfigFailure: true });
  await new Promise((resolve) => setImmediate(resolve));
  const restored = await test.bridge.restore();
  assert.equal(restored.uid, 'ceo-test-uid', 'transient Firebase config failure can recover');
  assert.ok(test.fetches >= 2, 'Firebase config is retried after a failed warm-up');
}
assert.doesNotMatch(source, /getRedirectResult|signInWithRedirect/, 'Safari restore never uses third-party redirect storage');
console.log('Connect Safari Google auth bridge behavioral tests: OK');
