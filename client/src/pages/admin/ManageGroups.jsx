import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getGroups, createGroup, updateGroup, deleteGroup, getGroup, getLocations, getGroupRequests, approveGroupRequest, rejectGroupRequest } from '../../services/api';
import './Admin.css';

export default function ManageGroups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', locationIds: [] });
  const [viewingGroup, setViewingGroup] = useState(null);
  const [groupRequests, setGroupRequests] = useState([]);
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    loadGroups();
    loadLocations();
  }, []);

  const loadGroups = async () => {
    try {
      const response = await getGroups();
      setGroups(response.data);
    } catch (err) {
      setError('Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const loadLocations = async () => {
    try {
      const response = await getLocations();
      setLocations(response.data);
    } catch (err) {
      // Locations are optional, don't block on failure
    }
  };

  const handleOpenModal = (group = null) => {
    if (group) {
      setEditingGroup(group);
      setFormData({
        name: group.name,
        description: group.description || '',
        locationIds: (group.locations || []).map(l => l.id)
      });
    } else {
      setEditingGroup(null);
      setFormData({ name: '', description: '', locationIds: [] });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingGroup(null);
    setFormData({ name: '', description: '', locationIds: [] });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (editingGroup) {
        await updateGroup(editingGroup.id, formData);
      } else {
        await createGroup(formData);
      }
      handleCloseModal();
      loadGroups();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save group');
    }
  };

  const handleDelete = async (groupId) => {
    if (!confirm('Are you sure you want to delete this group? All associated events will be deleted.')) {
      return;
    }

    try {
      await deleteGroup(groupId);
      loadGroups();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete group');
    }
  };

  const handleViewGroup = async (groupId) => {
    try {
      const [groupRes, requestsRes] = await Promise.all([
        getGroup(groupId),
        getGroupRequests(groupId)
      ]);
      setViewingGroup(groupRes.data);
      setGroupRequests(requestsRes.data);
    } catch (err) {
      setError('Failed to load group details');
    }
  };

  const handleApproveRequest = async (groupId, userId) => {
    try {
      await approveGroupRequest(groupId, userId);
      await handleViewGroup(groupId);
      loadGroups();
    } catch (err) {
      setError('Failed to approve request');
    }
  };

  const handleRejectRequest = async (groupId, userId) => {
    try {
      await rejectGroupRequest(groupId, userId);
      await handleViewGroup(groupId);
      loadGroups();
    } catch (err) {
      setError('Failed to reject request');
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="admin-page">
      <Link to="/admin" className="back-link">
        &larr; Back to Admin
      </Link>

      <div className="page-header">
        <h1>Manage Groups</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="admin-section">
        <div className="admin-section-header">
          <h2>Groups ({groups.length})</h2>
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            Add Group
          </button>
        </div>

        {groups.length === 0 ? (
          <div className="empty-state">
            <p>No groups yet.</p>
            <button className="btn btn-primary" onClick={() => handleOpenModal()}>
              Create your first group
            </button>
          </div>
        ) : (
          <div className="grid grid-2">
            {groups.map((group) => (
              <div key={group.id} className="card">
                <h3>
                  {group.name}
                  {group.request_count > 0 && (
                    <span className="badge badge-warning" style={{ marginLeft: '0.5rem' }}>
                      {group.request_count} request{group.request_count !== 1 ? 's' : ''}
                    </span>
                  )}
                </h3>
                {group.description && (
                  <p className="text-muted">{group.description}</p>
                )}
                {group.locations && group.locations.length > 0 && (
                  <div className="group-locations-list">
                    {group.locations.map(loc => (
                      <span key={loc.id} className="badge badge-outline">{loc.name}</span>
                    ))}
                  </div>
                )}
                <div className="flex gap-1 mt-2">
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => handleViewGroup(group.id)}
                  >
                    View Members
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => handleOpenModal(group)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(group.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingGroup ? 'Edit Group' : 'Create Group'}</h2>
              <button className="modal-close" onClick={handleCloseModal}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label htmlFor="name">Name</label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Description (optional)</label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              {locations.length > 0 && (
                <div className="form-group">
                  <label>Locations</label>
                  <div className="checkbox-group">
                    {locations.map((loc) => (
                      <label key={loc.id} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={formData.locationIds.includes(loc.id)}
                          onChange={(e) => {
                            const ids = e.target.checked
                              ? [...formData.locationIds, loc.id]
                              : formData.locationIds.filter(id => id !== loc.id);
                            setFormData({ ...formData, locationIds: ids });
                          }}
                        />
                        {loc.name}{loc.address ? ` — ${loc.address}` : ''}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingGroup ? 'Save' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Members Modal */}
      {viewingGroup && (
        <div className="modal-overlay" onClick={() => { setViewingGroup(null); setGroupRequests([]); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{viewingGroup.name} Members</h2>
              <button className="modal-close" onClick={() => { setViewingGroup(null); setGroupRequests([]); }}>
                &times;
              </button>
            </div>

            {groupRequests.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <h3>Join Requests ({groupRequests.length})</h3>
                <div className="pending-users">
                  {groupRequests.map((request) => (
                    <div key={request.id} className="pending-user-card">
                      <div className="pending-user-info">
                        <h3>{request.user_name}</h3>
                        <p>{request.user_email}</p>
                      </div>
                      <div className="pending-user-actions">
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleApproveRequest(viewingGroup.id, request.user_id)}
                        >
                          Approve
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleRejectRequest(viewingGroup.id, request.user_id)}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <h3>Members</h3>
            {viewingGroup.members && viewingGroup.members.length > 0 ? (
              <ul className="attendees-list" style={{ paddingLeft: '1.5rem' }}>
                {viewingGroup.members.map((member) => (
                  <li key={member.id}>
                    {member.name} ({member.email})
                    {member.role === 'admin' && (
                      <span className="badge badge-primary" style={{ marginLeft: '0.5rem' }}>
                        Admin
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">No members in this group.</p>
            )}

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => { setViewingGroup(null); setGroupRequests([]); }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
