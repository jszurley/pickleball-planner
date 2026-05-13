import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getReservedEvents, getUpcomingEvents, getGroups } from '../services/api';
import EventCard from '../components/EventCard';
import EventModal from '../components/EventModal';
import './Dashboard.css';

// Legacy "formal event" home page. Kept under /schedule for tournaments and
// planned-in-advance games. The pulse home page is the new default at "/".
export default function LegacyDashboard() {
  const { user, groups: userGroups } = useAuth();
  const [reservedEvents, setReservedEvents] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [allGroups, setAllGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState(null);

  const isAdmin = user?.role === 'admin';
  const groups = isAdmin ? allGroups : userGroups;

  useEffect(() => {
    loadData();
  }, [isAdmin]);

  const loadData = async () => {
    try {
      const promises = [getReservedEvents(), getUpcomingEvents()];
      if (isAdmin) {
        promises.push(getGroups());
      }
      const results = await Promise.all(promises);
      setReservedEvents(results[0].data);
      setUpcomingEvents(results[1].data);
      if (isAdmin && results[2]) {
        setAllGroups(results[2].data);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="page-header">
          <h1>Schedule a formal event</h1>
          <p>Plan tournaments and ahead-of-time games. The home page is for spontaneous pulses.</p>
        </div>
      </div>

      <section className="dashboard-section">
        <h2>Your Reservations ({reservedEvents.length})</h2>
        {reservedEvents.length === 0 ? (
          <div className="card">
            <p className="text-muted">You haven't reserved any upcoming events.</p>
          </div>
        ) : (
          <>
            <EventCard event={reservedEvents[0]} onReservationChange={loadData} />
            {reservedEvents.length > 1 && (
              <div className="upcoming-events-compact mt-1">
                {reservedEvents.slice(1).map((event) => {
                  const [y, m, d] = event.event_date.split('T')[0].split('-');
                  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
                  const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                  const [hours, minutes] = event.start_time.split(':');
                  const hour = parseInt(hours);
                  const timeStr = `${hour % 12 || 12}:${minutes} ${hour >= 12 ? 'PM' : 'AM'}`;
                  return (
                    <div key={event.id} className="upcoming-event-row reserved" onClick={() => setSelectedEventId(event.id)}>
                      <span className="upcoming-date">{dateStr}</span>
                      <span className="upcoming-title">{event.title}</span>
                      <span className="upcoming-time">{timeStr}</span>
                      <span className="upcoming-group">{event.group_name}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>

      <section className="dashboard-section">
        <div className="section-header-inline">
          <h2>Upcoming Events</h2>
          <Link to="/calendar" className="view-all-link">View All &rarr;</Link>
        </div>
        {(() => {
          const now = new Date();
          const filteredEvents = upcomingEvents.filter((event) => {
            const [y, m, d] = event.event_date.split('T')[0].split('-');
            const [hours, minutes] = event.start_time.split(':');
            const eventDateTime = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), parseInt(hours), parseInt(minutes));
            return eventDateTime > now;
          });
          return filteredEvents.length === 0 ? (
            <p className="text-muted">No upcoming events in your groups.</p>
          ) : (
            <div className="upcoming-events-compact">
              {filteredEvents.slice(0, 3).map((event) => {
                const [y, m, d] = event.event_date.split('T')[0].split('-');
                const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
                const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                const [hours, minutes] = event.start_time.split(':');
                const hour = parseInt(hours);
                const timeStr = `${hour % 12 || 12}:${minutes} ${hour >= 12 ? 'PM' : 'AM'}`;
                return (
                  <div key={event.id} className={`upcoming-event-row ${event.is_reserved ? 'reserved' : ''}`} onClick={() => setSelectedEventId(event.id)}>
                    <span className="upcoming-date">{dateStr}</span>
                    <span className="upcoming-title">{event.title}</span>
                    <span className="upcoming-time">{timeStr}</span>
                    <span className="upcoming-group">{event.group_name}</span>
                    {event.is_reserved && <span className="upcoming-reserved-badge">Reserved</span>}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </section>

      <section className="dashboard-section">
        <h2>Your Groups</h2>
        {groups.length === 0 ? (
          <div className="card">
            <p className="text-muted">
              {isAdmin
                ? 'No groups exist yet. Create groups in the Admin panel.'
                : "You're not in any groups yet. Please wait for an admin to assign you."}
            </p>
            {isAdmin && (
              <Link to="/admin/groups" className="btn btn-primary mt-1">Create Groups</Link>
            )}
          </div>
        ) : (
          <div className="groups-grid">
            {groups.map((group) => (
              <Link key={group.id} to={`/groups/${group.id}/events`} className="group-card">
                <h3>{group.name}</h3>
                {group.description && <p>{group.description}</p>}
                <span className="group-link">View Events &rarr;</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {selectedEventId && (
        <EventModal
          eventId={selectedEventId}
          onClose={() => setSelectedEventId(null)}
          onReservationChange={loadData}
        />
      )}
    </div>
  );
}
