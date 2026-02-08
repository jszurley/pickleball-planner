import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const register = (data) => api.post('/auth/register', data);
export const login = (data) => api.post('/auth/login', data);
export const getMe = () => api.get('/auth/me');

// Profile
export const getProfile = () => api.get('/auth/profile');
export const updateProfile = (data) => api.put('/auth/profile', data);
export const changePassword = (data) => api.put('/auth/profile/password', data);

// Users (Admin)
export const getPendingUsers = () => api.get('/users/pending');
export const approveUser = (id, groupIds) => api.post(`/users/${id}/approve`, { groupIds });
export const rejectUser = (id) => api.post(`/users/${id}/reject`);
export const getUsers = () => api.get('/users');
export const updateUserGroups = (id, groupIds) => api.put(`/users/${id}/groups`, { groupIds });
export const deleteUser = (id) => api.delete(`/users/${id}`);

// Groups
export const getGroups = () => api.get('/groups');
export const getGroup = (id) => api.get(`/groups/${id}`);
export const createGroup = (data) => api.post('/groups', data);
export const updateGroup = (id, data) => api.put(`/groups/${id}`, data);
export const deleteGroup = (id) => api.delete(`/groups/${id}`);

// Locations
export const getLocations = () => api.get('/locations');
export const getLocation = (id) => api.get(`/locations/${id}`);
export const createLocation = (data) => api.post('/locations', data);
export const updateLocation = (id, data) => api.put(`/locations/${id}`, data);
export const deleteLocation = (id) => api.delete(`/locations/${id}`);

// Events
export const getGroupEvents = (groupId, includePast = false) =>
  api.get(`/groups/${groupId}/events`, { params: { includePast } });
export const createEvent = (groupId, data) => api.post(`/groups/${groupId}/events`, data);
export const createRecurringEvents = (groupId, data) => api.post(`/groups/${groupId}/events/recurring`, data);
export const getEvent = (id) => api.get(`/events/${id}`);
export const updateEvent = (id, data) => api.put(`/events/${id}`, data);
export const deleteEvent = (id) => api.delete(`/events/${id}`);
export const cloneEvent = (id, newDate) => api.post(`/events/${id}/clone`, { newDate });
export const getUpcomingEvents = () => api.get('/events/user/upcoming');
export const getReservedEvents = () => api.get('/events/user/reserved');
export const getAllEvents = () => api.get('/events');

// Reservations
export const reserveSpot = (eventId) => api.post(`/events/${eventId}/reserve`);
export const cancelReservation = (eventId) => api.delete(`/events/${eventId}/reserve`);
export const getEventReservations = (eventId) => api.get(`/events/${eventId}/reservations`);

export default api;
