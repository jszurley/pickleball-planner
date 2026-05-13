// Web Push subscription helper. Safe to call from anywhere — every check
// short-circuits if the platform or backend can't support push.

import { getPushPublicKey, savePushSubscription } from './api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

export async function ensurePushSubscription({ promptIfDefault = true } = {}) {
  if (typeof window === 'undefined') return { ok: false, reason: 'no-window' };
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, reason: 'unsupported' };
  }

  // Fetch the VAPID public key from the server (also tells us whether push is configured)
  let publicKey = null;
  try {
    const r = await getPushPublicKey();
    publicKey = r.data.publicKey;
  } catch (_) {
    return { ok: false, reason: 'no-key' };
  }
  if (!publicKey) return { ok: false, reason: 'no-key' };

  // Permission handling
  let perm = Notification.permission;
  if (perm === 'default') {
    if (!promptIfDefault) return { ok: false, reason: 'permission-default' };
    try {
      perm = await Notification.requestPermission();
    } catch (_) {
      return { ok: false, reason: 'permission-error' };
    }
  }
  if (perm !== 'granted') return { ok: false, reason: 'permission-denied' };

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
  }

  try {
    await savePushSubscription(sub.toJSON ? sub.toJSON() : sub);
    return { ok: true, subscription: sub };
  } catch (err) {
    return { ok: false, reason: 'save-failed', error: err };
  }
}
