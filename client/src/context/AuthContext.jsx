import { createContext, useContext, useState, useEffect } from 'react';
import { getMe } from '../services/api';
import { ensurePushSubscription } from '../services/push';

const AuthContext = createContext(null);

// If the user has Notification.permission==='granted' already, silently
// re-sync the subscription on every load. Only prompt fresh after an
// explicit login.
function syncPush({ promptIfDefault }) {
  // Defer briefly so we don't compete with first paint
  setTimeout(() => {
    ensurePushSubscription({ promptIfDefault }).catch(() => {});
  }, 1500);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      loadUser();
    } else {
      setLoading(false);
    }
  }, []);

  const loadUser = async () => {
    try {
      const response = await getMe();
      setUser(response.data.user);
      setGroups(response.data.groups);
      // If permission is already granted, refresh subscription quietly.
      if (response.data.user && response.data.user.role !== 'pending') {
        syncPush({ promptIfDefault: false });
      }
    } catch (error) {
      console.error('Failed to load user:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } finally {
      setLoading(false);
    }
  };

  const loginUser = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    loadUser(); // Load full user data with groups
    // Prompt for push notifications on fresh login (only if not yet decided)
    if (userData && userData.role !== 'pending') {
      syncPush({ promptIfDefault: true });
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setGroups([]);
  };

  const isAdmin = user?.role === 'admin';
  const isPending = user?.role === 'pending';

  const value = {
    user,
    groups,
    loading,
    isAdmin,
    isPending,
    loginUser,
    logout,
    refreshUser: loadUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
