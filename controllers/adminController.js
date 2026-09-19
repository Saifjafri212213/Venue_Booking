/**
 * Admin / Venue Manager Controller
 * Handles venue CRUD, booking approvals, payment verifications, payment gateway settings,
 * maintenance date blocking, utilization analytics, and revenue metrics.
 */
const Venue = require('../models/Venue');
const Booking = require('../models/Booking');
const MaintenanceBlock = require('../models/MaintenanceBlock');
const PaymentSetting = require('../models/PaymentSetting');
const User = require('../models/User');
const { bufferToDataUri } = require('../middleware/upload');

// Helper to get start and end of a specific date
const getDayBounds = (date = new Date()) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

// Admin Main Dashboard
exports.getDashboard = async (req, res) => {
  try {
    const todayBounds = getDayBounds(new Date());

    // 1. General Key Metrics
    const [
      totalVenues,
      activeVenues,
      totalBookings,
      pendingRequestsCount,
      approvedBookingsCount,
      completedBookingsCount,
      pendingVerificationCount,
      todayEvents,
      allApprovedOrCompleted
    ] = await Promise.all([
      Venue.countDocuments(),
      Venue.countDocuments({ status: 'active' }),
      Booking.countDocuments(),
      Booking.countDocuments({ status: 'Pending' }),
      Booking.countDocuments({ status: 'Approved' }),
      Booking.countDocuments({ status: 'Completed' }),
      Booking.countDocuments({ paymentStatus: 'pending_verification' }),
      Booking.find({
        bookingDate: { $gte: todayBounds.start, $lte: todayBounds.end },
        status: { $in: ['Approved', 'Completed'] }
      })
        .populate('venue')
        .populate('organiser', 'name email organization department')
        .sort({ startTime: 1 }),
      Booking.find({ status: { $in: ['Approved', 'Completed'] } }).populate('venue')
    ]);

    // Calculate Total Revenue
    const totalRevenue = allApprovedOrCompleted.reduce((sum, b) => sum + (b.totalCost || 0), 0);
    const pendingRevenue = (await Booking.find({ status: 'Pending' })).reduce(
      (sum, b) => sum + (b.totalCost || 0),
      0
    );

    // Pending requests for quick approval widget
    const pendingBookings = await Booking.find({ status: 'Pending' })
      .populate('venue')
      .populate('organiser', 'name email organization department phone')
      .sort({ createdAt: -1 })
      .limit(6);

    // Upcoming approved events (Next 7 days)
    const upcomingEvents = await Booking.find({
      bookingDate: { $gt: todayBounds.end },
      status: 'Approved'
    })
      .populate('venue')
      .populate('organiser', 'name email organization')
      .sort({ bookingDate: 1, startTime: 1 })
      .limit(6);

    // Calculate Venue-wise Utilisation & Revenue Breakdown
    const venues = await Venue.find();
    const venueStats = venues.map((venue) => {
      const venueBookings = allApprovedOrCompleted.filter(
        (b) => b.venue && b.venue._id.toString() === venue._id.toString()
      );
      const totalHours = venueBookings.reduce((sum, b) => sum + (b.durationHours || 0), 0);
      const venueRevenue = venueBookings.reduce((sum, b) => sum + (b.totalCost || 0), 0);
      const baseAvailableHours = 420;
      const utilizationRate = Math.min(100, Math.round((totalHours / baseAvailableHours) * 100));

      return {
        id: venue._id,
        name: venue.name,
        code: venue.code,
        category: venue.category,
        capacity: venue.capacity,
        totalBookings: venueBookings.length,
        totalHours,
        revenue: venueRevenue,
        utilizationRate
      };
    });

    const chartLabels = venueStats.map((v) => v.code || v.name.substring(0, 12));
    const chartUtilization = venueStats.map((v) => v.utilizationRate);
    const chartRevenue = venueStats.map((v) => v.revenue);

    res.render('admin/dashboard', {
      title: 'Admin Control Center - Campus Venue Booking',
      metrics: {
        totalVenues,
        activeVenues,
        totalBookings,
        pendingRequestsCount,
        approvedBookingsCount,
        completedBookingsCount,
        pendingVerificationCount,
        totalRevenue,
        pendingRevenue,
        todayEventsCount: todayEvents.length
      },
      pendingBookings,
      upcomingEvents,
      todayEvents,
      venueStats,
      charts: {
        labels: JSON.stringify(chartLabels),
        utilization: JSON.stringify(chartUtilization),
        revenue: JSON.stringify(chartRevenue)
      }
    });
  } catch (error) {
    console.error('Error in Admin Dashboard controller:', error);
    req.flash('error_msg', 'Failed to load administrator dashboard data.');
    res.redirect('/');
  }
};

