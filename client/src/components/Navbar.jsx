import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          Pickleball Play
        </Link>

        {user && (
          <>
            <div className="navbar-links">
              <Link to="/">Dashboard</Link>
              <Link to="/calendar">Calendar</Link>
              {isAdmin && <Link to="/admin">Admin</Link>}
            </div>

            <div className="navbar-user">
              <span className="user-name">{user.name}</span>
              {isAdmin && <span className="badge badge-primary">Admin</span>}
              <button onClick={handleLogout} className="btn btn-outline btn-sm">
                Logout
              </button>
            </div>
          </>
        )}
      </div>
    </nav>
  );
}
