/**
 * API Routes (AJAX helper endpoints for live availability and conflict suggestions)
 */
const express = require('express');
const router = express.Router();
const Venue = require('../models/Venue');
const Booking = require('../models/Booking');
const MaintenanceBlock = require('../models/MaintenanceBlock');

const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

const isTimeOverlapping = (startA, endA, startB, endB) => {
  return timeToMinutes(startA) < timeToMinutes(endB) && timeToMinutes(endA) > timeToMinutes(startB);
};

// Check availability for a specific venue on a specific date
router.get('/venues/:id/availability', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }

    const dateObj = new Date(date);
    const startOfDay = new Date(dateObj);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateObj);
    endOfDay.setHours(23, 59, 59, 999);

    const [bookings, maintenance] = await Promise.all([
      Booking.find({
        venue: req.params.id,
        bookingDate: { $gte: startOfDay, $lte: endOfDay },
        status: { $in: ['Approved', 'Pending'] }
      }).select('eventTitle startTime endTime status eventType expectedAttendees'),
      MaintenanceBlock.find({
        venue: req.params.id,
        blockDate: { $gte: startOfDay, $lte: endOfDay },
        status: 'Active'
      }).select('title reason startTime endTime')
    ]);

    res.json({
      success: true,
      date,
      bookings,
      maintenance
    });
  } catch (error) {
    console.error('API availability error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Live check for conflict and real-time alternative suggestions
router.get('/check-conflict', async (req, res) => {
  try {
    const { venueId, date, startTime, endTime, attendees } = req.query;
    if (!venueId || !date || !startTime || !endTime) {
      return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    const dateObj = new Date(date);
    const startOfDay = new Date(dateObj);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateObj);
    endOfDay.setHours(23, 59, 59, 999);

    const [bookings, maintenance, targetVenue] = await Promise.all([
      Booking.find({
        venue: venueId,
        bookingDate: { $gte: startOfDay, $lte: endOfDay },
        status: { $in: ['Approved', 'Pending'] }
      }),
      MaintenanceBlock.find({
        venue: venueId,
        blockDate: { $gte: startOfDay, $lte: endOfDay },
        status: 'Active'
      }),
      Venue.findById(venueId)
    ]);

    const conflictingBookings = bookings.filter((b) =>
      isTimeOverlapping(startTime, endTime, b.startTime, b.endTime)
    );
    const conflictingMaintenance = maintenance.filter((m) =>
      isTimeOverlapping(startTime, endTime, m.startTime, m.endTime)
    );

    const hasConflict = conflictingBookings.length > 0 || conflictingMaintenance.length > 0;

    res.json({
      success: true,
      hasConflict,
      conflicts: {
        bookings: conflictingBookings,
        maintenance: conflictingMaintenance
      }
    });
  } catch (error) {
    console.error('API check conflict error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
