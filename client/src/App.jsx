import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import InstallPrompt from './components/InstallPrompt';
import OfflineIndicator from './components/OfflineIndicator';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import CalendarView from './pages/CalendarView';
import GroupEvents from './pages/GroupEvents';
import CreateEvent from './pages/CreateEvent';
import AdminDashboard from './pages/admin/AdminDashboard';
import ManageUsers from './pages/admin/ManageUsers';
import ManageGroups from './pages/admin/ManageGroups';
import ManageLocations from './pages/admin/ManageLocations';
import ManageEvents from './pages/admin/ManageEvents';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="app">
      {user && <Navbar />}

      <main className="container">
        <OfflineIndicator />
        <InstallPrompt />
        <Routes>
          {/* Public routes */}
          <Route
            path="/login"
            element={user ? <Navigate to="/" replace /> : <Login />}
          />
          <Route
            path="/register"
            element={user ? <Navigate to="/" replace /> : <Register />}
          />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />

          <Route
            path="/calendar"
            element={
              <ProtectedRoute>
                <CalendarView />
              </ProtectedRoute>
            }
          />

          <Route
            path="/groups/:groupId/events"
            element={
              <ProtectedRoute>
                <GroupEvents />
              </ProtectedRoute>
            }
          />

          <Route
            path="/groups/:groupId/events/new"
            element={
              <ProtectedRoute>
                <CreateEvent />
              </ProtectedRoute>
            }
          />

          <Route
            path="/groups/:groupId/events/:eventId/edit"
            element={
              <ProtectedRoute>
                <CreateEvent />
              </ProtectedRoute>
            }
          />

          {/* Admin routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute adminOnly>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/users"
            element={
              <ProtectedRoute adminOnly>
                <ManageUsers />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/groups"
            element={
              <ProtectedRoute adminOnly>
                <ManageGroups />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/locations"
            element={
              <ProtectedRoute adminOnly>
                <ManageLocations />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/events"
            element={
              <ProtectedRoute adminOnly>
                <ManageEvents />
              </ProtectedRoute>
            }
          />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
