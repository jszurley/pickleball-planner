import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getGroup, getGroups, getLocations, createEvent, getEvent, updateEvent } from '../services/api';
import './CreateEvent.css';

export default function CreateEvent() {
  const { groupId: urlGroupId, eventId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isEdit = !!eventId;
  const isAdmin = user?.role === 'admin';

  const [group, setGroup] = useState(null);
  const [allGroups, setAllGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(urlGroupId);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    eventDate: '',
    startTime: '',
    endTime: '',
    locationId: '',
    maxSpots: 8
  });

  useEffect(() => {
    loadData();
  }, [urlGroupId, eventId, isAdmin]);

  useEffect(() => {
    if (selectedGroupId && allGroups.length > 0) {
      const selectedGroup = allGroups.find(g => g.id.toString() === selectedGroupId.toString());
      setGroup(selectedGroup || null);
    }
  }, [selectedGroupId, allGroups]);

  const loadData = async () => {
    try {
      const promises = [getLocations()];
      if (isAdmin) {
        promises.push(getGroups());
      } else {
        promises.push(getGroup(urlGroupId));
      }

      const results = await Promise.all(promises);
      setLocations(results[0].data);

      if (isAdmin) {
        setAllGroups(results[1].data);
        if (urlGroupId) {
          setSelectedGroupId(urlGroupId);
          const selectedGroup = results[1].data.find(g => g.id.toString() === urlGroupId.toString());
          setGroup(selectedGroup || null);
        } else if (results[1].data.length > 0) {
          setSelectedGroupId(results[1].data[0].id);
          setGroup(results[1].data[0]);
        }
      } else {
        setGroup(results[1].data);
      }

      if (isEdit) {
        const eventRes = await getEvent(eventId);
        const event = eventRes.data;
        setFormData({
          title: event.title,
          eventDate: event.event_date.split('T')[0],
          startTime: event.start_time.slice(0, 5),
          endTime: event.end_time.slice(0, 5),
          locationId: event.location_id || '',
          maxSpots: event.max_spots
        });
      }
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const payload = {
        title: formData.title,
        eventDate: formData.eventDate,
        startTime: formData.startTime,
        endTime: formData.endTime,
        locationId: formData.locationId || null,
        maxSpots: parseInt(formData.maxSpots)
      };

      const targetGroupId = isAdmin ? selectedGroupId : urlGroupId;

      if (isEdit) {
        await updateEvent(eventId, payload);
      } else {
        await createEvent(targetGroupId, payload);
      }

      navigate(`/groups/${targetGroupId}/events`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save event');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  const backUrl = isAdmin && selectedGroupId
    ? `/groups/${selectedGroupId}/events`
    : `/groups/${urlGroupId}/events`;

  return (
    <div className="create-event-page">
      <Link to={backUrl} className="back-link">
        &larr; Back to {group?.name || 'Group'}
      </Link>

      <div className="page-header">
        <h1>{isEdit ? 'Edit Event' : 'Create Event'}</h1>
        <p>{group?.name}</p>
      </div>

      <div className="card create-event-card">
        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {isAdmin && allGroups.length > 0 && (
            <div className="form-group">
              <label htmlFor="groupSelect">Group</label>
              <select
                id="groupSelect"
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                required
              >
                {allGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="title">Event Title</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              placeholder="e.g., Tuesday Morning Play"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="eventDate">Date</label>
              <input
                type="date"
                id="eventDate"
                name="eventDate"
                value={formData.eventDate}
                onChange={handleChange}
                required
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="form-group">
              <label htmlFor="startTime">Start Time</label>
              <input
                type="time"
                id="startTime"
                name="startTime"
                value={formData.startTime}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="endTime">End Time</label>
              <input
                type="time"
                id="endTime"
                name="endTime"
                value={formData.endTime}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="locationId">Location (optional)</label>
              <select
                id="locationId"
                name="locationId"
                value={formData.locationId}
                onChange={handleChange}
              >
                <option value="">Select a location</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="maxSpots">Max Spots</label>
              <input
                type="number"
                id="maxSpots"
                name="maxSpots"
                value={formData.maxSpots}
                onChange={handleChange}
                required
                min="1"
                max="100"
              />
            </div>
          </div>

          <div className="form-actions">
            <Link to={backUrl} className="btn btn-outline">
              Cancel
            </Link>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
