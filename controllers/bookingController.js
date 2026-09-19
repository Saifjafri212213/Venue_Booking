/**
 * Booking Controller
 * Handles booking requests, conflict detection, auto-suggesting alternatives,
 * payment-first workflow, dynamic UPI QR generation, countdown hold timer,
 * and proof submission.
 */
const QRCode = require('qrcode');
const Venue = require('../models/Venue');
const Booking = require('../models/Booking');
const MaintenanceBlock = require('../models/MaintenanceBlock');
const PaymentSetting = require('../models/PaymentSetting');
const { bufferToDataUri } = require('../middleware/upload');

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
 * Helper: Find conflicting bookings or maintenance blocks for a given venue, date, and time range.
 * Respects 15-minute slot hold:
 * - Approved bookings always conflict.
 * - Pending verification / Paid bookings always conflict.
 * - Unpaid bookings only conflict if their 15-minute timer is still active (paymentExpiresAt > now).
 * - Rejected or Cancelled bookings are released and do not conflict.
 */
const findConflicts = async (venueId, bookingDate, startTime, endTime, excludeBookingId = null) => {
  const dateObj = new Date(bookingDate);
  const startOfDay = new Date(dateObj);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(dateObj);
  endOfDay.setHours(23, 59, 59, 999);

  const now = new Date();

  // 1. Query active bookings on the same venue & day
  const bookingQuery = {
    venue: venueId,
    bookingDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ['Approved', 'Pending'] }
  };

  if (excludeBookingId) {
    bookingQuery._id = { $ne: excludeBookingId };
  }

  const existingBookings = await Booking.find(bookingQuery);

  const conflictingBookings = existingBookings.filter((b) => {
    // If rejected or cancelled, slot is released
    if (b.status === 'Rejected' || b.status === 'Cancelled' || b.paymentStatus === 'rejected') {
      return false;
    }

    // If unpaid and 15-minute window has expired, slot is released
    if (b.paymentStatus === 'unpaid' && b.paymentExpiresAt && now > new Date(b.paymentExpiresAt)) {
      return false;
    }

    // Check time overlap
    return isTimeOverlapping(startTime, endTime, b.startTime, b.endTime);
  });

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
 */