// Render Admin Venue List
exports.getVenuesList = async (req, res) => {
  try {
    const venues = await Venue.find().sort({ createdAt: -1 });

    const bookingCounts = await Booking.aggregate([
      { $group: { _id: '$venue', count: { $sum: 1 } } }
    ]);
    const countMap = {};
    bookingCounts.forEach((bc) => {
      if (bc._id) countMap[bc._id.toString()] = bc.count;
    });

    const enrichedVenues = venues.map((v) => ({
      ...v.toObject(),
      bookingsCount: countMap[v._id.toString()] || 0
    }));

    res.render('admin/venues/index', {
      title: 'Manage Campus Venues - Admin',
      venues: enrichedVenues
    });
  } catch (error) {
    console.error('Error fetching venues for admin:', error);
    req.flash('error_msg', 'Could not retrieve venues catalogue.');
    res.redirect('/admin/dashboard');
  }
};

// Render Venue Creation Form
exports.getVenueCreateForm = (req, res) => {
  res.render('admin/venues/form', {
    title: 'Add New Campus Venue - Admin',
    venue: null,
    isEdit: false,
    availableFacilities: [
      'Projector & Screen',
      'Surround Sound Audio',
      'Stage Lighting',
      'Central AC',
      'High-Speed Wi-Fi',
      'Podiums & Microphones',
      'VIP Green Room',
      'Wheelchair Accessible',
      'Parking Access',
      'Tiered Seating',
      'Smart Digital Podium',
      'Workstations & High-End GPUs',
      'Live Streaming Setup',
      'Conference Call & Zoom Room'
    ]
  });
};

// Handle Venue Creation
exports.postCreateVenue = async (req, res) => {
  const {
    name,
    code,
    category,
    capacity,
    location,
    building,
    floor,
    hourlyRate,
    featuredImage,
    description,
    openTime,
    closeTime,
    facilities,
    rules,
    featured,
    status
  } = req.body;

  try {
    const existing = await Venue.findOne({ code: code.toUpperCase().trim() });
    if (existing) {
      req.flash('error_msg', `Venue code "${code}" already in use by "${existing.name}".`);
      return res.redirect('/admin/venues/new');
    }

    const facilitiesArray = Array.isArray(facilities)
      ? facilities
      : facilities
      ? [facilities]
      : [];

    const rulesArray = rules
      ? rules
          .split('\n')
          .map((r) => r.trim())
          .filter((r) => r.length > 0)
      : [];

    const newVenue = new Venue({
      name: name.trim(),
      code: code.toUpperCase().trim(),
      category: category || 'Auditorium',
      capacity: Number(capacity),
      location: location.trim(),
      building: building ? building.trim() : 'Academic Wing',
      floor: floor ? floor.trim() : 'Ground Floor',
      hourlyRate: Number(hourlyRate),
      description: description.trim(),
      featuredImage: featuredImage || 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=80',
      facilities: facilitiesArray,
      operatingHours: {
        openTime: openTime || '08:00',
        closeTime: closeTime || '22:00'
      },
      rules: rulesArray,
      featured: featured === 'on' || featured === 'true',
      status: status || 'active'
    });

    await newVenue.save();
    req.flash('success_msg', `Venue "${newVenue.name}" successfully created and made available for reservations!`);
    res.redirect('/admin/venues');
  } catch (error) {
    console.error('Error creating venue:', error);
    req.flash('error_msg', error.message || 'Failed to create venue.');
    res.redirect('/admin/venues/new');
  }
};

