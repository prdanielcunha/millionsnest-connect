import type { LiveConnectSession } from './liveConnectSession';

export type PushDeviceView = { id: string; enabled: boolean; expiresAt: string; quietStart: number; quietEnd: number; timeZone: string };
export function pushSupported(): boolean {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined' && window.isSecureContext && 'serviceWorker' in navigator &&
    'PushManager' in window && 'Notification' in window;
}
export function pushNeedsHomeScreen(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.matchMedia('(display-mode: standalone)').matches &&
    !(navigator as Navigator & { standalone?: boolean }).standalone;
}
export function readInboxPushLink(href: string): { organizationId: string; conversationId: string } | null {
  const url = new URL(href);
  const organizationId = url.searchParams.get('organizationId'), conversationId = url.searchParams.get('conversationId');
  if (url.pathname !== '/inbox' || !organizationId || !conversationId ||
      [organizationId, conversationId].some(v => v.length > 180 || /[\\/\u0000-\u001f]/.test(v))) return null;
  return { organizationId, conversationId };
}
export async function unsubscribeLocalPush(): Promise<void> {
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription && !await subscription.unsubscribe()) throw new Error('PUSH_UNSUBSCRIBE_FAILED');
}
export class ConnectPushClient {
  constructor(private readonly session: LiveConnectSession) {}
  private async request(method: string, body?: unknown, id = '') {
    const query = method === 'GET' ? `?organizationId=${encodeURIComponent(this.session.expectedOrganizationId)}` : '';
    const response = await fetch(`/api/core/inbox/push${id ? '/' + encodeURIComponent(id) : ''}${query}`, {
      method, cache: 'no-store', headers: { Authorization: `Bearer ${this.session.idToken}`, 'Content-Type': 'application/json' },
      ...(method !== 'GET' ? { body: JSON.stringify({ organizationId: this.session.expectedOrganizationId, ...(body as object || {}) }) } : {}),
    });
    if (!response.ok) throw new Error(response.status === 404 ? 'PUSH_DISABLED' : 'PUSH_REQUEST_FAILED');
    return response.status === 204 ? null : response.json();
  }
  async status(): Promise<{ publicKey: string; devices: PushDeviceView[] }> { return this.request('GET'); }
  /** Call only from a click, with key preloaded; permission request precedes all awaited work. */
  async enable(publicKey: string, quietStart: number, quietEnd: number): Promise<void> {
    if (!pushSupported()) throw new Error('PUSH_UNSUPPORTED');
    if (pushNeedsHomeScreen()) throw new Error('PUSH_HOME_SCREEN_REQUIRED');
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('PUSH_PERMISSION_DENIED');
    const registration = await navigator.serviceWorker.register('/connect-push-sw.js', { scope: '/', updateViaCache: 'none' });
    await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    const bytes = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    if (subscription) {
      const previous = subscription.options.applicationServerKey;
      if (previous && (new Uint8Array(previous).length !== bytes.length || new Uint8Array(previous).some((b, i) => b !== bytes[i]))) {
        if (!await subscription.unsubscribe()) throw new Error('PUSH_UNSUBSCRIBE_FAILED');
        subscription = null;
      }
    }
    subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
    try {
      await this.request('POST', { subscription: subscription.toJSON(), enabled: true, quietStart, quietEnd,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    } catch (error) {
      // An orphan subscription must never keep notifying after failed registration/tenant switch.
      await subscription.unsubscribe();
      throw error;
    }
  }
  async revoke(id: string): Promise<void> {
    if (pushSupported()) {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([subscription.endpoint])));
        const localId = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
        if (localId === id) await unsubscribeLocalPush();
      }
    }
    await this.request('DELETE', {}, id);
  }
  async disableThisDevice(): Promise<void> {
    if (!pushSupported()) return;
    const registration = await navigator.serviceWorker.getRegistration('/');
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([subscription.endpoint])));
    const id = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    await unsubscribeLocalPush();
    await this.revoke(id);
  }
}