const getSmartAlternatives = async (venueId, bookingDate, startTime, endTime, attendees, requiredFacilities = []) => {
  const dateObj = new Date(bookingDate);
  const durationMinutes = timeToMinutes(endTime) - timeToMinutes(startTime);

  // 1. FIND ALTERNATIVE VENUES
  const allPotentialVenues = await Venue.find({
    _id: { $ne: venueId },
    status: 'active',
    capacity: { $gte: Number(attendees) || 1 }
  }).sort({ capacity: 1 });

  const alternativeVenues = [];

  for (const altVenue of allPotentialVenues) {
    const { hasConflict } = await findConflicts(altVenue._id, bookingDate, startTime, endTime);
    if (!hasConflict) {
      const matchingFacilities = altVenue.facilities.filter((f) =>
        requiredFacilities.includes(f)
      );

      alternativeVenues.push({
        venue: altVenue,
        matchingFacilitiesCount: matchingFacilities.length,
        totalCost: Math.round(((durationMinutes / 60) * altVenue.hourlyRate) * 100) / 100
      });
    }

    if (alternativeVenues.length >= 4) break;
  }

  // 2. FIND ALTERNATIVE TIME SLOTS ON SAME VENUE
  const targetVenue = await Venue.findById(venueId);
  const alternativeSlots = [];

  if (targetVenue) {
    const candidateSlots = [
      { start: '08:30', end: '11:30', label: 'Morning Slot (08:30 AM - 11:30 AM)' },
      { start: '11:45', end: '14:45', label: 'Mid-Day Slot (11:45 AM - 02:45 PM)' },
      { start: '15:00', end: '18:00', label: 'Afternoon Slot (03:00 PM - 06:00 PM)' },
      { start: '18:30', end: '21:30', label: 'Evening Slot (06:30 PM - 09:30 PM)' }
    ];

    for (const slot of candidateSlots) {
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

/**
 * Helper: Fetch Active Payment Settings from database or return default
 */
const getActivePaymentSettings = async () => {
  let settings = await PaymentSetting.findOne({ isActive: true }).sort({ updatedAt: -1 });
  if (!settings) {
    // Return standard campus payment configuration if not set yet
    settings = {
      accountHolderName: 'Campus Facilities Administration',
      bankName: 'State Bank of India',
      accountNumber: '40928172901',
      ifscCode: 'SBIN0001234',
      branchName: 'University Main Campus Branch',
      upiId: 'campusfacilities@sbi',
      customQrImage: '',
      instructions: 'Please transfer the exact booking fee and submit your 12-digit UTR/UPI transaction reference.'
    };
  }
  return settings;
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

// Handle Booking Request Creation (Initiates 15-min Slot Hold & Redirects to Payment)
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

    // Strict Conflict Checking (checks approved, pending verification, and active 15m holds)
    const conflictResult = await findConflicts(venue._id, bookingDate, startTime, endTime);

    if (conflictResult.hasConflict) {
      let conflictMessage = `The venue "${venue.name}" is already booked or held on ${bookingDate} from ${startTime} to ${endTime}.`;

      if (conflictResult.conflictingMaintenance.length > 0) {
        const m = conflictResult.conflictingMaintenance[0];
        conflictMessage = `The venue "${venue.name}" is blocked for maintenance ("${m.title}") on ${bookingDate} from ${m.startTime} to ${m.endTime}.`;
      } else if (conflictResult.conflictingBookings.length > 0) {
        const b = conflictResult.conflictingBookings[0];
        conflictMessage = `Conflicting slot found: "${b.eventTitle}" (${b.startTime} - ${b.endTime}).`;
      }

      req.flash('error_msg', conflictMessage);

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

    // 15-Minute Slot Hold Expiry
    const paymentExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Create Booking with 'unpaid' status
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
      paymentAmount: totalCost,
      paymentStatus: 'unpaid',
      paymentExpiresAt,
      specialFacilities: facilitiesList,
      specialRequests: specialRequests ? specialRequests.trim() : '',
      status: 'Pending'
    });

    await newBooking.save();

    req.flash('success_msg', 'Slot held for 15 minutes! Please complete your payment to submit your booking.');
    res.redirect(`/bookings/${newBooking._id}/payment`);
  } catch (error) {
    console.error('Error creating booking request:', error);
    req.flash('error_msg', 'An error occurred while creating your booking request.');
    res.redirect('/venues');
  }
};

// Render Payment Page with Dynamic QR Code, Bank Details & Countdown Timer
exports.getPaymentPage = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('venue')
      .populate('organiser', 'name email organization department phone');

    if (!booking) {
      req.flash('error_msg', 'Booking not found.');
      return res.redirect('/organiser/my-bookings');
    }

    // Permission check
    const isOwner = req.session.user && req.session.user.id === booking.organiser._id.toString();
    const isAdmin = req.session.user && req.session.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      req.flash('error_msg', 'Unauthorized access to payment page.');
      return res.redirect('/');
    }

    // If already paid and approved, redirect to pass
    if (booking.paymentStatus === 'paid' && booking.status === 'Approved') {
      req.flash('success_msg', 'This booking is already paid and confirmed!');
      return res.redirect(`/bookings/${booking._id}`);
    }

    const paymentSettings = await getActivePaymentSettings();

    // Calculate remaining seconds on the 15-minute countdown
    const now = new Date();
    const expiresAt = booking.paymentExpiresAt ? new Date(booking.paymentExpiresAt) : new Date(Date.now() + 15 * 60 * 1000);
    const remainingSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
    const isExpired = remainingSeconds <= 0 && booking.paymentStatus === 'unpaid';

    // Construct standard UPI payment string
    // upi://pay?pa=UPI_ID&pn=NAME&am=AMOUNT&cu=INR&tn=Booking_REF
    const upiUri = `upi://pay?pa=${paymentSettings.upiId}&pn=${encodeURIComponent(paymentSettings.accountHolderName)}&am=${booking.totalCost}&cu=INR&tn=Booking_${booking.bookingReference}`;

    // Generate dynamic QR Code Data URL
    let dynamicQrCode = '';
    try {
      dynamicQrCode = await QRCode.toDataURL(upiUri, {
        width: 280,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      });
    } catch (qrErr) {
      console.error('Error generating dynamic QR code:', qrErr);
    }

    res.render('bookings/payment', {
      title: `Complete Payment: ${booking.bookingReference}`,
      booking,
      paymentSettings,
      dynamicQrCode,
      upiUri,
      remainingSeconds,
      isExpired,
      isOwner,
      isAdmin
    });
  } catch (error) {
    console.error('Error rendering payment page:', error);
    req.flash('error_msg', 'Unable to load payment page.');
    res.redirect('/organiser/my-bookings');
  }
};