// Render Venue Edit Form
exports.getVenueEditForm = async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id);
    if (!venue) {
      req.flash('error_msg', 'Venue not found.');
      return res.redirect('/admin/venues');
    }

    res.render('admin/venues/form', {
      title: `Edit Venue: ${venue.name} - Admin`,
      venue,
      isEdit: true,
      availableFacilities: [
        'Projector & Screen',
        'Surround Sound Audio',
        'Stage Lighting',
        'Central AC',
        'High-Speed Wi-Fi',
        'Podiums & Microphones',
        'VIP Green Room',
        'Wheelchair Accessible',
        'Parking Access',
        'Tiered Seating',
        'Smart Digital Podium',
        'Workstations & High-End GPUs',
        'Live Streaming Setup',
        'Conference Call & Zoom Room'
      ]
    });
  } catch (error) {
    console.error('Error fetching venue for editing:', error);
    req.flash('error_msg', 'Unable to retrieve venue for edit.');
    res.redirect('/admin/venues');
  }
};

// Handle Venue Update
exports.postUpdateVenue = async (req, res) => {
  const {
    name,
    code,
    category,
    capacity,
    location,
    building,
    floor,
    hourlyRate,
    featuredImage,
    description,
    openTime,
    closeTime,
    facilities,
    rules,
    featured,
    status
  } = req.body;

  try {
    const venue = await Venue.findById(req.params.id);
    if (!venue) {
      req.flash('error_msg', 'Venue not found.');
      return res.redirect('/admin/venues');
    }

    const duplicate = await Venue.findOne({
      code: code.toUpperCase().trim(),
      _id: { $ne: venue._id }
    });

    if (duplicate) {
      req.flash('error_msg', `Venue code "${code}" already in use by another venue.`);
      return res.redirect(`/admin/venues/${venue._id}/edit`);
    }

    const facilitiesArray = Array.isArray(facilities)
      ? facilities
      : facilities
      ? [facilities]
      : [];

    const rulesArray = rules
      ? rules
          .split('\n')
          .map((r) => r.trim())
          .filter((r) => r.length > 0)
      : [];

    venue.name = name.trim();
    venue.code = code.toUpperCase().trim();
    venue.category = category;
    venue.capacity = Number(capacity);
    venue.location = location.trim();
    venue.building = building ? building.trim() : venue.building;
    venue.floor = floor ? floor.trim() : venue.floor;
    venue.hourlyRate = Number(hourlyRate);
    venue.description = description.trim();
    if (featuredImage) venue.featuredImage = featuredImage.trim();
    venue.facilities = facilitiesArray;
    venue.operatingHours = {
      openTime: openTime || '08:00',
      closeTime: closeTime || '22:00'
    };
    venue.rules = rulesArray;
    venue.featured = featured === 'on' || featured === 'true';
    venue.status = status || 'active';

    await venue.save();
    req.flash('success_msg', `Venue "${venue.name}" updated successfully.`);
    res.redirect('/admin/venues');
  } catch (error) {
    console.error('Error updating venue:', error);
    req.flash('error_msg', error.message || 'Failed to update venue.');
    res.redirect(`/admin/venues/${req.params.id}/edit`);
  }
};

// Handle Venue Delete / Deactivate
exports.postDeleteVenue = async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id);
    if (!venue) {
      req.flash('error_msg', 'Venue not found.');
      return res.redirect('/admin/venues');
    }

    const activeBookings = await Booking.countDocuments({
      venue: venue._id,
      status: { $in: ['Approved', 'Pending'] }
    });

    if (activeBookings > 0) {
      venue.status = 'inactive';
      await venue.save();
      req.flash(
        'success_msg',
        `Venue "${venue.name}" has ${activeBookings} active booking(s). It has been safely deactivated instead of deleted.`
      );
    } else {
      await Venue.findByIdAndDelete(venue._id);
      req.flash('success_msg', `Venue "${venue.name}" has been permanently removed.`);
    }

    res.redirect('/admin/venues');
  } catch (error) {
    console.error('Error deleting venue:', error);
    req.flash('error_msg', 'Failed to delete venue.');
    res.redirect('/admin/venues');
  }
};

