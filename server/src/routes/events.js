const express = require('express');
const Event = require('../models/Event');
const User = require('../models/User');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

const router = express.Router();

// Get events for a group
router.get('/groups/:groupId/events', auth, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { includePast } = req.query;

    // Check if user has access to this group
    if (req.user.role !== 'admin') {
      const isInGroup = await User.isInGroup(req.user.id, groupId);
      if (!isInGroup) {
        return res.status(403).json({ error: 'Access denied to this group' });
      }
    }

    let events;
    if (includePast === 'true') {
      events = await Event.findByGroupWithPast(groupId);
    } else {
      events = await Event.findByGroup(groupId);
    }

    // Add is_reserved flag for each event
    const eventsWithReservationStatus = await Promise.all(
      events.map(async (event) => {
        const Reservation = require('../models/Reservation');
        const isReserved = await Reservation.exists(event.id, req.user.id);
        return { ...event, is_reserved: isReserved };
      })
    );

    res.json(eventsWithReservationStatus);
  } catch (error) {
    console.error('Get group events error:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

// Create event for a group
router.post('/groups/:groupId/events', auth, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { title, eventDate, startTime, endTime, locationId, maxSpots } = req.body;

    // Check if user has access to this group
    if (req.user.role !== 'admin') {
      const isInGroup = await User.isInGroup(req.user.id, groupId);
      if (!isInGroup) {
        return res.status(403).json({ error: 'Access denied to this group' });
      }
    }

    if (!title || !eventDate || !startTime || !endTime || !maxSpots) {
      return res.status(400).json({
        error: 'Title, event date, start time, end time, and max spots are required'
      });
    }

    if (maxSpots < 1) {
      return res.status(400).json({ error: 'Max spots must be at least 1' });
    }

    const event = await Event.create(
      groupId,
      req.user.id,
      locationId,
      title,
      eventDate,
      startTime,
      endTime,
      maxSpots
    );

    const fullEvent = await Event.findById(event.id);

    res.status(201).json(fullEvent);
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Get user's upcoming events across all their groups
// NOTE: This must be defined BEFORE /events/:id to avoid 'user' being matched as an id
router.get('/events/user/upcoming', auth, async (req, res) => {
  try {
    const events = await Event.findUpcomingByUser(req.user.id);
    res.json(events);
  } catch (error) {
    console.error('Get upcoming events error:', error);
    res.status(500).json({ error: 'Failed to get upcoming events' });
  }
});

// Get events user has reserved
router.get('/events/user/reserved', auth, async (req, res) => {
  try {
    const events = await Event.findReservedByUser(req.user.id);
    res.json(events);
  } catch (error) {
    console.error('Get reserved events error:', error);
    res.status(500).json({ error: 'Failed to get reserved events' });
  }
});

// Get all events (admin only)
router.get('/events', auth, adminOnly, async (req, res) => {
  try {
    const events = await Event.findAll();
    res.json(events);
  } catch (error) {
    console.error('Get all events error:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

// Get single event
router.get('/events/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if user has access to this event's group
    if (req.user.role !== 'admin') {
      const isInGroup = await User.isInGroup(req.user.id, event.group_id);
      if (!isInGroup) {
        return res.status(403).json({ error: 'Access denied to this event' });
      }
    }

    const Reservation = require('../models/Reservation');
    const isReserved = await Reservation.exists(event.id, req.user.id);
    const reservations = await Reservation.findByEvent(event.id);

    res.json({ ...event, is_reserved: isReserved, reservations });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ error: 'Failed to get event' });
  }
});

// Update event (creator only)
router.put('/events/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, eventDate, startTime, endTime, locationId, maxSpots } = req.body;

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Only creator or admin can update
    if (event.creator_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only event creator can update this event' });
    }

    if (!title || !eventDate || !startTime || !endTime || !maxSpots) {
      return res.status(400).json({
        error: 'Title, event date, start time, end time, and max spots are required'
      });
    }

    // Check that max spots is not less than current reservations
    if (parseInt(maxSpots) < parseInt(event.reservation_count)) {
      return res.status(400).json({
        error: `Cannot reduce max spots below current reservation count (${event.reservation_count})`
      });
    }

    const updatedEvent = await Event.update(
      id,
      title,
      eventDate,
      startTime,
      endTime,
      locationId,
      maxSpots
    );

    const fullEvent = await Event.findById(updatedEvent.id);

    res.json(fullEvent);
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Delete event (creator or admin)
router.delete('/events/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Only creator or admin can delete
    if (event.creator_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only event creator or admin can delete this event' });
    }

    await Event.delete(id);

    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

module.exports = router;
