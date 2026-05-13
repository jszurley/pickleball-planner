import { useEffect, useState } from 'react';
import { createPulse, getLocations } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './Pulse.css';

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

export default function StartPulseCard({ groupId, onCreated }) {
  const { user } = useAuth();
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState(user?.default_location_id || '');
  const [preset, setPreset] = useState('tonight');
  const [customText, setCustomText] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    getLocations().then(r => setLocations(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (user?.default_location_id && !locationId) {
      setLocationId(user.default_location_id);
    }
  }, [user, locationId]);

  function presetToPayload(p) {
    const morning = (user?.usual_morning_start || '08:00').slice(0, 5);
    const evening = (user?.usual_evening_start || '18:00').slice(0, 5);
    const dur = user?.usual_duration_min || 90;
    if (p === 'tonight') {
      return { date: todayISO(), startTime: evening, endTime: addMinutes(evening, dur) };
    }
    // tomorrow morning
    return { date: tomorrowISO(), startTime: morning, endTime: addMinutes(morning, dur) };
  }

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      let payload = { groupId, locationId: locationId || null };
      if (showCustom && customText.trim()) {
        payload.freeText = customText.trim();
      } else {
        Object.assign(payload, presetToPayload(preset));
      }
      const res = await createPulse(payload);
      onCreated(res.data.pulse);
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to start pulse');
    } finally {
      setBusy(false);
    }
  };

  const summaryFor = (p) => {
    const { date, startTime } = presetToPayload(p);
    const label = p === 'tonight' ? 'Tonight' : 'Tomorrow morning';
    return `${label} at ${startTime}`;
  };

  return (
    <div className="start-pulse-card">
      <button className="start-pulse-big-btn" onClick={submit} disabled={busy || !groupId}>
        {busy ? 'Starting…' : `Who's playing? — ${showCustom ? 'use custom' : summaryFor(preset)}`}
      </button>

      <div className="start-pulse-presets">
        <button
          className={`start-pulse-preset-btn ${!showCustom && preset === 'tonight' ? 'selected' : ''}`}
          onClick={() => { setShowCustom(false); setPreset('tonight'); }}
        >
          Tonight
        </button>
        <button
          className={`start-pulse-preset-btn ${!showCustom && preset === 'tomorrow_morning' ? 'selected' : ''}`}
          onClick={() => { setShowCustom(false); setPreset('tomorrow_morning'); }}
        >
          Tomorrow morning
        </button>
        <button
          className={`start-pulse-preset-btn ${showCustom ? 'selected' : ''}`}
          onClick={() => setShowCustom(true)}
        >
          Custom…
        </button>
      </div>

      {showCustom && (
        <div className="start-pulse-custom">
          <input
            type="text"
            placeholder='e.g. "Saturday morning at NRR"'
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
          />
        </div>
      )}

      <div className="start-pulse-detail-row">
        <label>At:</label>
        <select value={locationId || ''} onChange={(e) => setLocationId(e.target.value || null)}>
          <option value="">(no location)</option>
          {locations.map(l => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>

      {err && <p style={{ color: 'crimson', marginTop: '0.5rem' }}>{err}</p>}
    </div>
  );
}