// Handle Booking Requests Management & Approval Inbox with Payment Statuses
exports.getBookingsList = async (req, res) => {
  try {
    const { status, venueId, paymentStatus } = req.query;
    const filter = {};

    if (status && status !== 'All') {
      filter.status = status;
    }
    if (paymentStatus && paymentStatus !== 'All') {
      filter.paymentStatus = paymentStatus;
    }
    if (venueId && venueId !== 'All') {
      filter.venue = venueId;
    }

    const [bookings, venues, counts] = await Promise.all([
      Booking.find(filter)
        .populate('venue')
        .populate('organiser', 'name email organization department phone')
        .populate('approvedBy', 'name')
        .populate('paymentVerifiedBy', 'name')
        .sort({ createdAt: -1 }),
      Venue.find().sort({ name: 1 }),
      Promise.all([
        Booking.countDocuments(),
        Booking.countDocuments({ paymentStatus: 'pending_verification' }),
        Booking.countDocuments({ status: 'Pending' }),
        Booking.countDocuments({ status: 'Approved' }),
        Booking.countDocuments({ status: 'Completed' }),
        Booking.countDocuments({ status: 'Rejected' }),
        Booking.countDocuments({ status: 'Cancelled' }),
        Booking.countDocuments({ paymentStatus: 'unpaid' })
      ])
    ]);

    const statusCounts = {
      all: counts[0],
      pendingVerification: counts[1],
      pending: counts[2],
      approved: counts[3],
      completed: counts[4],
      rejected: counts[5],
      cancelled: counts[6],
      unpaid: counts[7]
    };

    res.render('admin/bookings/index', {
      title: 'Booking Requests & Payment Approvals - Admin',
      bookings,
      venues,
      currentFilter: {
        status: status || 'All',
        paymentStatus: paymentStatus || 'All',
        venueId: venueId || 'All'
      },
      statusCounts
    });
  } catch (error) {
    console.error('Error fetching bookings for admin:', error);
    req.flash('error_msg', 'Could not load booking requests.');
    res.redirect('/admin/dashboard');
  }
};

// Approve Booking Request & Confirm Verified Payment
exports.postApproveBooking = async (req, res) => {
  const { adminRemarks } = req.body;

  try {
    const booking = await Booking.findById(req.params.id).populate('venue');
    if (!booking) {
      req.flash('error_msg', 'Booking request not found.');
      return res.redirect('/admin/bookings');
    }

    booking.status = 'Approved';
    booking.paymentStatus = 'paid';
    booking.adminRemarks = adminRemarks ? adminRemarks.trim() : 'Booking request and payment verified and approved by venue administration.';
    booking.approvedAt = new Date();
    booking.approvedBy = req.session.user.id;
    booking.paymentVerifiedAt = new Date();
    booking.paymentVerifiedBy = req.session.user.id;

    await booking.save();
    req.flash('success_msg', `Booking ${booking.bookingReference} approved & slot locked successfully!`);
    res.redirect('/admin/bookings');
  } catch (error) {
    console.error('Error approving booking:', error);
    req.flash('error_msg', 'Failed to approve booking request.');
    res.redirect('/admin/bookings');
  }
};

// Reject Booking Request / Payment Proof
exports.postRejectBooking = async (req, res) => {
  const { rejectionReason } = req.body;

  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      req.flash('error_msg', 'Booking request not found.');
      return res.redirect('/admin/bookings');
    }

    const reason = rejectionReason
      ? rejectionReason.trim()
      : 'Payment verification failed or slot unavailable for institutional scheduling.';

    booking.status = 'Rejected';
    booking.paymentStatus = 'rejected';
    booking.rejectionReason = reason;
    booking.rejectedAt = new Date();
    booking.rejectedBy = req.session.user.id;

    await booking.save();
    req.flash('success_msg', `Booking ${booking.bookingReference} rejected and slot released.`);
    res.redirect('/admin/bookings');
  } catch (error) {
    console.error('Error rejecting booking:', error);
    req.flash('error_msg', 'Failed to reject booking.');
    res.redirect('/admin/bookings');
  }
};

