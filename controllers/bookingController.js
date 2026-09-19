/**
 * Booking Controller
 * Handles booking requests, conflict detection, auto-suggesting alternatives,
 * booking history, and passes.
 */
const Venue = require('../models/Venue');
const Booking = require('../models/Booking');
const MaintenanceBlock = require('../models/MaintenanceBlock');

/**
 * Helper: Convert time string "HH:mm" to minutes from midnight
 */
const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Helper: Check if two time ranges overlap
 */
const isTimeOverlapping = (startA, endA, startB, endB) => {
  const aStart = timeToMinutes(startA);
  const aEnd = timeToMinutes(endA);
  const bStart = timeToMinutes(startB);
  const bEnd = timeToMinutes(endB);
  return aStart < bEnd && aEnd > bStart;
};

/**
 * Helper: Find conflicting bookings or maintenance blocks for a given venue, date, and time range
 */
const findConflicts = async (venueId, bookingDate, startTime, endTime, excludeBookingId = null) => {
  // Normalize date to start of day UTC / local
  const dateObj = new Date(bookingDate);
  const startOfDay = new Date(dateObj);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(dateObj);
  endOfDay.setHours(23, 59, 59, 999);

  // 1. Check existing Approved or Pending Bookings
  const bookingQuery = {
    venue: venueId,
    bookingDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ['Approved', 'Pending'] }
  };

  if (excludeBookingId) {
    bookingQuery._id = { $ne: excludeBookingId };
  }

  const existingBookings = await Booking.find(bookingQuery);
  const conflictingBookings = existingBookings.filter((b) =>
    isTimeOverlapping(startTime, endTime, b.startTime, b.endTime)
  );

  // 2. Check Maintenance Blocks
  const maintenanceBlocks = await MaintenanceBlock.find({
    venue: venueId,
    blockDate: { $gte: startOfDay, $lte: endOfDay },
    status: 'Active'
  });

  const conflictingMaintenance = maintenanceBlocks.filter((m) =>
    isTimeOverlapping(startTime, endTime, m.startTime, m.endTime)
  );

  return {
    hasConflict: conflictingBookings.length > 0 || conflictingMaintenance.length > 0,
    conflictingBookings,
    conflictingMaintenance
  };
};

/**
 * Helper: Smart Auto-Suggestions Engine
 * Suggests:
 * 1) Alternative Venues available for the exact requested slot with sufficient capacity
 * 2) Alternative Time Slots for the requested venue on the requested date
 */
const getSmartAlternatives = async (venueId, bookingDate, startTime, endTime, attendees, requiredFacilities = []) => {
  const dateObj = new Date(bookingDate);
  const startOfDay = new Date(dateObj);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(dateObj);
  endOfDay.setHours(23, 59, 59, 999);

  const durationMinutes = timeToMinutes(endTime) - timeToMinutes(startTime);

  // --- 1. FIND ALTERNATIVE VENUES ---
  const allPotentialVenues = await Venue.find({
    _id: { $ne: venueId },
    status: 'active',
    capacity: { $gte: Number(attendees) || 1 }
  }).sort({ capacity: 1 });

  const alternativeVenues = [];

  for (const altVenue of allPotentialVenues) {
    // Check conflicts for this alternative venue at the exact requested date and time
    const { hasConflict } = await findConflicts(altVenue._id, bookingDate, startTime, endTime);
    if (!hasConflict) {
      // Calculate matching facilities count
      const matchingFacilities = altVenue.facilities.filter((f) =>
        requiredFacilities.includes(f)
      );

      alternativeVenues.push({
        venue: altVenue,
        matchingFacilitiesCount: matchingFacilities.length,
        totalCost: Math.round(((durationMinutes / 60) * altVenue.hourlyRate) * 100) / 100
      });
    }

    if (alternativeVenues.length >= 4) break; // Limit to top 4 suggestions
  }

  // --- 2. FIND ALTERNATIVE TIME SLOTS ON SAME VENUE ---
  const targetVenue = await Venue.findById(venueId);
  const alternativeSlots = [];

  if (targetVenue) {
    // Standard candidate time slots across operating hours (08:00 to 22:00)
    const candidateSlots = [
      { start: '08:30', end: '11:30', label: 'Morning Slot (08:30 AM - 11:30 AM)' },
      { start: '11:45', end: '14:45', label: 'Mid-Day Slot (11:45 AM - 02:45 PM)' },
      { start: '15:00', end: '18:00', label: 'Afternoon Slot (03:00 PM - 06:00 PM)' },
      { start: '18:30', end: '21:30', label: 'Evening Slot (06:30 PM - 09:30 PM)' }
    ];

    for (const slot of candidateSlots) {
      // Skip if it is exactly the requested slot
      if (slot.start === startTime && slot.end === endTime) continue;

      const { hasConflict } = await findConflicts(venueId, bookingDate, slot.start, slot.end);
      if (!hasConflict) {
        alternativeSlots.push({
          startTime: slot.start,
          endTime: slot.end,
          label: slot.label,
          durationHours: 3,
          totalCost: Math.round((3 * targetVenue.hourlyRate) * 100) / 100
        });
      }
    }
  }

  return {
    alternativeVenues,
    alternativeSlots
  };
};

