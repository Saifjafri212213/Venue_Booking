/**
 * Admin / Venue Manager Controller
 * Handles venue CRUD, booking approvals, status updates, maintenance date blocking,
 * utilization analytics, and revenue metrics.
 */
const Venue = require('../models/Venue');
const Booking = require('../models/Booking');
const MaintenanceBlock = require('../models/MaintenanceBlock');
const User = require('../models/User');

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
      todayEvents,
      allApprovedOrCompleted
    ] = await Promise.all([
      Venue.countDocuments(),
      Venue.countDocuments({ status: 'active' }),
      Booking.countDocuments(),
      Booking.countDocuments({ status: 'Pending' }),
      Booking.countDocuments({ status: 'Approved' }),
      Booking.countDocuments({ status: 'Completed' }),
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
      // Assuming a 30-day baseline of 14 operating hours/day = 420 available hours
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

    // Chart Data: Utilization & Revenue
    const chartLabels = venueStats.map((v) => v.code || v.name.substring(0, 12));
    const chartUtilization = venueStats.map((v) => v.utilizationRate);
    const chartRevenue = venueStats.map((v) => v.revenue);

    // Average Utilization
    const avgUtilization =
      venueStats.length > 0
        ? Math.round(
            venueStats.reduce((sum, v) => sum + v.utilizationRate, 0) / venueStats.length
          )
        : 0;

    res.render('admin/dashboard', {
      title: 'Venue Manager & Admin Dashboard',
      metrics: {
        totalVenues,
        activeVenues,
        totalBookings,
        pendingRequestsCount,
        approvedBookingsCount,
        completedBookingsCount,
        todayEventsCount: todayEvents.length,
        totalRevenue,
        pendingRevenue,
        avgUtilization
      },
      todayEvents,
      pendingBookings,
      upcomingEvents,
      venueStats,
      chartData: {
        labels: JSON.stringify(chartLabels),
        utilization: JSON.stringify(chartUtilization),
        revenue: JSON.stringify(chartRevenue)
      }
    });
  } catch (error) {
    console.error('Error in Admin Dashboard:', error);
    req.flash('error_msg', 'Unable to load Admin dashboard.');
    res.redirect('/');
  }
};

// Venue List (Admin Management View)
exports.getVenuesList = async (req, res) => {
  try {
    const venues = await Venue.find().sort({ createdAt: -1 });

    // Aggregate booking counts per venue
    const bookingCounts = await Booking.aggregate([
      { $group: { _id: '$venue', count: { $sum: 1 } } }
    ]);

    const countMap = {};
    bookingCounts.forEach((item) => {
      countMap[item._id.toString()] = item.count;
    });

    const enrichedVenues = venues.map((v) => ({
      ...v.toObject(),
      bookingsCount: countMap[v._id.toString()] || 0
    }));

    res.render('admin/venues/index', {
      title: 'Manage Venues - Admin Control',
      venues: enrichedVenues
    });
  } catch (error) {
    console.error('Error fetching venues for admin:', error);
    req.flash('error_msg', 'Could not retrieve venues.');
    res.redirect('/admin/dashboard');
  }
};

// Render Create Venue Form
exports.getVenueCreateForm = (req, res) => {
  res.render('admin/venues/form', {
    title: 'Add New Campus Venue',
    venue: null,
    isEdit: false
  });
};

// Handle Create Venue
exports.postCreateVenue = async (req, res) => {
  try {
    const {
      name,
      code,
      category,
      capacity,
      location,
      building,
      floor,
      hourlyRate,
      facilities,
      featuredImage,
      description,
      openTime,
      closeTime,
      rules,
      featured,
      status
    } = req.body;

    const facilityList = Array.isArray(facilities)
      ? facilities
      : typeof facilities === 'string'
      ? facilities.split(',').map((f) => f.trim()).filter(Boolean)
      : [];

    const rulesList = typeof rules === 'string'
      ? rules.split('\n').map((r) => r.trim()).filter(Boolean)
      : [];

    const newVenue = new Venue({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      category: category || 'Auditorium',
      capacity: Number(capacity),
      location: location.trim(),
      building: building ? building.trim() : 'Main Complex',
      floor: floor ? floor.trim() : 'Ground Floor',
      hourlyRate: Number(hourlyRate),
      facilities: facilityList,
      featuredImage: featuredImage || 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=80',
      description: description ? description.trim() : '',
      operatingHours: {
        openTime: openTime || '08:00',
        closeTime: closeTime || '22:00'
      },
      rules: rulesList.length > 0 ? rulesList : undefined,
      featured: featured === 'on' || featured === 'true',
      status: status || 'active'
    });

    await newVenue.save();
    req.flash('success_msg', `Venue "${newVenue.name}" has been created successfully!`);
    res.redirect('/admin/venues');
  } catch (error) {
    console.error('Error creating venue:', error);
    req.flash('error_msg', error.message || 'Failed to create venue.');
    res.render('admin/venues/form', {
      title: 'Add New Campus Venue',
      venue: req.body,
      isEdit: false
    });
  }
};