// Update Booking Status (e.g. Mark Completed / Cancelled)
exports.postUpdateBookingStatus = async (req, res) => {
  const { status, remarks } = req.body;

  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      req.flash('error_msg', 'Booking not found.');
      return res.redirect('/admin/bookings');
    }

    booking.status = status;
    if (remarks) {
      booking.adminRemarks = remarks.trim();
    }
    await booking.save();

    req.flash('success_msg', `Booking status updated to ${status}.`);
    res.redirect('/admin/bookings');
  } catch (error) {
    console.error('Error updating booking status:', error);
    req.flash('error_msg', 'Failed to update booking status.');
    res.redirect('/admin/bookings');
  }
};

// Render Admin Payment & Bank Gateway Settings Page
exports.getPaymentSettings = async (req, res) => {
  try {
    let settings = await PaymentSetting.findOne({ isActive: true }).sort({ updatedAt: -1 });
    if (!settings) {
      settings = await PaymentSetting.findOne().sort({ updatedAt: -1 });
    }
    if (!settings) {
      settings = {
        accountHolderName: 'Campus Facilities Administration',
        bankName: 'State Bank of India',
        accountNumber: '40928172901',
        ifscCode: 'SBIN0001234',
        branchName: 'University Main Campus Branch',
        upiId: 'campusfacilities@sbi',
        customQrImage: '',
        instructions: 'Please transfer the exact booking fee and submit your 12-digit UTR/UPI transaction reference.',
        isActive: true
      };
    }

    res.render('admin/payment-settings', {
      title: 'Payment Gateway & Bank Account Settings - Admin',
      settings
    });
  } catch (error) {
    console.error('Error loading payment settings:', error);
    req.flash('error_msg', 'Failed to load payment settings.');
    res.redirect('/admin/dashboard');
  }
};

// Save / Update Payment & Bank Settings
exports.postSavePaymentSettings = async (req, res) => {
  const {
    accountHolderName,
    bankName,
    accountNumber,
    ifscCode,
    branchName,
    upiId,
    instructions,
    isActive,
    existingQr
  } = req.body;

  try {
    if (!accountHolderName || !bankName || !accountNumber || !ifscCode || !upiId) {
      req.flash('error_msg', 'Please fill in all required payment settings fields marked with *');
      return res.redirect('/admin/payment-settings');
    }

    const cleanIfsc = ifscCode.trim().toUpperCase();
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(cleanIfsc)) {
      req.flash('error_msg', 'Invalid IFSC Code format. Must be an 11-character Indian IFSC code (e.g. SBIN0001234).');
      return res.redirect('/admin/payment-settings');
    }

    const cleanUpi = upiId.trim().toLowerCase();
    if (!cleanUpi.includes('@')) {
      req.flash('error_msg', 'Invalid UPI ID format. Must include an @ handle (e.g. campusfacilities@sbi).');
      return res.redirect('/admin/payment-settings');
    }

    let customQrImage = existingQr || '';
    if (req.file) {
      customQrImage = bufferToDataUri(req.file);
    }

    let setting = await PaymentSetting.findOne({ isActive: true });
    if (!setting) {
      setting = new PaymentSetting();
    }

    setting.accountHolderName = accountHolderName.trim();
    setting.bankName = bankName.trim();
    setting.accountNumber = accountNumber.trim();
    setting.ifscCode = cleanIfsc;
    setting.branchName = branchName ? branchName.trim() : 'Main Campus Branch';
    setting.upiId = cleanUpi;
    setting.customQrImage = customQrImage;
    setting.instructions = instructions ? instructions.trim() : 'Please transfer the exact booking fee and submit your 12-digit UTR/UPI transaction reference.';
    setting.isActive = isActive === 'true' || isActive === 'on' || isActive === true;
    setting.updatedBy = req.session.user.id;

    await setting.save();

    req.flash('success_msg', 'Payment & Bank Account settings saved and activated successfully!');
    res.redirect('/admin/payment-settings');
  } catch (error) {
    console.error('Error saving payment settings:', error);
    req.flash('error_msg', error.message || 'Failed to save payment settings.');
    res.redirect('/admin/payment-settings');
  }
};

