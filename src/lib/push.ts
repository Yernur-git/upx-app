/** Client-side Web Push subscription helpers */

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

/** Convert VAPID base64 public key to Uint8Array for PushManager */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** True if browser supports push + SW */
export function supportsPush(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** Returns the current push subscription, or null */
export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!supportsPush()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/**
 * Request permission, subscribe to push, and save the subscription to the server.
 * Returns 'subscribed' | 'denied' | 'error'
 */
export async function subscribeToPush(userId: string): Promise<'subscribed' | 'denied' | 'error'> {
  if (!supportsPush()) return 'error';
  if (!VAPID_PUBLIC_KEY) {
    console.warn('[push] VITE_VAPID_PUBLIC_KEY not set');
    return 'error';
  }

  // Ask for permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      // Cast needed: TS strict buffer types differ from runtime reality
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
    });

    // Save to server
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON(), userId }),
    });

    if (!res.ok) throw new Error(`Server error ${res.status}`);
    return 'subscribed';
  } catch (err) {
    console.error('[push] subscribe failed', err);
    return 'error';
  }
}

/** Unsubscribe from push and notify the server */
export async function unsubscribeFromPush(userId: string): Promise<void> {
  if (!supportsPush()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    // Tell server to remove it
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, userId }),
    });
  } catch (err) {
    console.error('[push] unsubscribe failed', err);
  }
}