// Handle Payment Proof Submission (UTR + Screenshot)
exports.postSubmitPaymentProof = async (req, res) => {
  const { utrNumber } = req.body;

  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      req.flash('error_msg', 'Booking not found.');
      return res.redirect('/organiser/my-bookings');
    }

    // Permission check
    const isOwner = req.session.user && req.session.user.id === booking.organiser.toString();
    const isAdmin = req.session.user && req.session.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      req.flash('error_msg', 'You are not authorized to submit payment proof for this booking.');
      return res.redirect('/organiser/my-bookings');
    }

    if (!utrNumber || utrNumber.trim().length < 6) {
      req.flash('error_msg', 'Please provide a valid Bank UTR / Transaction Reference Number (min 6 characters).');
      return res.redirect(`/bookings/${booking._id}/payment`);
    }

    const cleanUtr = utrNumber.trim().toUpperCase();

    // Check UTR Uniqueness across bookings
    const duplicateUtr = await Booking.findOne({
      utrNumber: cleanUtr,
      _id: { $ne: booking._id },
      paymentStatus: { $in: ['pending_verification', 'paid'] }
    });

    if (duplicateUtr) {
      req.flash(
        'error_msg',
        `The UTR / Transaction Reference "${cleanUtr}" is already registered for booking ${duplicateUtr.bookingReference}. Please check your transaction details.`
      );
      return res.redirect(`/bookings/${booking._id}/payment`);
    }

    // Process uploaded screenshot file (if provided)
    let screenshotDataUri = booking.paymentScreenshot || '';
    if (req.file) {
      screenshotDataUri = bufferToDataUri(req.file);
    }

    // Update booking status
    booking.utrNumber = cleanUtr;
    booking.paymentScreenshot = screenshotDataUri;
    booking.paymentStatus = 'pending_verification';
    booking.paymentSubmittedAt = new Date();
    booking.status = 'Pending';
    booking.rejectionReason = ''; // Clear prior rejection reason on retry
    await booking.save();

    req.flash(
      'success_msg',
      `Payment proof submitted successfully! Reference: ${booking.bookingReference}. Your booking is now pending verification by campus administration.`
    );
    res.redirect(`/bookings/${booking._id}`);
  } catch (error) {
    console.error('Error submitting payment proof:', error);
    req.flash('error_msg', error.message || 'Failed to submit payment proof. Please try again.');
    res.redirect(`/bookings/${req.params.id}/payment`);
  }
};

// Retry Payment Flow (Refreshes 15-minute hold timer for rejected or expired bookings)
exports.getRetryPayment = async (req, res) => {
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
      req.flash('error_msg', 'Unauthorized to retry payment.');
      return res.redirect('/organiser/my-bookings');
    }

    // Reset hold window for 15 minutes
    booking.paymentExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    booking.paymentStatus = 'unpaid';
    booking.status = 'Pending';
    await booking.save();

    req.flash('success_msg', 'Slot held for 15 minutes. Please complete your payment.');
    res.redirect(`/bookings/${booking._id}/payment`);
  } catch (error) {
    console.error('Error retrying payment:', error);
    req.flash('error_msg', 'Unable to retry payment.');
    res.redirect('/organiser/my-bookings');
  }
};

// View Booking Pass / Confirmation Slip & Payment Receipt
exports.getBookingDetail = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('venue')
      .populate('organiser', 'name email organization department phone avatar')
      .populate('approvedBy', 'name email')
      .populate('paymentVerifiedBy', 'name email');

    if (!booking) {
      req.flash('error_msg', 'Booking not found.');
      return res.redirect('/organiser/my-bookings');
    }

    const isOwner = req.session.user && req.session.user.id === booking.organiser._id.toString();
    const isAdmin = req.session.user && req.session.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      req.flash('error_msg', 'Access denied to this booking record.');
      return res.redirect('/');
    }

    const paymentSettings = await getActivePaymentSettings();

    res.render('bookings/show', {
      title: `Booking Pass: ${booking.bookingReference} - ${booking.eventTitle}`,
      booking,
      paymentSettings,
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
