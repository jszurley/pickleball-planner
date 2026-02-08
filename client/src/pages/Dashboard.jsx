import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getReservedEvents, getUpcomingEvents, getGroups } from '../services/api';
import EventCard from '../components/EventCard';
import './Dashboard.css';

export default function Dashboard() {
  const { user, groups: userGroups } = useAuth();
  const [reservedEvents, setReservedEvents] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [allGroups, setAllGroups] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const loadEvents = async () => {
    try {
      const [reservedRes, upcomingRes] = await Promise.all([
        getReservedEvents(),
        getUpcomingEvents()
      ]);
      setReservedEvents(reservedRes.data);
      setUpcomingEvents(upcomingRes.data);
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>Welcome, {user?.name}!</h1>
        <p>Manage your pickleball games and reservations</p>
      </div>

      {/* Your Groups */}
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
              <Link to="/admin/groups" className="btn btn-primary mt-1">
                Create Groups
              </Link>
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

      {/* Your Reservations */}
      <section className="dashboard-section">
        <h2>Your Reservations ({reservedEvents.length})</h2>
        {reservedEvents.length === 0 ? (
          <div className="card">
            <p className="text-muted">
              You haven't reserved any upcoming events.
            </p>
          </div>
        ) : (
          <div className="events-grid">
            {reservedEvents.slice(0, 4).map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onReservationChange={loadData}
              />
            ))}
          </div>
        )}
        {reservedEvents.length > 4 && (
          <p className="text-muted mt-1">
            And {reservedEvents.length - 4} more...
          </p>
        )}
      </section>

      {/* Upcoming Events */}
      <section className="dashboard-section">
        <h2>Upcoming Events</h2>
        {upcomingEvents.length === 0 ? (
          <div className="card">
            <p className="text-muted">
              No upcoming events in your groups.
            </p>
          </div>
        ) : (
          <div className="events-grid">
            {upcomingEvents.slice(0, 6).map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onReservationChange={loadData}
              />
            ))}
          </div>
        )}
        {upcomingEvents.length > 6 && (
          <p className="text-muted mt-1">
            View your groups to see all events.
          </p>
        )}
      </section>
    </div>
  );
}
