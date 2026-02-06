import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import ReservationButton from './ReservationButton';
import './EventCard.css';

export default function EventCard({ event, onReservationChange, onEdit, onDelete }) {
  const { user } = useAuth();
  const [showAttendees, setShowAttendees] = useState(false);

  const isCreator = event.creator_id === user?.id;
  const isFull = parseInt(event.reservation_count) >= event.max_spots;
  const spotsLeft = event.max_spots - parseInt(event.reservation_count);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
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

  return (
    <div className={`event-card ${event.is_reserved ? 'reserved' : ''} ${isFull && !event.is_reserved ? 'full' : ''}`}>
      <div className="event-header">
        <h3 className="event-title">{event.title}</h3>
        {event.group_name && (
          <span className="badge badge-secondary">{event.group_name}</span>
        )}
      </div>

      <div className="event-details">
        <div className="event-datetime">
          <span className="event-date">{formatDate(event.event_date)}</span>
          <span className="event-time">
            {formatTime(event.start_time)} - {formatTime(event.end_time)}
          </span>
        </div>

        {event.location_name && (
          <div className="event-location">
            <strong>{event.location_name}</strong>
            {event.location_address && <span>{event.location_address}</span>}
          </div>
        )}

        <div className="event-spots">
          <div className="spots-bar">
            <div
              className="spots-filled"
              style={{ width: `${(parseInt(event.reservation_count) / event.max_spots) * 100}%` }}
            />
          </div>
          <span className={`spots-text ${isFull ? 'full' : ''}`}>
            {parseInt(event.reservation_count)} / {event.max_spots} spots
            {!isFull && ` (${spotsLeft} left)`}
          </span>
        </div>

        {event.creator_name && (
          <div className="event-creator">
            Created by {event.creator_name}
          </div>
        )}
      </div>

      <div className="event-actions">
        <ReservationButton
          event={event}
          onReservationChange={onReservationChange}
        />

        {(isCreator || user?.role === 'admin') && (
          <div className="event-manage-actions">
            {isCreator && onEdit && (
              <button className="btn btn-outline btn-sm" onClick={() => onEdit(event)}>
                Edit
              </button>
            )}
            {onDelete && (
              <button className="btn btn-danger btn-sm" onClick={() => onDelete(event)}>
                Cancel
              </button>
            )}
          </div>
        )}
      </div>

      {event.reservations && event.reservations.length > 0 && (
        <div className="event-attendees">
          <button
            className="attendees-toggle"
            onClick={() => setShowAttendees(!showAttendees)}
          >
            {showAttendees ? 'Hide' : 'Show'} attendees ({event.reservations.length})
          </button>
          {showAttendees && (
            <ul className="attendees-list">
              {event.reservations.map((r) => (
                <li key={r.id}>{r.user_name}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
