const express = require('express');
const pool = require('../config/db');
const Pulse = require('../models/Pulse');
const PulseResponse = require('../models/PulseResponse');
const User = require('../models/User');
const Group = require('../models/Group');
const auth = require('../middleware/auth');
const aiService = require('../services/aiService');
const pushService = require('../services/pushService');

const router = express.Router();

// Resolve the effective group for the caller. Priority:
// 1. explicit query/body groupId (validated)
// 2. user.default_group_id
// 3. first group user belongs to
async function resolveGroupForUser(userId, explicitGroupId) {
  if (explicitGroupId) {
    const member = await User.isInGroup(userId, explicitGroupId);
    if (!member) return null;
    return parseInt(explicitGroupId, 10);
  }
  const u = await pool.query('SELECT default_group_id FROM users WHERE id = $1', [userId]);
  if (u.rows[0] && u.rows[0].default_group_id) {
    return u.rows[0].default_group_id;
  }
  const groups = await User.getGroups(userId);
  return groups.length > 0 ? groups[0].id : null;
}

async function buildActivePayload(pulse, callerId) {
  if (!pulse) return null;
  const responses = await PulseResponse.listByPulse(pulse.id);
  const inCount = responses.filter(r => r.status === 'in').length;
  const minPlayers = pulse.min_players || 4;
  const myResponse = responses.find(r => r.user_id === callerId);

  let recap = null;
  try {
    recap = await aiService.recapPulse(pulse, responses, minPlayers);
  } catch (_) {
    recap = null;
  }

  return {
    ...pulse,
    responses,
    in_count: inCount,
    min_players: minPlayers,
    game_on: inCount >= minPlayers,
    my_status: myResponse ? myResponse.status : null,
    recap
  };
}

// GET /api/pulses/active — active pulse for caller's group (default or ?groupId)
router.get('/active', auth, async (req, res) => {
  try {
    const groupId = await resolveGroupForUser(req.user.id, req.query.groupId);
    if (!groupId) return res.json({ pulse: null, group_id: null });

    const pulse = await Pulse.getActiveForGroup(groupId);
    if (!pulse) return res.json({ pulse: null, group_id: groupId });

    const payload = await buildActivePayload(pulse, req.user.id);
    res.json({ pulse: payload, group_id: groupId });
  } catch (error) {
    console.error('Get active pulse error:', error);
    res.status(500).json({ error: 'Failed to get active pulse' });
  }
});

// POST /api/pulses — create new pulse
router.post('/', auth, async (req, res) => {
  try {
    const { freeText } = req.body;
    let { groupId, locationId, date, startTime, endTime } = req.body;

    groupId = await resolveGroupForUser(req.user.id, groupId);
    if (!groupId) return res.status(400).json({ error: 'No group available — join a group first' });

    // Look up user preferences for defaults & AI context
    const prefsResult = await pool.query(
      `SELECT default_location_id, usual_morning_start, usual_evening_start, usual_duration_min
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    const prefs = prefsResult.rows[0] || {};

    // If freeText is provided, ask aiService to parse it (Phase 3); otherwise use structured fields.
    if (freeText && (!date || !startTime)) {
      const locations = await Group.getLocations(groupId);
      const parsed = await aiService.parsePulseText(freeText, { prefs, locations });
      if (parsed) {
        date = date || parsed.date;
        startTime = startTime || parsed.startTime;
        endTime = endTime || parsed.endTime;
        locationId = locationId || parsed.locationId;
      }
    }

    // Fill any remaining gaps from prefs
    if (!locationId && prefs.default_location_id) locationId = prefs.default_location_id;
    if (!startTime) startTime = prefs.usual_evening_start || '18:00';
    if (!date) {
      const now = new Date();
      date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
    if (!endTime) {
      const durationMin = prefs.usual_duration_min || 90;
      const [h, m] = startTime.split(':').map(Number);
      const total = h * 60 + m + durationMin;
      const eh = Math.floor(total / 60) % 24;
      const em = total % 60;
      endTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
    }

    let pulse;
    try {
      pulse = await Pulse.create(groupId, req.user.id, locationId, date, startTime, endTime);
    } catch (err) {
      // Postgres unique_violation = 23505; SQLite throws Error with 'UNIQUE constraint failed' in message
      const isDup = err.code === '23505' || /UNIQUE constraint failed/i.test(err.message || '');
      if (isDup) {
        return res.status(409).json({ error: 'A pulse is already active for this group' });
      }
      throw err;
    }

    // Creator is automatically "in"
    await PulseResponse.upsert(pulse.id, req.user.id, 'in', 'manual');

    // Fan out push notifications (skip away users, skip creator).
    // Wrapped in try/catch so a fan-out failure doesn't turn a successful
    // pulse creation into a 500.
    try {
      const recipientsResult = await pool.query(
        `SELECT u.id, u.name, u.push_subscription
         FROM users u
         JOIN user_groups ug ON ug.user_id = u.id
         WHERE ug.group_id = $1
           AND u.id != $2
           AND u.role != 'pending'
           AND (u.away_start_date IS NULL
                OR u.away_end_date IS NULL
                OR $3 < u.away_start_date
                OR $3 > u.away_end_date)`,
        [groupId, req.user.id, date]
      );
      pushService.sendPulseStarted(pulse, recipientsResult.rows, req.user.name).catch(err => {
        console.error('Push fan-out failed (non-fatal):', err.message);
      });
    } catch (err) {
      console.error('Push recipient lookup failed (non-fatal):', err.message);
    }

    const full = await Pulse.findById(pulse.id);
    const payload = await buildActivePayload(full, req.user.id);
    res.status(201).json({ pulse: payload, group_id: groupId });
  } catch (error) {
    console.error('Create pulse error:', error);
    res.status(500).json({ error: 'Failed to create pulse' });
  }
});

// POST /api/pulses/:id/respond — mark self as in/out
router.post('/:id/respond', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['in', 'out'].includes(status)) {
      return res.status(400).json({ error: 'status must be "in" or "out"' });
    }
    const pulse = await Pulse.findById(id);
    if (!pulse) return res.status(404).json({ error: 'Pulse not found' });
    if (pulse.status !== 'active') return res.status(400).json({ error: 'Pulse is no longer active' });

    const isMember = await User.isInGroup(req.user.id, pulse.group_id);
    if (!isMember) return res.status(403).json({ error: 'Not in this group' });

    await PulseResponse.upsert(pulse.id, req.user.id, status, 'manual');
    const payload = await buildActivePayload(pulse, req.user.id);
    res.json({ pulse: payload });
  } catch (error) {
    console.error('Respond to pulse error:', error);
    res.status(500).json({ error: 'Failed to record response' });
  }
});

// PATCH /api/pulses/:id/close — creator (or admin) ends the pulse early
router.patch('/:id/close', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const pulse = await Pulse.findById(id);
    if (!pulse) return res.status(404).json({ error: 'Pulse not found' });
    if (pulse.creator_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the creator can close this pulse' });
    }
    const closed = await Pulse.close(id);
    if (!closed) return res.status(400).json({ error: 'Pulse was not active' });
    res.json({ pulse: closed });
  } catch (error) {
    console.error('Close pulse error:', error);
    res.status(500).json({ error: 'Failed to close pulse' });
  }
});

module.exports = router;