// Maintenance & Blackout Dates Management
exports.getMaintenanceList = async (req, res) => {
  try {
    const [maintenanceBlocks, venues] = await Promise.all([
      MaintenanceBlock.find()
        .populate('venue')
        .populate('blockedBy', 'name email')
        .sort({ blockDate: -1 }),
      Venue.find({ status: { $ne: 'inactive' } }).sort({ name: 1 })
    ]);

    res.render('admin/maintenance/index', {
      title: 'Venue Maintenance & Blackout Dates',
      maintenanceBlocks,
      venues
    });
  } catch (error) {
    console.error('Error fetching maintenance records:', error);
    req.flash('error_msg', 'Could not retrieve maintenance schedules.');
    res.redirect('/admin/dashboard');
  }
};

// Create Maintenance Block
exports.postCreateMaintenanceBlock = async (req, res) => {
  const { venueId, title, reason, blockDate, startTime, endTime } = req.body;

  try {
    if (!venueId || !title || !reason || !blockDate || !startTime || !endTime) {
      req.flash('error_msg', 'All fields are required to block maintenance dates.');
      return res.redirect('/admin/maintenance');
    }

    const block = new MaintenanceBlock({
      venue: venueId,
      title: title.trim(),
      reason: reason.trim(),
      blockDate: new Date(blockDate),
      startTime,
      endTime,
      blockedBy: req.session.user.id,
      status: 'Active'
    });

    await block.save();
    req.flash('success_msg', 'Maintenance schedule created and venue blocked successfully.');
    res.redirect('/admin/maintenance');
  } catch (error) {
    console.error('Error creating maintenance block:', error);
    req.flash('error_msg', 'Failed to create maintenance block.');
    res.redirect('/admin/maintenance');
  }
};

// Delete / Lift Maintenance Block
exports.postDeleteMaintenanceBlock = async (req, res) => {
  try {
    await MaintenanceBlock.findByIdAndDelete(req.params.id);
    req.flash('success_msg', 'Maintenance block lifted successfully.');
    res.redirect('/admin/maintenance');
  } catch (error) {
    console.error('Error lifting maintenance block:', error);
    req.flash('error_msg', 'Failed to remove maintenance block.');
    res.redirect('/admin/maintenance');
  }
};

// Deep Analytics & Utilization Report
exports.getAnalytics = async (req, res) => {
  try {
    const [venues, bookings] = await Promise.all([
      Venue.find(),
      Booking.find({ status: { $in: ['Approved', 'Completed'] } }).populate('venue')
    ]);

    // Venue utilization calculation
    const venueStats = venues.map((venue) => {
      const vBookings = bookings.filter(
        (b) => b.venue && b.venue._id.toString() === venue._id.toString()
      );
      const totalHours = vBookings.reduce((sum, b) => sum + (b.durationHours || 0), 0);
      const revenue = vBookings.reduce((sum, b) => sum + (b.totalCost || 0), 0);
      const baseHours = 420;
      const rate = Math.min(100, Math.round((totalHours / baseHours) * 100));

      return {
        venue,
        totalBookings: vBookings.length,
        totalHours,
        revenue,
        utilizationRate: rate
      };
    });

    // Category distribution
    const categoryStats = {};
    bookings.forEach((b) => {
      const cat = b.eventType || 'Other';
      categoryStats[cat] = (categoryStats[cat] || 0) + 1;
    });

    const categoryLabels = Object.keys(categoryStats);
    const categoryCounts = Object.values(categoryStats);

    const totalRevenue = bookings.reduce((sum, b) => sum + (b.totalCost || 0), 0);
    const totalHoursBooked = bookings.reduce((sum, b) => sum + (b.durationHours || 0), 0);

    res.render('admin/analytics', {
      title: 'Campus Venue Analytics & Utilization Reports',
      venueStats,
      totalRevenue,
      totalHoursBooked,
      totalEvents: bookings.length,
      chartData: {
        venueNames: JSON.stringify(venueStats.map((v) => v.venue.code || v.venue.name.substring(0, 10))),
        venueUtil: JSON.stringify(venueStats.map((v) => v.utilizationRate)),
        venueRev: JSON.stringify(venueStats.map((v) => v.revenue)),
        catLabels: JSON.stringify(categoryLabels),
        catCounts: JSON.stringify(categoryCounts)
      }
    });
  } catch (error) {
    console.error('Error loading analytics:', error);
    req.flash('error_msg', 'Unable to generate analytics reports.');
    res.redirect('/admin/dashboard');
  }
};
