import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getActivePulse } from '../services/api';
import ActivePulseCard from '../components/ActivePulseCard';
import StartPulseCard from '../components/StartPulseCard';
import AwayBanner from '../components/AwayBanner';
import './Dashboard.css';

export default function Dashboard() {
  const { user, groups: userGroups } = useAuth();
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [pulse, setPulse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
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
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Pick the active group: user.default_group_id, else first group
  useEffect(() => {
    if (activeGroupId) return;
    if (user?.default_group_id) {
      setActiveGroupId(user.default_group_id);
    } else if (userGroups && userGroups.length > 0) {
      setActiveGroupId(userGroups[0].id);
    }
  }, [user, userGroups, activeGroupId]);

  const refresh = useCallback(async () => {
    if (!activeGroupId) {
      setLoading(false);
      return;
    }
    try {
      const res = await getActivePulse(activeGroupId);
      setPulse(res.data.pulse);
    } catch (err) {
      console.error('Failed to load active pulse:', err);
    } finally {
      setLoading(false);
    }
  }, [activeGroupId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll for changes while we're on this page
  useEffect(() => {
    if (!activeGroupId) return;
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [activeGroupId, refresh]);

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

  const isPending = user?.role === 'pending';
  const hasGroups = userGroups && userGroups.length > 0;

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="page-header">
          <h1>Hi, {user?.name?.split(' ')[0] || user?.name}</h1>
          <p>Tap a button. Get to the courts.</p>
        </div>
        <Link to="/profile" className="profile-button">
          <span className="profile-avatar-small">{user?.name?.charAt(0).toUpperCase()}</span>
          <span className="profile-text">Profile</span>
        </Link>
      </div>

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
            <button className="btn btn-outline btn-sm" onClick={() => setShowInstallBanner(false)}>Maybe Later</button>
            <button className="btn btn-primary" onClick={handleInstall}>Install App</button>
          </div>
        </div>
      )}

      {isPending && (
        <div className="card">
          <p className="text-muted">Your account is awaiting admin approval.</p>
        </div>
      )}

      {!isPending && !hasGroups && (
        <div className="card">
          <p className="text-muted">You're not in any groups yet. <Link to="/groups/browse">Browse groups</Link> to join.</p>
        </div>
      )}

      {!isPending && hasGroups && (
        <>
          {userGroups.length > 1 && (
            <div className="group-selector-row">
              <label htmlFor="pulse-group-select">Group:</label>
              <select
                id="pulse-group-select"
                value={activeGroupId || ''}
                onChange={(e) => setActiveGroupId(parseInt(e.target.value, 10))}
              >
                {userGroups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}

          {pulse ? (
            <ActivePulseCard
              pulse={pulse}
              onUpdate={(updated) => {
                if (updated) setPulse(updated);
                else refresh();
              }}
            />
          ) : (
            <StartPulseCard
              groupId={activeGroupId}
              onCreated={(newPulse) => setPulse(newPulse)}
            />
          )}

          <AwayBanner />

          <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem' }}>
            <Link to="/schedule" className="view-all-link">Schedule a formal event &rarr;</Link>
          </div>
        </>
      )}
    </div>
  );
}