// Render New Booking Request Form
exports.getNewBookingForm = async (req, res) => {
  try {
    const { venueId, date, startTime, endTime } = req.query;

    let selectedVenue = null;
    if (venueId) {
      selectedVenue = await Venue.findById(venueId);
    }

    const venues = await Venue.find({ status: 'active' }).sort({ name: 1 });

    // Set default date to tomorrow if not provided
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const defaultDate = date || tomorrow.toISOString().split('T')[0];

    res.render('bookings/new', {
      title: 'Request a Venue Booking',
      selectedVenue,
      venues,
      formData: {
        venueId: venueId || '',
        bookingDate: defaultDate,
        startTime: startTime || '10:00',
        endTime: endTime || '13:00',
        eventTitle: '',
        eventType: 'Seminar',
        expectedAttendees: selectedVenue ? Math.min(selectedVenue.capacity, 50) : 50,
        description: '',
        specialFacilities: [],
        specialRequests: ''
      },
      conflictInfo: null,
      suggestions: null
    });
  } catch (error) {
    console.error('Error loading booking form:', error);
    req.flash('error_msg', 'Unable to load booking form.');
    res.redirect('/venues');
  }
};

// Handle Booking Request Submission with Strict Overlap Conflict Prevention & Auto-Suggestions
exports.postCreateBooking = async (req, res) => {
  const {
    venueId,
    bookingDate,
    startTime,
    endTime,
    eventTitle,
    eventType,
    expectedAttendees,
    description,
    specialFacilities,
    specialRequests
  } = req.body;

  try {
    const venue = await Venue.findById(venueId);
    if (!venue) {
      req.flash('error_msg', 'Selected venue does not exist.');
      return res.redirect('/venues');
    }

    const venues = await Venue.find({ status: 'active' }).sort({ name: 1 });
    const facilitiesList = Array.isArray(specialFacilities)
      ? specialFacilities
      : specialFacilities
      ? [specialFacilities]
      : [];

    const formData = {
      venueId,
      bookingDate,
      startTime,
      endTime,
      eventTitle,
      eventType,
      expectedAttendees: Number(expectedAttendees),
      description,
      specialFacilities: facilitiesList,
      specialRequests
    };

    // Validation: Required fields
    if (!eventTitle || !bookingDate || !startTime || !endTime || !expectedAttendees) {
      req.flash('error_msg', 'Please fill in all required fields marked with *');
      return res.render('bookings/new', {
        title: 'Request a Venue Booking',
        selectedVenue: venue,
        venues,
        formData,
        conflictInfo: null,
        suggestions: null
      });
    }

    // Validation: Time calculations
    const startMins = timeToMinutes(startTime);
    const endMins = timeToMinutes(endTime);

    if (endMins <= startMins) {
      req.flash('error_msg', 'End time must be after the start time.');
      return res.render('bookings/new', {
        title: 'Request a Venue Booking',
        selectedVenue: venue,
        venues,
        formData,
        conflictInfo: null,
        suggestions: null
      });
    }

    const durationHours = Math.round(((endMins - startMins) / 60) * 100) / 100;
    if (durationHours < 0.5) {
      req.flash('error_msg', 'Minimum booking duration is 30 minutes.');
      return res.render('bookings/new', {
        title: 'Request a Venue Booking',
        selectedVenue: venue,
        venues,
        formData,
        conflictInfo: null,
        suggestions: null
      });
    }

    // Validation: Capacity check
    if (Number(expectedAttendees) > venue.capacity) {
      req.flash(
        'error_msg',
        `Expected attendees (${expectedAttendees}) exceeds the maximum seating capacity of ${venue.name} (${venue.capacity}).`
      );
      // Generate alternative venues with larger capacity
      const suggestions = await getSmartAlternatives(
        venue._id,
        bookingDate,
        startTime,
        endTime,
        expectedAttendees,
        facilitiesList
      );

      return res.render('bookings/new', {
        title: 'Request a Venue Booking',
        selectedVenue: venue,
        venues,
        formData,
        conflictInfo: {
          type: 'CAPACITY_EXCEEDED',
          message: `The venue capacity (${venue.capacity}) is too small for ${expectedAttendees} attendees.`
        },
        suggestions
      });
    }

    // --- STRICT CONFLICT CHECKING (CRITICAL REQUIREMENT) ---
    const conflictResult = await findConflicts(venue._id, bookingDate, startTime, endTime);

    if (conflictResult.hasConflict) {
      let conflictMessage = `The venue "${venue.name}" is already booked or unavailable on ${bookingDate} from ${startTime} to ${endTime}.`;

      if (conflictResult.conflictingMaintenance.length > 0) {
        const m = conflictResult.conflictingMaintenance[0];
        conflictMessage = `The venue "${venue.name}" is blocked for maintenance ("${m.title}") on ${bookingDate} from ${m.startTime} to ${m.endTime}.`;
      } else if (conflictResult.conflictingBookings.length > 0) {
        const b = conflictResult.conflictingBookings[0];
        conflictMessage = `Conflicting booking found: "${b.eventTitle}" (${b.startTime} - ${b.endTime}, Status: ${b.status}).`;
      }

      req.flash('error_msg', conflictMessage);

      // Trigger Stretch Goal: Smart Auto-Suggestions Engine
      const suggestions = await getSmartAlternatives(
        venue._id,
        bookingDate,
        startTime,
        endTime,
        expectedAttendees,
        facilitiesList
      );

      return res.render('bookings/new', {
        title: 'Request a Venue Booking - Conflict Detected',
        selectedVenue: venue,
        venues,
        formData,
        conflictInfo: {
          type: 'OVERLAP_CONFLICT',
          message: conflictMessage,
          details: conflictResult
        },
        suggestions
      });
    }

    // Calculate Total Cost
    const totalCost = Math.round(durationHours * venue.hourlyRate * 100) / 100;

    // Generate Unique Booking Reference
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const bookingReference = `EVT-${new Date().getFullYear()}-${randomSuffix}`;

    // Create New Booking
    const newBooking = new Booking({
      bookingReference,
      venue: venue._id,
      organiser: req.session.user.id,
      eventTitle: eventTitle.trim(),
      eventType,
      description: description ? description.trim() : '',
      expectedAttendees: Number(expectedAttendees),
      bookingDate: new Date(bookingDate),
      startTime,
      endTime,
      durationHours,
      hourlyRate: venue.hourlyRate,
      totalCost,
      specialFacilities: facilitiesList,
      specialRequests: specialRequests ? specialRequests.trim() : '',
      status: 'Pending'
    });

    await newBooking.save();

    req.flash(
      'success_msg',
      `Booking request submitted successfully! Reference: ${bookingReference}. Awaiting Admin/Venue Manager approval.`
    );
    res.redirect(`/bookings/${newBooking._id}`);
  } catch (error) {
    console.error('Error creating booking request:', error);
    req.flash('error_msg', 'An error occurred while creating your booking request.');
    res.redirect('/venues');
  }
};

