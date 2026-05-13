// Web Push fan-out via the web-push library.
// Safe-by-default: if VAPID keys aren't configured, every send becomes a no-op
// (logged at most once at startup).

const pool = require('../config/db');

let webpush = null;
let configured = false;
try {
  webpush = require('web-push');
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:itsforme@itsforme.app',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    configured = true;
    console.log('Web Push configured');
  } else {
    console.log('Web Push: VAPID keys not set — push notifications disabled');
  }
} catch (err) {
  console.log('Web Push: web-push package not installed — push notifications disabled');
}

const pushService = {
  isConfigured() {
    return configured;
  },

  async sendToUser(userId, payload) {
    if (!configured) return false;
    const result = await pool.query('SELECT push_subscription FROM users WHERE id = $1', [userId]);
    const sub = result.rows[0] && result.rows[0].push_subscription;
    if (!sub) return false;
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload));
      return true;
    } catch (err) {
      // 404/410: subscription is dead — clear it
      if (err.statusCode === 404 || err.statusCode === 410) {
        await pool.query('UPDATE users SET push_subscription = NULL WHERE id = $1', [userId]).catch(() => {});
      } else {
        console.error('push send failed:', err.message);
      }
      return false;
    }
  },

  // Send "X started a pulse" push to a recipient list (rows must have id + push_subscription)
  async sendPulseStarted(pulse, recipients, creatorName) {
    if (!configured) return 0;
    const title = `${creatorName || 'Someone'} started a pulse`;
    const when = `${pulse.pulse_date} at ${(pulse.start_time || '').slice(0, 5)}`;
    const body = `Who's playing? ${when}`;
    const payload = { title, body, url: '/', pulseId: pulse.id };
    let sent = 0;
    await Promise.all(recipients.map(async (r) => {
      if (!r.push_subscription) return;
      try {
        await webpush.sendNotification(r.push_subscription, JSON.stringify(payload));
        sent++;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await pool.query('UPDATE users SET push_subscription = NULL WHERE id = $1', [r.id]).catch(() => {});
        }
      }
    }));
    return sent;
  }
};

module.exports = pushService;
