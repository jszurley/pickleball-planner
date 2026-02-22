import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { browseGroups, requestGroup, cancelGroupRequest } from '../services/api';
import './BrowseGroups.css';

export default function BrowseGroups() {
  const { isPending } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const response = await browseGroups();
      setGroups(response.data);
    } catch (err) {
      setError('Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async (groupId) => {
    setActionLoading(groupId);
    setError('');
    try {
      await requestGroup(groupId);
      await loadGroups();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to request group');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelRequest = async (groupId) => {
    setActionLoading(groupId);
    setError('');
    try {
      await cancelGroupRequest(groupId);
      await loadGroups();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel request');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="browse-groups-page">
      <div className="page-header">
        <h1>Browse Groups</h1>
      </div>

      {isPending && (
        <div className="alert alert-info">
          Your account is awaiting admin approval. Browse the available groups below and request to join the ones you're interested in.
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {groups.length === 0 ? (
        <div className="card">
          <p className="text-muted">No groups available yet.</p>
        </div>
      ) : (
        <div className="groups-grid">
          {groups.map((group) => (
            <div key={group.id} className={`group-card ${group.is_member ? 'member' : ''}`}>
              <div className="group-card-header">
                <h3>{group.name}</h3>
                {group.is_member && <span className="badge badge-primary">Member</span>}
                {group.has_requested && <span className="badge badge-warning">Requested</span>}
              </div>

              {group.description && (
                <p className="group-description">{group.description}</p>
              )}

              {group.locations && group.locations.length > 0 && (
                <div className="group-locations">
                  {group.locations.map(loc => (
                    <div key={loc.id} className="group-location-item">
                      <span className="location-name">{loc.name}</span>
                      {loc.address && <span className="location-address">{loc.address}</span>}
                    </div>
                  ))}
                </div>
              )}

              <div className="group-card-footer">
                <span className="member-count">
                  {group.member_count} member{group.member_count !== 1 ? 's' : ''}
                </span>

                {group.is_member ? (
                  <span className="group-status-text">You're in this group</span>
                ) : group.has_requested ? (
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => handleCancelRequest(group.id)}
                    disabled={actionLoading === group.id}
                  >
                    {actionLoading === group.id ? 'Cancelling...' : 'Cancel Request'}
                  </button>
                ) : (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleRequest(group.id)}
                    disabled={actionLoading === group.id}
                  >
                    {actionLoading === group.id ? 'Requesting...' : 'Request to Join'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
