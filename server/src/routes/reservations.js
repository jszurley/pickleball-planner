const express = require('express');
const Reservation = require('../models/Reservation');
const Event = require('../models/Event');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Reserve a spot
router.post('/events/:eventId/reserve', auth, async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if user has access to this event's group
    if (req.user.role !== 'admin') {
      const isInGroup = await User.isInGroup(req.user.id, event.group_id);
      if (!isInGroup) {
        return res.status(403).json({ error: 'You must be a member of this group to reserve' });
      }
    }

    // Check if event is in the past
    const eventDate = new Date(event.event_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (eventDate < today) {
      return res.status(400).json({ error: 'Cannot reserve for past events' });
    }

    const reservation = await Reservation.create(eventId, req.user.id);

    res.status(201).json({
      message: 'Reservation successful',
      reservation
    });
  } catch (error) {
    if (error.message === 'Event is full') {
      return res.status(400).json({ error: 'Event is full' });
    }
    if (error.message === 'Already reserved') {
      return res.status(400).json({ error: 'You already have a reservation' });
    }
    console.error('Reserve error:', error);
    res.status(500).json({ error: 'Failed to reserve spot' });
  }
});

// Cancel reservation
router.delete('/events/:eventId/reserve', auth, async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const reservation = await Reservation.delete(eventId, req.user.id);
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    res.json({ message: 'Reservation cancelled' });
  } catch (error) {
    console.error('Cancel reservation error:', error);
    res.status(500).json({ error: 'Failed to cancel reservation' });
  }
});

// List reservations for an event
router.get('/events/:eventId/reservations', auth, async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
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

    const reservations = await Reservation.findByEvent(eventId);

    res.json(reservations);
  } catch (error) {
    console.error('Get reservations error:', error);
    res.status(500).json({ error: 'Failed to get reservations' });
  }
});

module.exports = router;
