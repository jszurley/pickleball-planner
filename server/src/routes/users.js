const express = require('express');
const User = require('../models/User');
const GroupRequest = require('../models/GroupRequest');
const PulseResponse = require('../models/PulseResponse');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const notifications = require('../services/notificationService');

const router = express.Router();

// IMPORTANT: /me/* routes are declared before /:id routes so they aren't shadowed.

// Update the caller's pickleball preferences
router.put('/me/preferences', auth, async (req, res) => {
  try {
    const { default_group_id, default_location_id, usual_morning_start, usual_evening_start, usual_duration_min } = req.body;
    // If they set a default group, verify membership
    if (default_group_id) {
      const inGroup = await User.isInGroup(req.user.id, default_group_id);
      if (!inGroup) return res.status(400).json({ error: 'Not a member of that group' });
    }
    const updated = await User.updatePreferences(req.user.id, {
      default_group_id, default_location_id, usual_morning_start, usual_evening_start, usual_duration_min
    });
    res.json({
      default_group_id: updated.default_group_id,
      default_location_id: updated.default_location_id,
      usual_morning_start: updated.usual_morning_start,
      usual_evening_start: updated.usual_evening_start,
      usual_duration_min: updated.usual_duration_min
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// Set away mode (date range)
router.put('/me/away', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }
    if (new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({ error: 'endDate must be on or after startDate' });
    }
    const result = await User.setAway(req.user.id, startDate, endDate);
    // Flip any active-pulse responses to "out" with source=auto_away
    await PulseResponse.autoMarkOutForUser(req.user.id).catch(() => {});
    res.json(result);
  } catch (error) {
    console.error('Set away error:', error);
    res.status(500).json({ error: 'Failed to set away' });
  }
});

router.delete('/me/away', auth, async (req, res) => {
  try {
    await User.clearAway(req.user.id);
    // Remove auto_away rows so the user can re-respond on any active pulses
    await PulseResponse.removeAutoAwayForUser(req.user.id).catch(() => {});
    res.json({ away_start_date: null, away_end_date: null });
  } catch (error) {
    console.error('Clear away error:', error);
    res.status(500).json({ error: 'Failed to clear away' });
  }
});

// Store a Web Push subscription (PushSubscription JSON)
router.put('/me/push-subscription', auth, async (req, res) => {
  try {
    const sub = req.body && req.body.endpoint ? req.body : null;
    if (!sub) return res.status(400).json({ error: 'Invalid subscription' });
    await User.setPushSubscription(req.user.id, sub);
    res.json({ ok: true });
  } catch (error) {
    console.error('Save push subscription error:', error);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

router.delete('/me/push-subscription', auth, async (req, res) => {
  try {
    await User.setPushSubscription(req.user.id, null);
    res.json({ ok: true });
  } catch (error) {
    console.error('Clear push subscription error:', error);
    res.status(500).json({ error: 'Failed to clear subscription' });
  }
});

// Get pending registration requests (admin only)
router.get('/pending', auth, adminOnly, async (req, res) => {
  try {
    const users = await User.findPending();

    // Include requested group IDs for each pending user
    const usersWithRequests = await Promise.all(
      users.map(async (user) => {
        const requestedGroupIds = await GroupRequest.findRequestedGroupIds(user.id);
        return { ...user, requested_groups: requestedGroupIds };
      })
    );

    res.json(usersWithRequests);
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

    // Clean up any group requests for this user
    await GroupRequest.deleteAllForUser(id);

    const updatedUser = await User.findById(id);
    const groups = await User.getGroups(id);

    // Notify user they've been approved (fire-and-forget)
    notifications.notifyUserApproved(updatedUser, groups).catch(() => {});

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

    // Notify user before deleting (fire-and-forget)
    notifications.notifyUserRejected(user).catch(() => {});

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
