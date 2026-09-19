export type ConnectDirectIdentity = {
  uid: string;
  idToken: string;
};

type ConnectFirebaseAuthBridge = {
  restore(): Promise<ConnectDirectIdentity | null>;
  signInGoogle(): Promise<void>;
  signOut(): Promise<void>;
};

declare global {
  interface Window {
    ConnectFirebaseAuth?: ConnectFirebaseAuthBridge;
  }
}

async function bridge(timeoutMs = 12_000): Promise<ConnectFirebaseAuthBridge> {
  const startedAt = Date.now();
  while (!window.ConnectFirebaseAuth) {
    if (Date.now() - startedAt >= timeoutMs) throw new Error('FIREBASE_CONFIG_UNAVAILABLE');
    await new Promise((resolve) => window.setTimeout(resolve, 25));
  }
  return window.ConnectFirebaseAuth;
}

export async function restoreConnectDirectIdentity(): Promise<ConnectDirectIdentity | null> {
  return (await bridge()).restore();
}

export async function startConnectGoogleSignIn(): Promise<void> {
  await (await bridge()).signInGoogle();
}

export async function signOutConnectDirectIdentity(): Promise<void> {
  await (await bridge()).signOut();
}
