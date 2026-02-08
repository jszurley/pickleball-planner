import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getGroup, getGroups, getLocations, createEvent, createRecurringEvents, getEvent, updateEvent } from '../services/api';
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
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringData, setRecurringData] = useState({
    endDate: '',
    frequency: 'weekly'
  });
  const [daysOfWeek, setDaysOfWeek] = useState([1, 2, 3, 4, 5]); // Default Mon-Fri for daily

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

  const handleRecurringChange = (e) => {
    const { name, value } = e.target;
    setRecurringData((prev) => ({ ...prev, [name]: value }));

    // Reset days of week when frequency changes
    if (name === 'frequency') {
      if (value === 'daily') {
        setDaysOfWeek([1, 2, 3, 4, 5]); // Mon-Fri
      } else if (value === 'weekly') {
        setDaysOfWeek([]); // None selected
      }
    }
  };

  const toggleDay = (day) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const targetGroupId = isAdmin ? selectedGroupId : urlGroupId;

      if (isEdit) {
        const payload = {
          title: formData.title,
          eventDate: formData.eventDate,
          startTime: formData.startTime,
          endTime: formData.endTime,
          locationId: formData.locationId || null,
          maxSpots: parseInt(formData.maxSpots)
        };
        await updateEvent(eventId, payload);
        navigate(`/groups/${targetGroupId}/events`);
      } else if (isRecurring) {
        // Validate days of week for daily/weekly
        if ((recurringData.frequency === 'daily' || recurringData.frequency === 'weekly') && daysOfWeek.length === 0) {
          setError('Please select at least one day of the week');
          setSubmitting(false);
          return;
        }

        const payload = {
          title: formData.title,
          startDate: formData.eventDate,
          endDate: recurringData.endDate,
          startTime: formData.startTime,
          endTime: formData.endTime,
          locationId: formData.locationId || null,
          maxSpots: parseInt(formData.maxSpots),
          frequency: recurringData.frequency,
          daysOfWeek: (recurringData.frequency === 'daily' || recurringData.frequency === 'weekly') ? daysOfWeek : null
        };
        const response = await createRecurringEvents(targetGroupId, payload);
        alert(`Created ${response.data.count} events!`);
        navigate(`/groups/${targetGroupId}/events`);
      } else {
        const payload = {
          title: formData.title,
          eventDate: formData.eventDate,
          startTime: formData.startTime,
          endTime: formData.endTime,
          locationId: formData.locationId || null,
          maxSpots: parseInt(formData.maxSpots)
        };
        await createEvent(targetGroupId, payload);
        navigate(`/groups/${targetGroupId}/events`);
      }
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
              <label htmlFor="eventDate">{isRecurring ? 'Start Date' : 'Date'}</label>
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

          {!isEdit && (
            <div className="form-group recurring-toggle">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                />
                <span>Create recurring events</span>
              </label>
            </div>
          )}

          {isRecurring && (
            <div className="form-row recurring-options">
              <div className="form-group">
                <label htmlFor="endDate">End Date</label>
                <input
                  type="date"
                  id="endDate"
                  name="endDate"
                  value={recurringData.endDate}
                  onChange={handleRecurringChange}
                  required={isRecurring}
                  min={formData.eventDate || new Date().toISOString().split('T')[0]}
                />
              </div>

              <div className="form-group">
                <label htmlFor="frequency">Frequency</label>
                <select
                  id="frequency"
                  name="frequency"
                  value={recurringData.frequency}
                  onChange={handleRecurringChange}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Every 2 Weeks</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>
          )}

          {isRecurring && (recurringData.frequency === 'daily' || recurringData.frequency === 'weekly') && (
            <div className="form-group days-of-week">
              <label>Days of Week</label>
              <div className="days-checkboxes">
                {dayLabels.map((label, index) => (
                  <label key={index} className={`day-checkbox ${daysOfWeek.includes(index) ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={daysOfWeek.includes(index)}
                      onChange={() => toggleDay(index)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

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
