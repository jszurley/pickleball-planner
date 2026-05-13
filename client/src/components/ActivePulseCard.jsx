import { useState } from 'react';
import { respondToPulse, closePulse } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './Pulse.css';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('T')[0].split('-');
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.getTime() === today.getTime()) return 'Today';
  if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
}

export default function ActivePulseCard({ pulse, onUpdate }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!pulse) return null;

  const ins = (pulse.responses || []).filter(r => r.status === 'in');
  const isCreator = pulse.creator_id === user?.id;
  const myStatus = pulse.my_status;
  const gameOn = !!pulse.game_on;

  const respond = async (status) => {
    setBusy(true);
    try {
      const res = await respondToPulse(pulse.id, status);
      onUpdate(res.data.pulse);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update your response');
    } finally {
      setBusy(false);
    }
  };

  const end = async () => {
    if (!window.confirm('End this pulse?')) return;
    setBusy(true);
    try {
      await closePulse(pulse.id);
      onUpdate(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to end pulse');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`pulse-card active ${gameOn ? 'game-on' : ''}`}>
      <div className="pulse-meta">{pulse.creator_name || 'Someone'} started a pulse</div>
      <div className="pulse-headline">
        {formatDate(pulse.pulse_date)} at {formatTime(pulse.start_time)}
        {pulse.location_name ? ` @ ${pulse.location_name}` : ''}
      </div>
      <div className="pulse-recap">
        {pulse.recap || `${ins.length} in${gameOn ? ' — game on!' : `, need ${Math.max(0, pulse.min_players - ins.length)} more`}`}
      </div>
      <div className="pulse-attendees">
        {ins.length > 0
          ? <>In: {ins.map(r => r.user_name).join(', ')}</>
          : <>No responses yet</>}
      </div>
      <div className="pulse-actions">
        <button
          className={`btn pulse-btn-in ${myStatus === 'in' ? 'selected' : ''}`}
          onClick={() => respond('in')}
          disabled={busy}
        >
          I'm in
        </button>
        <button
          className={`btn pulse-btn-out ${myStatus === 'out' ? 'selected' : ''}`}
          onClick={() => respond('out')}
          disabled={busy}
        >
          I'm out
        </button>
        {isCreator && (
          <button className="btn pulse-end" onClick={end} disabled={busy}>
            End pulse
          </button>
        )}
      </div>
    </div>
  );
}
