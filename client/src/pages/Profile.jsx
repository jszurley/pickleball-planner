import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getProfile, updateProfile, changePassword, getLocations, updatePreferences } from '../services/api';
import './Profile.css';

export default function Profile() {
  const { user, groups: userGroups, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    level_of_play: '',
    dupr_rating: '',
    certified_rating: false
  });

  const [locations, setLocations] = useState([]);
  const [prefs, setPrefs] = useState({
    default_group_id: '',
    default_location_id: '',
    usual_morning_start: '08:00',
    usual_evening_start: '18:00',
    usual_duration_min: 90
  });
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsMsg, setPrefsMsg] = useState('');

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  useEffect(() => {
    loadProfile();
    getLocations().then(r => setLocations(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    setPrefs({
      default_group_id: user.default_group_id || '',
      default_location_id: user.default_location_id || '',
      usual_morning_start: (user.usual_morning_start || '08:00').slice(0, 5),
      usual_evening_start: (user.usual_evening_start || '18:00').slice(0, 5),
      usual_duration_min: user.usual_duration_min || 90
    });
  }, [user]);

  const handlePrefsChange = (e) => {
    const { name, value } = e.target;
    setPrefs(prev => ({ ...prev, [name]: value }));
  };

  const handlePrefsSubmit = async (e) => {
    e.preventDefault();
    setPrefsMsg('');
    setPrefsSaving(true);
    try {
      await updatePreferences({
        default_group_id: prefs.default_group_id ? parseInt(prefs.default_group_id, 10) : null,
        default_location_id: prefs.default_location_id ? parseInt(prefs.default_location_id, 10) : null,
        usual_morning_start: prefs.usual_morning_start || null,
        usual_evening_start: prefs.usual_evening_start || null,
        usual_duration_min: prefs.usual_duration_min ? parseInt(prefs.usual_duration_min, 10) : null
      });
      setPrefsMsg('Preferences saved!');
      if (refreshUser) await refreshUser();
    } catch (err) {
      setPrefsMsg(err.response?.data?.error || 'Failed to save preferences');
    } finally {
      setPrefsSaving(false);
    }
  };

  const loadProfile = async () => {
    try {
      const response = await getProfile();
      setFormData({
        name: response.data.name || '',
        email: response.data.email || '',
        phone: response.data.phone || '',
        level_of_play: response.data.level_of_play || '',
        dupr_rating: response.data.dupr_rating ?? '',
        certified_rating: !!response.data.certified_rating
      });
    } catch (err) {
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      await updateProfile(formData);
      setSuccess('Profile updated successfully!');
      if (refreshUser) {
        await refreshUser();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }

    setSaving(true);

    try {
      await changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      setPasswordSuccess('Password changed successfully!');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setShowPasswordForm(false);
    } catch (err) {
      setPasswordError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="profile-page">
      <div className="page-header">
        <h1>My Profile</h1>
        <p>Manage your account information</p>
      </div>

      <div className="profile-card card">
        <div className="profile-avatar">
          {formData.name.charAt(0).toUpperCase()}
        </div>
        <div className="profile-role">
          <span className={`badge ${user?.role === 'admin' ? 'badge-primary' : 'badge-secondary'}`}>
            {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}
          </span>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">Phone Number</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="(555) 123-4567"
            />
          </div>

          <div className="form-group">
            <label htmlFor="level_of_play">Level of Play</label>
            <select
              id="level_of_play"
              name="level_of_play"
              value={formData.level_of_play}
              onChange={handleChange}
            >
              <option value="">-- Select --</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="expert">Expert</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="dupr_rating">DUPR Rating</label>
            <input
              type="number"
              id="dupr_rating"
              name="dupr_rating"
              value={formData.dupr_rating}
              onChange={handleChange}
              step="0.1"
              min="0"
              max="8"
              placeholder="e.g. 3.5"
            />
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                name="certified_rating"
                checked={formData.certified_rating}
                onChange={handleChange}
              />
              Certified Rating
            </label>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-outline" onClick={() => navigate('/')}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Pickleball Preferences */}
      <div className="profile-card card">
        <h2>Pickleball Preferences</h2>
        <p className="text-muted" style={{ marginTop: '-0.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
          Used as smart defaults when you start a "Who's playing?" pulse.
        </p>
        {prefsMsg && <div className="alert alert-success">{prefsMsg}</div>}
        <form onSubmit={handlePrefsSubmit}>
          <div className="form-group">
            <label htmlFor="default_group_id">Default group</label>
            <select
              id="default_group_id"
              name="default_group_id"
              value={prefs.default_group_id}
              onChange={handlePrefsChange}
            >
              <option value="">-- None --</option>
              {(userGroups || []).map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="default_location_id">Default court</label>
            <select
              id="default_location_id"
              name="default_location_id"
              value={prefs.default_location_id}
              onChange={handlePrefsChange}
            >
              <option value="">-- None --</option>
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="usual_morning_start">Usual morning start time</label>
            <input
              type="time"
              id="usual_morning_start"
              name="usual_morning_start"
              value={prefs.usual_morning_start}
              onChange={handlePrefsChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="usual_evening_start">Usual evening start time</label>
            <input
              type="time"
              id="usual_evening_start"
              name="usual_evening_start"
              value={prefs.usual_evening_start}
              onChange={handlePrefsChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="usual_duration_min">Usual game length (minutes)</label>
            <input
              type="number"
              id="usual_duration_min"
              name="usual_duration_min"
              value={prefs.usual_duration_min}
              onChange={handlePrefsChange}
              min="30"
              max="300"
              step="15"
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={prefsSaving}>
              {prefsSaving ? 'Saving...' : 'Save preferences'}
            </button>
          </div>
        </form>
      </div>

      {/* Change Password Section */}
      <div className="profile-card card">
        <h2>Password</h2>

        {!showPasswordForm ? (
          <button
            className="btn btn-outline"
            onClick={() => setShowPasswordForm(true)}
          >
            Change Password
          </button>
        ) : (
          <>
            {passwordError && <div className="alert alert-error">{passwordError}</div>}
            {passwordSuccess && <div className="alert alert-success">{passwordSuccess}</div>}

            <form onSubmit={handlePasswordSubmit}>
              <div className="form-group">
                <label htmlFor="currentPassword">Current Password</label>
                <input
                  type="password"
                  id="currentPassword"
                  name="currentPassword"
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="newPassword">New Password</label>
                <input
                  type="password"
                  id="newPassword"
                  name="newPassword"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  required
                  minLength={6}
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm New Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  required
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                    setPasswordError('');
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
