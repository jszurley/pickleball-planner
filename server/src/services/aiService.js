// AI helpers powered by the Anthropic SDK.
// Phase 1: stubs that no-op; Phase 3 wires Claude in.
//
// All functions are designed to be safe-to-call even without an API key:
// they return null / a sensible default and never throw out of the public API.

const HAS_KEY = !!process.env.ANTHROPIC_API_KEY;

let client = null;
function getClient() {
  if (!HAS_KEY) return null;
  if (client) return client;
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    return client;
  } catch (_) {
    return null;
  }
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addMinutes(timeStr, mins) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + mins;
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}

// Local fallback parser used when AI is unavailable or fails.
function localParse(freeText, ctx) {
  if (!freeText) return null;
  const t = freeText.toLowerCase().trim();
  const prefs = ctx.prefs || {};
  const dur = prefs.usual_duration_min || 90;
  const morning = (prefs.usual_morning_start || '08:00').slice(0, 5);
  const evening = (prefs.usual_evening_start || '18:00').slice(0, 5);

  let date = null, startTime = null;
  if (/\btonight\b|\bthis evening\b/.test(t)) {
    date = todayISO();
    startTime = evening;
  } else if (/\btomorrow\b/.test(t)) {
    date = tomorrowISO();
    startTime = /morning/.test(t) ? morning : (/evening|night/.test(t) ? evening : morning);
  } else if (/morning/.test(t)) {
    date = todayISO();
    startTime = morning;
  } else if (/\bevening\b|\bnight\b/.test(t)) {
    date = todayISO();
    startTime = evening;
  }

  // Crude location keyword match against known locations
  let locationId = null;
  if (Array.isArray(ctx.locations)) {
    for (const loc of ctx.locations) {
      const tokens = (loc.name || '').toLowerCase().split(/\s+/).filter(s => s.length >= 2);
      if (tokens.some(tok => t.includes(tok))) {
        locationId = loc.id;
        break;
      }
    }
  }

  if (!date || !startTime) return null;
  return { date, startTime, endTime: addMinutes(startTime, dur), locationId };
}

const aiService = {
  // Parse free text like "tomorrow morning at NRR" into {date, startTime, endTime, locationId}.
  // Returns null if it can't be confidently parsed.
  async parsePulseText(freeText, ctx) {
    const c = getClient();
    if (!c) return localParse(freeText, ctx);

    try {
      const locations = (ctx.locations || []).map(l => ({ id: l.id, name: l.name }));
      const prefs = ctx.prefs || {};
      const sys = `You convert short natural-language pickleball scheduling text into structured JSON.
Today is ${todayISO()}. Tomorrow is ${tomorrowISO()}.
Available locations: ${JSON.stringify(locations)}.
User defaults: usual_morning_start=${prefs.usual_morning_start || '08:00'}, usual_evening_start=${prefs.usual_evening_start || '18:00'}, usual_duration_min=${prefs.usual_duration_min || 90}.
Return ONLY JSON: {"date":"YYYY-MM-DD","startTime":"HH:MM","endTime":"HH:MM","locationId":<number-or-null>}.`;
      const msg = await c.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: [{ type: 'text', text: sys, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: freeText }]
      });
      const text = (msg.content || []).map(b => b.text || '').join('').trim();
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) return localParse(freeText, ctx);
      const parsed = JSON.parse(m[0]);
      if (!parsed.date || !parsed.startTime || !parsed.endTime) return localParse(freeText, ctx);
      return parsed;
    } catch (err) {
      console.error('aiService.parsePulseText failed, falling back:', err.message);
      return localParse(freeText, ctx);
    }
  },

  // Generate a one-line recap for the active pulse card.
  // Cached per-pulse for ~30s to keep cost down on dashboard polling.
  _recapCache: new Map(),
  async recapPulse(pulse, responses, minPlayers) {
    const c = getClient();
    const ins = responses.filter(r => r.status === 'in');
    const inNames = ins.map(r => r.user_name).filter(Boolean);
    const need = Math.max(0, minPlayers - ins.length);
    const fallback = ins.length >= minPlayers
      ? `Game on! ${ins.length} in${inNames.length ? ` — ${inNames.join(', ')}` : ''}.`
      : `${ins.length} in${need ? `, need ${need} more` : ''}${inNames.length ? ` — ${inNames.join(', ')}` : ''}.`;

    if (!c) return fallback;

    const cacheKey = `${pulse.id}:${ins.length}:${minPlayers}`;
    const cached = this._recapCache.get(cacheKey);
    if (cached && Date.now() - cached.t < 30_000) return cached.text;

    try {
      const msg = await c.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 80,
        system: 'Write one short, friendly status line for a pickleball pulse. Under 18 words. No emoji.',
        messages: [{
          role: 'user',
          content: `Pulse: ${pulse.pulse_date} ${pulse.start_time} at ${pulse.location_name || 'TBD'}. ${ins.length} in (${inNames.join(', ') || 'none yet'}). Min players: ${minPlayers}.`
        }]
      });
      const text = (msg.content || []).map(b => b.text || '').join('').trim() || fallback;
      this._recapCache.set(cacheKey, { t: Date.now(), text });
      return text;
    } catch (err) {
      return fallback;
    }
  }
};

module.exports = aiService;
