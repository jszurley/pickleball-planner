import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getPendingUsers,
  getUsers,
  getGroups,
  approveUser,
  rejectUser,
  updateUserGroups,
  deleteUser
} from '../../services/api';
import './Admin.css';

export default function ManageUsers() {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [members, setMembers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedGroups, setSelectedGroups] = useState({});
  const [editingUser, setEditingUser] = useState(null);
  const [editGroups, setEditGroups] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [pendingRes, usersRes, groupsRes] = await Promise.all([
        getPendingUsers(),
        getUsers(),
        getGroups()
      ]);
      setPendingUsers(pendingRes.data);
      setMembers(usersRes.data);
      setGroups(groupsRes.data);

      // Initialize selected groups for pending users
      const initialSelected = {};
      pendingRes.data.forEach((user) => {
        initialSelected[user.id] = [];
      });
      setSelectedGroups(initialSelected);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleGroupToggle = (userId, groupId) => {
    setSelectedGroups((prev) => {
      const current = prev[userId] || [];
      if (current.includes(groupId)) {
        return { ...prev, [userId]: current.filter((id) => id !== groupId) };
      } else {
        return { ...prev, [userId]: [...current, groupId] };
      }
    });
  };

  const handleApprove = async (userId) => {
    try {
      await approveUser(userId, selectedGroups[userId] || []);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to approve user');
    }
  };

  const handleReject = async (userId) => {
    if (!confirm('Are you sure you want to reject this registration?')) return;
    try {
      await rejectUser(userId);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reject user');
    }
  };

  const handleEditGroups = (user) => {
    setEditingUser(user);
    setEditGroups(user.groups.map((g) => g.id));
  };

  const handleEditGroupToggle = (groupId) => {
    setEditGroups((prev) => {
      if (prev.includes(groupId)) {
        return prev.filter((id) => id !== groupId);
      } else {
        return [...prev, groupId];
      }
    });
  };

  const handleSaveGroups = async () => {
    try {
      await updateUserGroups(editingUser.id, editGroups);
      setEditingUser(null);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update groups');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to remove this member?')) return;
    try {
      await deleteUser(userId);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete user');
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
        <h1>Manage Users</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Pending Users Section */}
      <div className="admin-section">
        <div className="admin-section-header">
          <h2>Pending Requests ({pendingUsers.length})</h2>
        </div>

        {pendingUsers.length === 0 ? (
          <div className="card">
            <p className="text-muted">No pending registration requests.</p>
          </div>
        ) : (
          <div className="pending-users">
            {pendingUsers.map((user) => (
              <div key={user.id} className="pending-user-card">
                <div className="pending-user-info">
                  <h3>{user.name}</h3>
                  <p>{user.email}</p>
                  <p>Requested: {new Date(user.created_at).toLocaleDateString()}</p>

                  <div className="group-select">
                    {groups.map((group) => (
                      <label key={group.id} className="group-checkbox">
                        <input
                          type="checkbox"
                          checked={(selectedGroups[user.id] || []).includes(group.id)}
                          onChange={() => handleGroupToggle(user.id, group.id)}
                        />
                        {group.name}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="pending-user-actions">
                  <button
                    className="btn btn-primary"
                    onClick={() => handleApprove(user.id)}
                  >
                    Approve
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleReject(user.id)}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Members Section */}
      <div className="admin-section">
        <div className="admin-section-header">
          <h2>Members ({members.length})</h2>
        </div>

        {members.length === 0 ? (
          <div className="card">
            <p className="text-muted">No members yet.</p>
          </div>
        ) : (
          <div className="users-table table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Groups</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>
                      <span className={`badge ${user.role === 'admin' ? 'badge-primary' : 'badge-secondary'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td>
                      <div className="user-groups">
                        {user.groups && user.groups.length > 0 ? (
                          user.groups.map((g) => (
                            <span key={g.id} className="badge badge-secondary">
                              {g.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-muted">None</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => handleEditGroups(user)}
                        >
                          Edit Groups
                        </button>
                        {user.role !== 'admin' && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteUser(user.id)}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Groups Modal */}
      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Groups for {editingUser.name}</h2>
              <button className="modal-close" onClick={() => setEditingUser(null)}>
                &times;
              </button>
            </div>

            <div className="modal-form">
              <div className="checkbox-grid">
                {groups.map((group) => (
                  <label key={group.id} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={editGroups.includes(group.id)}
                      onChange={() => handleEditGroupToggle(group.id)}
                    />
                    {group.name}
                  </label>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setEditingUser(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveGroups}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
