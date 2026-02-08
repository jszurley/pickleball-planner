import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getEvent, reserveSpot, cancelReservation, cloneEvent } from '../services/api';
import './EventModal.css';

export default function EventModal({ eventId, onClose, onReservationChange }) {
  const { user } = useAuth();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneDate, setCloneDate] = useState('');
  const [cloneSuccess, setCloneSuccess] = useState('');

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  const loadEvent = async () => {
    try {
      const response = await getEvent(eventId);
      setEvent(response.data);
    } catch (err) {
      setError('Failed to load event details');
    } finally {
      setLoading(false);
    }
  };

  const handleReserve = async () => {
    setActionLoading(true);
    setError('');
    try {
      await reserveSpot(eventId);
      await loadEvent();
      if (onReservationChange) onReservationChange();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reserve spot');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    setError('');
    try {
      await cancelReservation(eventId);
      await loadEvent();
      if (onReservationChange) onReservationChange();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel reservation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClone = async () => {
    if (!cloneDate) {
      setError('Please select a date');
      return;
    }
    setActionLoading(true);
    setError('');
    setCloneSuccess('');
    try {
      await cloneEvent(eventId, cloneDate);
      setCloneSuccess('Event cloned successfully!');
      setShowCloneModal(false);
      setCloneDate('');
      if (onReservationChange) onReservationChange();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to clone event');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timeStr) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const isPastEvent = () => {
    if (!event) return false;
    const eventDate = new Date(event.event_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return eventDate < today;
  };

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal event-modal" onClick={(e) => e.stopPropagation()}>
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal event-modal" onClick={(e) => e.stopPropagation()}>
          <div className="alert alert-error">Event not found</div>
          <button className="btn btn-outline" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  const isFull = parseInt(event.reservation_count) >= event.max_spots;
  const spotsLeft = event.max_spots - parseInt(event.reservation_count);
  const isCreator = event.creator_id === user?.id;
  const isAdmin = user?.role === 'admin';
  const canClone = isCreator || isAdmin;
  const past = isPastEvent();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal event-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{event.title}</h2>
            {event.group_name && (
              <span className="badge badge-secondary">{event.group_name}</span>
            )}
          </div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="event-modal-content">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="event-detail">
            <span className="detail-label">Date</span>
            <span className="detail-value">{formatDate(event.event_date)}</span>
          </div>

          <div className="event-detail">
            <span className="detail-label">Time</span>
            <span className="detail-value">
              {formatTime(event.start_time)} - {formatTime(event.end_time)}
            </span>
          </div>

          {event.location_name && (
            <div className="event-detail">
              <span className="detail-label">Location</span>
              <span className="detail-value">
                <strong>{event.location_name}</strong>
                {event.location_address && (
                  <span className="location-address">{event.location_address}</span>
                )}
              </span>
            </div>
          )}

          <div className="event-detail">
            <span className="detail-label">Organizer</span>
            <span className="detail-value">{event.creator_name || 'Unknown'}</span>
          </div>

          <div className="event-spots">
            <div className="spots-header">
              <span className="detail-label">Spots</span>
              <span className={`spots-count ${isFull ? 'full' : ''}`}>
                {parseInt(event.reservation_count)} / {event.max_spots}
                {!isFull && ` (${spotsLeft} available)`}
                {isFull && ' (Full)'}
              </span>
            </div>
            <div className="spots-bar">
              <div
                className="spots-filled"
                style={{ width: `${(parseInt(event.reservation_count) / event.max_spots) * 100}%` }}
              />
            </div>
          </div>

          {event.reservations && event.reservations.length > 0 && (
            <div className="event-attendees">
              <span className="detail-label">Attendees</span>
              <ul className="attendees-list">
                {event.reservations.map((r) => (
                  <li key={r.id}>
                    {r.user_name}
                    {r.user_id === user?.id && <span className="you-badge">(You)</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {cloneSuccess && <div className="alert alert-success">{cloneSuccess}</div>}

        <div className="event-modal-footer">
          <div className="footer-actions">
            {canClone && (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setShowCloneModal(true)}
                disabled={actionLoading}
              >
                Clone Event
              </button>
            )}
          </div>
          <div className="footer-primary">
            {past ? (
              <span className="past-event-notice">This event has passed</span>
            ) : event.is_reserved ? (
              <button
                className="btn btn-reserved"
                onClick={handleCancel}
                disabled={actionLoading}
              >
                {actionLoading ? 'Cancelling...' : 'Cancel My Reservation'}
              </button>
            ) : isFull ? (
              <button className="btn btn-full" disabled>
                Event is Full
              </button>
            ) : (
              <button
                className="btn btn-primary btn-lg"
                onClick={handleReserve}
                disabled={actionLoading}
              >
                {actionLoading ? 'Reserving...' : 'Reserve My Spot'}
              </button>
            )}
          </div>
        </div>

        {showCloneModal && (
          <div className="clone-modal">
            <h3>Clone Event</h3>
            <p>Create a copy of this event on a different date.</p>
            <div className="form-group">
              <label htmlFor="cloneDate">New Date</label>
              <input
                type="date"
                id="cloneDate"
                value={cloneDate}
                onChange={(e) => setCloneDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="clone-modal-actions">
              <button
                className="btn btn-outline"
                onClick={() => { setShowCloneModal(false); setCloneDate(''); }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleClone}
                disabled={actionLoading || !cloneDate}
              >
                {actionLoading ? 'Cloning...' : 'Clone Event'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
