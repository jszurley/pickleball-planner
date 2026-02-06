import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPendingUsers, getUsers, getGroups, getAllEvents } from '../../services/api';
import './Admin.css';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    pendingCount: 0,
    memberCount: 0,
    groupCount: 0,
    upcomingEventCount: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [pendingRes, usersRes, groupsRes, eventsRes] = await Promise.all([
        getPendingUsers(),
        getUsers(),
        getGroups(),
        getAllEvents()
      ]);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const upcomingEvents = eventsRes.data.filter(
        (e) => new Date(e.event_date) >= today
      );

      setStats({
        pendingCount: pendingRes.data.length,
        memberCount: usersRes.data.length,
        groupCount: groupsRes.data.length,
        upcomingEventCount: upcomingEvents.length
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="admin-dashboard">
      <div className="page-header">
        <h1>Admin Dashboard</h1>
        <p>Manage users, groups, and locations</p>
      </div>

      <div className="stats-grid">
        <Link to="/admin/users" className="stat-card">
          <div className="stat-value">{stats.pendingCount}</div>
          <div className="stat-label">Pending Requests</div>
          {stats.pendingCount > 0 && (
            <span className="stat-badge">Needs attention</span>
          )}
        </Link>

        <Link to="/admin/users" className="stat-card">
          <div className="stat-value">{stats.memberCount}</div>
          <div className="stat-label">Members</div>
        </Link>

        <Link to="/admin/groups" className="stat-card">
          <div className="stat-value">{stats.groupCount}</div>
          <div className="stat-label">Groups</div>
        </Link>

        <div className="stat-card">
          <div className="stat-value">{stats.upcomingEventCount}</div>
          <div className="stat-label">Upcoming Events</div>
        </div>
      </div>

      <div className="admin-nav">
        <h2>Manage</h2>
        <div className="admin-nav-grid">
          <Link to="/admin/users" className="admin-nav-card">
            <h3>Users</h3>
            <p>Approve registrations and manage member groups</p>
          </Link>

          <Link to="/admin/groups" className="admin-nav-card">
            <h3>Groups</h3>
            <p>Create and manage pickleball groups</p>
          </Link>

          <Link to="/admin/locations" className="admin-nav-card">
            <h3>Locations</h3>
            <p>Manage play locations</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
