const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Register - creates pending user
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const user = await User.create(email, password, name);

    res.status(201).json({
      message: 'Registration submitted. Please wait for admin approval.',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await User.comparePassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.role === 'pending') {
      return res.status(403).json({ error: 'Your account is pending approval' });
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Reset password (requires setup key for security)
router.post('/reset-password', async (req, res) => {
  try {
    const { email, newPassword, setupKey } = req.body;

    // Require setup key for security
    if (setupKey !== process.env.JWT_SECRET) {
      return res.status(403).json({ error: 'Invalid setup key' });
    }

    if (!email || !newPassword) {
      return res.status(400).json({ error: 'Email and new password required' });
    }

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Hash new password and update
    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const pool = require('../config/db');
    await pool.query("UPDATE users SET password_hash = $1 WHERE email = $2", [passwordHash, email]);

    res.json({ message: 'Password reset successful. Please log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

// One-time setup: Promote first user to admin (only works if no admins exist)
router.post('/setup-admin', async (req, res) => {
  try {
    const { email, setupKey } = req.body;

    // Require setup key for security
    if (setupKey !== process.env.JWT_SECRET) {
      return res.status(403).json({ error: 'Invalid setup key' });
    }

    // Check if any admin already exists
    const pool = require('../config/db');
    const admins = await pool.query("SELECT id FROM users WHERE role = 'admin'");
    if (admins.rows.length > 0) {
      return res.status(400).json({ error: 'Admin already exists. Setup disabled.' });
    }

    // Promote the user
    await pool.query("UPDATE users SET role = 'admin' WHERE email = $1", [email]);

    res.json({ message: 'Admin setup complete. Please log in again.' });
  } catch (error) {
    console.error('Setup admin error:', error);
    res.status(500).json({ error: 'Setup failed' });
  }
});

// Get current user info with groups
router.get('/me', auth, async (req, res) => {
  try {
    const groups = await User.getGroups(req.user.id);

    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role
      },
      groups
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

module.exports = router;
