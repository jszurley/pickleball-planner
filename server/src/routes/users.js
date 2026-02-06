const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

const router = express.Router();

// Get pending registration requests (admin only)
router.get('/pending', auth, adminOnly, async (req, res) => {
  try {
    const users = await User.findPending();
    res.json(users);
  } catch (error) {
    console.error('Get pending users error:', error);
    res.status(500).json({ error: 'Failed to get pending users' });
  }
});

// Approve user with group assignments (admin only)
router.post('/:id/approve', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { groupIds } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role !== 'pending') {
      return res.status(400).json({ error: 'User is not pending approval' });
    }

    await User.updateRole(id, 'member');

    if (groupIds && groupIds.length > 0) {
      await User.setGroups(id, groupIds);
    }

    const updatedUser = await User.findById(id);
    const groups = await User.getGroups(id);

    res.json({
      message: 'User approved successfully',
      user: updatedUser,
      groups
    });
  } catch (error) {
    console.error('Approve user error:', error);
    res.status(500).json({ error: 'Failed to approve user' });
  }
});

// Reject registration (admin only)
router.post('/:id/reject', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role !== 'pending') {
      return res.status(400).json({ error: 'User is not pending approval' });
    }

    await User.delete(id);

    res.json({ message: 'Registration rejected' });
  } catch (error) {
    console.error('Reject user error:', error);
    res.status(500).json({ error: 'Failed to reject user' });
  }
});

// Get all members (admin only)
router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const users = await User.findAll();

    // Get groups for each user
    const usersWithGroups = await Promise.all(
      users.map(async (user) => {
        const groups = await User.getGroups(user.id);
        return { ...user, groups };
      })
    );

    res.json(usersWithGroups);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Update user's group assignments (admin only)
router.put('/:id/groups', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { groupIds } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await User.setGroups(id, groupIds || []);

    const groups = await User.getGroups(id);

    res.json({
      message: 'User groups updated successfully',
      user,
      groups
    });
  } catch (error) {
    console.error('Update user groups error:', error);
    res.status(500).json({ error: 'Failed to update user groups' });
  }
});

// Delete a member (admin only)
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent admin from deleting themselves
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    await User.delete(id);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
