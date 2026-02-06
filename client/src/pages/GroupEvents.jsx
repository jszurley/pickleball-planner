import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getGroup, getGroupEvents, deleteEvent } from '../services/api';
import { useAuth } from '../context/AuthContext';
import EventCard from '../components/EventCard';
import './GroupEvents.css';

export default function GroupEvents() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    loadData();
  }, [groupId, showPast]);

  const loadData = async () => {
    try {
      const [groupRes, eventsRes] = await Promise.all([
        getGroup(groupId),
        getGroupEvents(groupId, showPast)
      ]);
      setGroup(groupRes.data);
      setEvents(eventsRes.data);
    } catch (err) {
      if (err.response?.status === 403) {
        setError('You do not have access to this group');
      } else {
        setError('Failed to load group data');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (event) => {
    navigate(`/groups/${groupId}/events/${event.id}/edit`);
  };

  const handleDelete = async (event) => {
    if (!confirm('Are you sure you want to cancel this event?')) return;

    try {
      await deleteEvent(event.id);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel event');
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (error) {
    return (
      <div className="group-events-page">
        <Link to="/" className="back-link">&larr; Back to Dashboard</Link>
        <div className="alert alert-error">{error}</div>
      </div>
    );
  }

  const upcomingEvents = events.filter((e) => {
    const eventDate = new Date(e.event_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return eventDate >= today;
  });

  const pastEvents = events.filter((e) => {
    const eventDate = new Date(e.event_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return eventDate < today;
  });

  return (
    <div className="group-events-page">
      <Link to="/" className="back-link">&larr; Back to Dashboard</Link>

      <div className="group-header">
        <div>
          <h1>{group?.name}</h1>
          {group?.description && <p className="text-muted">{group.description}</p>}
        </div>
        <Link to={`/groups/${groupId}/events/new`} className="btn btn-primary">
          Create Event
        </Link>
      </div>

      <section className="events-section">
        <h2>Upcoming Events ({upcomingEvents.length})</h2>
        {upcomingEvents.length === 0 ? (
          <div className="card">
            <p className="text-muted">No upcoming events.</p>
            <Link to={`/groups/${groupId}/events/new`} className="btn btn-primary mt-1">
              Create the first event
            </Link>
          </div>
        ) : (
          <div className="events-grid">
            {upcomingEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onReservationChange={loadData}
                onEdit={event.creator_id === user?.id ? handleEdit : null}
                onDelete={(event.creator_id === user?.id || user?.role === 'admin') ? handleDelete : null}
              />
            ))}
          </div>
        )}
      </section>

      <section className="events-section">
        <div className="section-header">
          <h2>Past Events</h2>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setShowPast(!showPast)}
          >
            {showPast ? 'Hide Past' : 'Show Past'}
          </button>
        </div>
        {showPast && pastEvents.length === 0 && (
          <p className="text-muted">No past events.</p>
        )}
        {showPast && pastEvents.length > 0 && (
          <div className="events-grid past-events">
            {pastEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onReservationChange={loadData}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
