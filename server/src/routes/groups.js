const express = require('express');
const Group = require('../models/Group');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

const router = express.Router();

// List groups - members see only their groups, admins see all
router.get('/', auth, async (req, res) => {
  try {
    let groups;

    if (req.user.role === 'admin') {
      groups = await Group.findAll();
    } else {
      groups = await Group.findByUser(req.user.id);
    }

    res.json(groups);
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ error: 'Failed to get groups' });
  }
});

// Get single group
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if user has access to this group
    if (req.user.role !== 'admin') {
      const userGroups = await Group.findByUser(req.user.id);
      const hasAccess = userGroups.some(g => g.id === parseInt(id));
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this group' });
      }
    }

    const members = await Group.getMembers(id);

    res.json({ ...group, members });
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ error: 'Failed to get group' });
  }
});

// Create group (admin only)
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    const group = await Group.create(name, description);

    res.status(201).json(group);
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// Update group (admin only)
router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const updatedGroup = await Group.update(id, name, description);

    res.json(updatedGroup);
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// Delete group (admin only)
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    await Group.delete(id);

    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

module.exports = router;
