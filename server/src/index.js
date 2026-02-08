require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./config/db');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const groupsRoutes = require('./routes/groups');
const locationsRoutes = require('./routes/locations');
const eventsRoutes = require('./routes/events');
const reservationsRoutes = require('./routes/reservations');

const app = express();

app.use(cors());
app.use(express.json());

// Serve static files from client build in production
const clientBuildPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientBuildPath));

// Health check (before other routes to avoid conflict with /:id patterns)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api', eventsRoutes);
app.use('/api', reservationsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Serve React app for all non-API routes (must be after API routes)
app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
