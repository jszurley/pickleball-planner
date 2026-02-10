import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUpcomingEvents, getGroups, getAllEvents } from '../services/api';
import Calendar from '../components/Calendar';
import EventModal from '../components/EventModal';
import './CalendarView.css';

export default function CalendarView() {
  const { user, groups: userGroups } = useAuth();
  const [events, setEvents] = useState([]);
  const [allGroups, setAllGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [viewMode, setViewMode] = useState('calendar');

  const isAdmin = user?.role === 'admin';
  const groups = isAdmin ? allGroups : userGroups;

  useEffect(() => {
    loadData();
  }, [isAdmin]);

  const loadData = async () => {
    try {
      if (isAdmin) {
        const [eventsRes, groupsRes] = await Promise.all([
          getAllEvents(),
          getGroups()
        ]);
        setEvents(eventsRes.data);
        setAllGroups(groupsRes.data);
      } else {
        const response = await getUpcomingEvents();
        setEvents(response.data);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = loadData;

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
            {isAdmin
              ? 'No groups exist yet. Create groups first to add events.'
              : "You're not in any groups yet. Please wait for an admin to assign you to groups."}
          </p>
          {isAdmin && (
            <Link to="/admin/groups" className="btn btn-primary mt-1">
              Create Groups
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="calendar-view">
      <div className="calendar-view-header">
        <div className="page-header">
          <h1>Event Calendar</h1>
          <p>View and register for upcoming events{isAdmin ? '' : ' across all your groups'}</p>
        </div>
        <div className="view-controls">
          {groups.length > 0 && (
            <Link to={`/groups/${groups[0].id}/events/new`} className="btn btn-primary">
              + Create Event
            </Link>
          )}
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
            [...events]
              .filter((event) => {
                const [y, m, d] = event.event_date.split('T')[0].split('-');
                const eventDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                return eventDate >= today;
              })
              .sort((a, b) => {
                const [ay, am, ad] = a.event_date.split('T')[0].split('-');
                const [by, bm, bd] = b.event_date.split('T')[0].split('-');
                const dateA = new Date(parseInt(ay), parseInt(am) - 1, parseInt(ad));
                const dateB = new Date(parseInt(by), parseInt(bm) - 1, parseInt(bd));
                if (dateA - dateB !== 0) return dateA - dateB;
                return a.start_time.localeCompare(b.start_time);
              }).map((event) => (
              <div
                key={event.id}
                className={`event-list-item ${event.is_reserved ? 'reserved' : ''}`}
                onClick={() => handleEventClick(event)}
              >
                <div className="event-list-date">
                  <span className="date-day">
                    {(() => {
                      const [y, m, d] = event.event_date.split('T')[0].split('-');
                      return parseInt(d);
                    })()}
                  </span>
                  <span className="date-month">
                    {(() => {
                      const [y, m, d] = event.event_date.split('T')[0].split('-');
                      return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toLocaleDateString('en-US', { month: 'short' });
                    })()}
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
