/**
 * Organiser Controller
 * Handles organiser dashboard, booking history, and personal venue recommendations.
 */
const Booking = require('../models/Booking');
const Venue = require('../models/Venue');

// Organiser Dashboard
exports.getDashboard = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalBookings,
      pendingCount,
      approvedCount,
      completedCount,
      myBookings,
      recommendedVenues
    ] = await Promise.all([
      Booking.countDocuments({ organiser: userId }),
      Booking.countDocuments({ organiser: userId, status: 'Pending' }),
      Booking.countDocuments({ organiser: userId, status: 'Approved' }),
      Booking.countDocuments({ organiser: userId, status: 'Completed' }),
      Booking.find({ organiser: userId })
        .populate('venue')
        .sort({ createdAt: -1 })
        .limit(6),
      Venue.find({ status: 'active', featured: true }).limit(3)
    ]);

    // Upcoming approved bookings
    const upcomingEvents = await Booking.find({
      organiser: userId,
      status: 'Approved',
      bookingDate: { $gte: today }
    })
      .populate('venue')
      .sort({ bookingDate: 1, startTime: 1 })
      .limit(4);

    res.render('organiser/dashboard', {
      title: 'Organiser Workspace - My Events & Bookings',
      stats: {
        totalBookings,
        pendingCount,
        approvedCount,
        completedCount
      },
      recentBookings: myBookings,
      upcomingEvents,
      recommendedVenues
    });
  } catch (error) {
    console.error('Error in Organiser Dashboard:', error);
    req.flash('error_msg', 'Unable to load organiser dashboard.');
    res.redirect('/');
  }
};

// Organiser Booking History & Management
exports.getMyBookings = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { status } = req.query;

    const filter = { organiser: userId };
    if (status && status !== 'All') {
      filter.status = status;
    }

    const [bookings, counts] = await Promise.all([
      Booking.find(filter).populate('venue').sort({ createdAt: -1 }),
      Promise.all([
        Booking.countDocuments({ organiser: userId }),
        Booking.countDocuments({ organiser: userId, status: 'Pending' }),
        Booking.countDocuments({ organiser: userId, status: 'Approved' }),
        Booking.countDocuments({ organiser: userId, status: 'Completed' }),
        Booking.countDocuments({ organiser: userId, status: 'Rejected' }),
        Booking.countDocuments({ organiser: userId, status: 'Cancelled' })
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

    res.render('organiser/my-bookings', {
      title: 'My Bookings History',
      bookings,
      currentStatus: status || 'All',
      statusCounts
    });
  } catch (error) {
    console.error('Error fetching organiser bookings:', error);
    req.flash('error_msg', 'Could not load your bookings.');
    res.redirect('/organiser/dashboard');
  }
};