// Render Edit Venue Form
exports.getVenueEditForm = async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id);
    if (!venue) {
      req.flash('error_msg', 'Venue not found.');
      return res.redirect('/admin/venues');
    }
    res.render('admin/venues/form', {
      title: `Edit Venue: ${venue.name}`,
      venue,
      isEdit: true
    });
  } catch (error) {
    console.error('Error loading edit form:', error);
    req.flash('error_msg', 'Could not open venue edit form.');
    res.redirect('/admin/venues');
  }
};

// Handle Update Venue
exports.postUpdateVenue = async (req, res) => {
  try {
    const {
      name,
      code,
      category,
      capacity,
      location,
      building,
      floor,
      hourlyRate,
      facilities,
      featuredImage,
      description,
      openTime,
      closeTime,
      rules,
      featured,
      status
    } = req.body;

    const facilityList = Array.isArray(facilities)
      ? facilities
      : typeof facilities === 'string'
      ? facilities.split(',').map((f) => f.trim()).filter(Boolean)
      : [];

    const rulesList = typeof rules === 'string'
      ? rules.split('\n').map((r) => r.trim()).filter(Boolean)
      : [];

    await Venue.findByIdAndUpdate(
      req.params.id,
      {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        category,
        capacity: Number(capacity),
        location: location.trim(),
        building: building ? building.trim() : 'Main Complex',
        floor: floor ? floor.trim() : 'Ground Floor',
        hourlyRate: Number(hourlyRate),
        facilities: facilityList,
        featuredImage: featuredImage || 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=80',
        description: description ? description.trim() : '',
        operatingHours: {
          openTime: openTime || '08:00',
          closeTime: closeTime || '22:00'
        },
        rules: rulesList.length > 0 ? rulesList : undefined,
        featured: featured === 'on' || featured === 'true',
        status: status || 'active'
      },
      { runValidators: true }
    );

    req.flash('success_msg', 'Venue updated successfully!');
    res.redirect('/admin/venues');
  } catch (error) {
    console.error('Error updating venue:', error);
    req.flash('error_msg', error.message || 'Failed to update venue.');
    res.redirect(`/admin/venues/${req.params.id}/edit`);
  }
};

// Handle Delete / Archive Venue
exports.postDeleteVenue = async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id);
    if (!venue) {
      req.flash('error_msg', 'Venue not found.');
      return res.redirect('/admin/venues');
    }

    // Check if there are active approved bookings
    const activeBookings = await Booking.countDocuments({
      venue: venue._id,
      status: { $in: ['Approved', 'Pending'] }
    });

    if (activeBookings > 0) {
      // Instead of hard delete, set to inactive to preserve booking history integrity
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

// Handle Booking Requests Management & Approval Inbox
exports.getBookingsList = async (req, res) => {
  try {
    const { status, venueId } = req.query;
    const filter = {};

    if (status && status !== 'All') {
      filter.status = status;
    }
    if (venueId && venueId !== 'All') {
      filter.venue = venueId;
    }

    const [bookings, venues, counts] = await Promise.all([
      Booking.find(filter)
        .populate('venue')
        .populate('organiser', 'name email organization department phone')
        .populate('approvedBy', 'name')
        .sort({ createdAt: -1 }),
      Venue.find().sort({ name: 1 }),
      Promise.all([
        Booking.countDocuments(),
        Booking.countDocuments({ status: 'Pending' }),
        Booking.countDocuments({ status: 'Approved' }),
        Booking.countDocuments({ status: 'Completed' }),
        Booking.countDocuments({ status: 'Rejected' }),
        Booking.countDocuments({ status: 'Cancelled' })
      ])
    ]);

    const statusCounts = {
      all: counts[0],
      pending: counts[1],
      approved: counts[2],
      completed: counts[3],
      rejected: counts[4],
      cancelled: counts[5]
    };

    res.render('admin/bookings/index', {
      title: 'Booking Requests & Approvals - Admin',
      bookings,
      venues,
      currentFilter: {
        status: status || 'All',
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

// Approve Booking Request
exports.postApproveBooking = async (req, res) => {
  const { adminRemarks } = req.body;

  try {
    const booking = await Booking.findById(req.params.id).populate('venue');
    if (!booking) {
      req.flash('error_msg', 'Booking request not found.');
      return res.redirect('/admin/bookings');
    }

    booking.status = 'Approved';
    booking.adminRemarks = adminRemarks ? adminRemarks.trim() : 'Booking request approved by venue administration.';
    booking.approvedAt = new Date();
    booking.approvedBy = req.session.user.id;

    await booking.save();
    req.flash('success_msg', `Booking ${booking.bookingReference} approved successfully!`);
    res.redirect('/admin/bookings');
  } catch (error) {
    console.error('Error approving booking:', error);
    req.flash('error_msg', 'Failed to approve booking request.');
    res.redirect('/admin/bookings');
  }
};

// Reject Booking Request
exports.postRejectBooking = async (req, res) => {
  const { rejectionReason } = req.body;

  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      req.flash('error_msg', 'Booking request not found.');
      return res.redirect('/admin/bookings');
    }

    booking.status = 'Rejected';
    booking.rejectionReason = rejectionReason
      ? rejectionReason.trim()
      : 'Venue unavailable or scheduling conflict with institutional activities.';
    booking.rejectedAt = new Date();
    booking.rejectedBy = req.session.user.id;

    await booking.save();
    req.flash('success_msg', `Booking ${booking.bookingReference} rejected.`);
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
