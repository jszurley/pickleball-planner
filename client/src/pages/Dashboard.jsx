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
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  const isAdmin = user?.role === 'admin';
  const groups = isAdmin ? allGroups : userGroups;

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

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

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowInstallBanner(false);
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="page-header">
          <h1>Welcome, {user?.name}!</h1>
          <p>Manage your pickleball games and reservations</p>
        </div>
        <Link to="/profile" className="profile-button">
          <span className="profile-avatar-small">{user?.name?.charAt(0).toUpperCase()}</span>
          <span className="profile-text">Profile</span>
        </Link>
      </div>

      {/* Install App Banner */}
      {showInstallBanner && !isInstalled && (
        <div className="install-banner">
          <div className="install-banner-content">
            <img src="/icons/icon-72x72.png" alt="App icon" className="install-banner-icon" />
            <div className="install-banner-text">
              <strong>Get the App!</strong>
              <p>Install Pickleball Planner for quick access from your home screen.</p>
            </div>
          </div>
          <div className="install-banner-actions">
            <button className="btn btn-outline btn-sm" onClick={() => setShowInstallBanner(false)}>
              Maybe Later
            </button>
            <button className="btn btn-primary" onClick={handleInstall}>
              Install App
            </button>
          </div>
        </div>
      )}

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
          <>
            {/* First reservation as full card */}
            <EventCard
              event={reservedEvents[0]}
              onReservationChange={loadData}
            />
            {/* Remaining reservations compact */}
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
                    <Link key={event.id} to="/calendar" className="upcoming-event-row reserved">
                      <span className="upcoming-date">{dateStr}</span>
                      <span className="upcoming-title">{event.title}</span>
                      <span className="upcoming-time">{timeStr}</span>
                      <span className="upcoming-group">{event.group_name}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>

      {/* Upcoming Events - Compact */}
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
                <Link key={event.id} to="/calendar" className={`upcoming-event-row ${event.is_reserved ? 'reserved' : ''}`}>
                  <span className="upcoming-date">{dateStr}</span>
                  <span className="upcoming-title">{event.title}</span>
                  <span className="upcoming-time">{timeStr}</span>
                  <span className="upcoming-group">{event.group_name}</span>
                  {event.is_reserved && <span className="upcoming-reserved-badge">Reserved</span>}
                </Link>
              );
            })}
          </div>
          );
        })()}
      </section>

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
    </div>
  );
}
