import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllEvents, deleteEvent } from '../../services/api';
import './Admin.css';

export default function ManageEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const response = await getAllEvents();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Filter to today and future, then sort by date
      const parseDate = (dateStr) => {
        const [year, month, day] = dateStr.split('T')[0].split('-');
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      };
      const upcomingEvents = response.data
        .filter((e) => parseDate(e.event_date) >= today)
        .sort((a, b) => {
          const dateCompare = parseDate(a.event_date) - parseDate(b.event_date);
          if (dateCompare !== 0) return dateCompare;
          return a.start_time.localeCompare(b.start_time);
        });

      setEvents(upcomingEvents);
    } catch (err) {
      setError('Failed to load events');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (eventId) => {
    setActionLoading(true);
    try {
      await deleteEvent(eventId);
      setEvents(events.filter((e) => e.id !== eventId));
      setDeleteConfirm(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete event');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (timeStr) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="admin-page">
      <Link to="/admin" className="back-link">&larr; Back to Admin</Link>

      <div className="page-header">
        <h1>Manage Events</h1>
        <p>View and manage upcoming events</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {events.length === 0 ? (
        <div className="empty-state">
          <p>No upcoming events</p>
        </div>
      ) : (
        <div className="events-table-container">
          <table className="events-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Title</th>
                <th>Group</th>
                <th>Location</th>
                <th>Spots</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{formatDate(event.event_date)}</td>
                  <td>{formatTime(event.start_time)}</td>
                  <td>{event.title}</td>
                  <td>{event.group_name || '-'}</td>
                  <td>{event.location_name || '-'}</td>
                  <td>
                    {event.reservation_count || 0} / {event.max_spots}
                  </td>
                  <td>
                    {deleteConfirm === event.id ? (
                      <div className="confirm-actions">
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(event.id)}
                          disabled={actionLoading}
                        >
                          {actionLoading ? '...' : 'Confirm'}
                        </button>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => setDeleteConfirm(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => setDeleteConfirm(event.id)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
