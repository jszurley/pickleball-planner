import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUpcomingEvents } from '../services/api';
import Calendar from '../components/Calendar';
import EventModal from '../components/EventModal';
import './CalendarView.css';

export default function CalendarView() {
  const { groups } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [viewMode, setViewMode] = useState('calendar');

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const response = await getUpcomingEvents();
      setEvents(response.data);
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEventClick = (event) => {
    setSelectedEventId(event.id);
  };

  const handleCloseModal = () => {
    setSelectedEventId(null);
  };

  const handleReservationChange = () => {
    loadEvents();
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (groups.length === 0) {
    return (
      <div className="calendar-view">
        <div className="page-header">
          <h1>Calendar</h1>
        </div>
        <div className="card">
          <p className="text-muted">
            You're not in any groups yet. Please wait for an admin to assign you to groups.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="calendar-view">
      <div className="calendar-view-header">
        <div className="page-header">
          <h1>Event Calendar</h1>
          <p>View and register for upcoming events across all your groups</p>
        </div>
        <div className="view-controls">
          <div className="view-toggle">
            <button
              className={`btn ${viewMode === 'calendar' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setViewMode('calendar')}
            >
              Calendar
            </button>
            <button
              className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setViewMode('list')}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <Calendar
          events={events}
          onEventClick={handleEventClick}
        />
      ) : (
        <div className="events-list">
          {events.length === 0 ? (
            <div className="card">
              <p className="text-muted">No upcoming events.</p>
            </div>
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                className={`event-list-item ${event.is_reserved ? 'reserved' : ''}`}
                onClick={() => handleEventClick(event)}
              >
                <div className="event-list-date">
                  <span className="date-day">
                    {new Date(event.event_date).getDate()}
                  </span>
                  <span className="date-month">
                    {new Date(event.event_date).toLocaleDateString('en-US', { month: 'short' })}
                  </span>
                </div>
                <div className="event-list-details">
                  <h3>{event.title}</h3>
                  <p>
                    {formatTime(event.start_time)} - {formatTime(event.end_time)}
                    {event.location_name && ` at ${event.location_name}`}
                  </p>
                  <div className="event-list-meta">
                    <span className="badge badge-secondary">{event.group_name}</span>
                    <span className={`spots ${parseInt(event.reservation_count) >= event.max_spots ? 'full' : ''}`}>
                      {parseInt(event.reservation_count)}/{event.max_spots} spots
                    </span>
                  </div>
                </div>
                <div className="event-list-status">
                  {event.is_reserved ? (
                    <span className="status-badge registered">Registered</span>
                  ) : parseInt(event.reservation_count) >= event.max_spots ? (
                    <span className="status-badge full">Full</span>
                  ) : (
                    <span className="status-badge available">Available</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {selectedEventId && (
        <EventModal
          eventId={selectedEventId}
          onClose={handleCloseModal}
          onReservationChange={handleReservationChange}
        />
      )}
    </div>
  );
}

function formatTime(timeStr) {
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}