// View Booking Pass / Confirmation Slip
exports.getBookingDetail = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('venue')
      .populate('organiser', 'name email organization department phone avatar')
      .populate('approvedBy', 'name email');

    if (!booking) {
      req.flash('error_msg', 'Booking not found.');
      return res.redirect('/organiser/my-bookings');
    }

    // Check authorization: Organiser who created it or Admin can view
    const isOwner = req.session.user && req.session.user.id === booking.organiser._id.toString();
    const isAdmin = req.session.user && req.session.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      req.flash('error_msg', 'Access denied to this booking record.');
      return res.redirect('/');
    }

    res.render('bookings/show', {
      title: `Booking Pass: ${booking.bookingReference} - ${booking.eventTitle}`,
      booking,
      isOwner,
      isAdmin
    });
  } catch (error) {
    console.error('Error viewing booking details:', error);
    req.flash('error_msg', 'Unable to retrieve booking details.');
    res.redirect('/organiser/my-bookings');
  }
};

// Handle Booking Cancellation (Organiser or Admin)
exports.postCancelBooking = async (req, res) => {
  const { reason } = req.body;

  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      req.flash('error_msg', 'Booking not found.');
      return res.redirect('/organiser/my-bookings');
    }

    // Check permissions
    const isOwner = req.session.user && req.session.user.id === booking.organiser.toString();
    const isAdmin = req.session.user && req.session.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      req.flash('error_msg', 'You are not authorized to cancel this booking.');
      return res.redirect('/organiser/my-bookings');
    }

    if (booking.status === 'Completed' || booking.status === 'Cancelled') {
      req.flash('error_msg', `Cannot cancel a booking that is already ${booking.status}.`);
      return res.redirect(`/bookings/${booking._id}`);
    }

    booking.status = 'Cancelled';
    booking.cancelledAt = new Date();
    booking.cancellationReason = reason || 'Cancelled by user';
    await booking.save();

    req.flash('success_msg', `Booking ${booking.bookingReference} has been cancelled.`);
    if (isAdmin) {
      res.redirect('/admin/bookings');
    } else {
      res.redirect('/organiser/my-bookings');
    }
  } catch (error) {
    console.error('Error cancelling booking:', error);
    req.flash('error_msg', 'Failed to cancel booking.');
    res.redirect('/organiser/my-bookings');
  }
};
