import { useState } from 'react';
import { setAway, clearAway } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './Pulse.css';

function fmt(d) {
  if (!d) return '';
  const [y, m, day] = String(d).split('T')[0].split('-');
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(day));
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function AwayBanner() {
  const { user, refreshUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(user?.away_start_date ? String(user.away_start_date).split('T')[0] : '');
  const [end, setEnd] = useState(user?.away_end_date ? String(user.away_end_date).split('T')[0] : '');
  const [busy, setBusy] = useState(false);

  const isAway = !!(user?.away_start_date && user?.away_end_date);

  const save = async () => {
    if (!start || !end) return;
    setBusy(true);
    try {
      await setAway(start, end);
      await refreshUser();
      setOpen(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to set away');
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    try {
      await clearAway();
      setStart('');
      setEnd('');
      await refreshUser();
      setOpen(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to clear away');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`away-banner ${isAway ? 'active' : ''}`}>
      <div className="away-banner-summary">
        <span>
          {isAway
            ? <>Away {fmt(user.away_start_date)} – {fmt(user.away_end_date)} · auto "I'm out" + no notifications</>
            : <>Going out of town? Set away dates.</>}
        </span>
        <button className="away-banner-toggle" onClick={() => setOpen(o => !o)}>
          {open ? 'Hide' : (isAway ? 'Edit' : 'Set dates')}
        </button>
      </div>
      {open && (
        <div className="away-banner-form">
          <label>From <input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label>To <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={busy || !start || !end}>Save</button>
          {isAway && <button className="btn btn-outline btn-sm" onClick={clear} disabled={busy}>Clear</button>}
        </div>
      )}
    </div>
  );
}
