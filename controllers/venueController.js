/**
 * Venue Controller
 * Handles venue exploration, filtering, search, and detail views.
 */
const Venue = require('../models/Venue');
const Booking = require('../models/Booking');
const MaintenanceBlock = require('../models/MaintenanceBlock');

// List / Search all venues with advanced filtering
exports.getAllVenues = async (req, res) => {
  try {
    const {
      search,
      category,
      minCapacity,
      maxCapacity,
      facilities,
      maxRate,
      sortBy
    } = req.query;

    const filter = { status: 'active' };

    // Search query (keyword in name, location, building, description)
    if (search && search.trim()) {
      filter.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { location: { $regex: search.trim(), $options: 'i' } },
        { building: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    // Category filter
    if (category && category !== 'All') {
      filter.category = category;
    }

    // Capacity range
    if (minCapacity || maxCapacity) {
      filter.capacity = {};
      if (minCapacity) filter.capacity.$gte = Number(minCapacity);
      if (maxCapacity) filter.capacity.$lte = Number(maxCapacity);
    }

    // Facilities multi-filter
    if (facilities) {
      const facilityArray = Array.isArray(facilities) ? facilities : [facilities];
      if (facilityArray.length > 0) {
        filter.facilities = { $all: facilityArray };
      }
    }

    // Max hourly rate
    if (maxRate && Number(maxRate) > 0) {
      filter.hourlyRate = { $lte: Number(maxRate) };
    }

    // Sorting
    let sortOption = { featured: -1, capacity: -1 };
    if (sortBy === 'price_asc') sortOption = { hourlyRate: 1 };
    else if (sortBy === 'price_desc') sortOption = { hourlyRate: -1 };
    else if (sortBy === 'capacity_asc') sortOption = { capacity: 1 };
    else if (sortBy === 'capacity_desc') sortOption = { capacity: -1 };
    else if (sortBy === 'name_asc') sortOption = { name: 1 };

    const venues = await Venue.find(filter).sort(sortOption);

    // Get all unique categories & facilities for filter pills
    const allCategories = [
      'Auditorium',
      'Conference Hall',
      'Seminar Room',
      'Amphitheatre',
      'Workshop Lab',
      'Banquet Hall',
      'Sports Arena',
      'Meeting Room'
    ];

    const standardFacilities = [
      'Projector & Screen',
      'Surround Sound Audio',
      'Stage Lighting',
      'Central AC',
      'High-Speed Wi-Fi',
      'Video Conferencing',
      'Podiums & Microphones',
      'Catering Pantry',
      'Wheelchair Accessible',
      'VIP Green Room',
      'Parking Access'
    ];

    res.render('venues/index', {
      title: 'Explore Campus Venues & Halls',
      venues,
      allCategories,
      standardFacilities,
      filters: {
        search: search || '',
        category: category || 'All',
        minCapacity: minCapacity || '',
        maxCapacity: maxCapacity || '',
        facilities: Array.isArray(facilities) ? facilities : facilities ? [facilities] : [],
        maxRate: maxRate || '',
        sortBy: sortBy || 'default'
      },
      totalCount: venues.length
    });
  } catch (error) {
    console.error('Error fetching venues:', error);
    req.flash('error_msg', 'Unable to retrieve venue catalogue.');
    res.redirect('/');
  }
};

// View Single Venue Detail
exports.getVenueDetail = async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id);
    if (!venue) {
      req.flash('error_msg', 'The requested venue was not found.');
      return res.redirect('/venues');
    }

    // Fetch upcoming bookings for schedule calendar preview
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingBookings = await Booking.find({
      venue: venue._id,
      status: { $in: ['Approved', 'Pending'] },
      bookingDate: { $gte: today }
    })
      .sort({ bookingDate: 1, startTime: 1 })
      .limit(10)
      .select('eventTitle bookingDate startTime endTime status eventType');

    // Fetch maintenance blocks
    const maintenanceBlocks = await MaintenanceBlock.find({
      venue: venue._id,
      status: 'Active',
      blockDate: { $gte: today }
    }).sort({ blockDate: 1 });

    // Fetch other similar venues in the same category or capacity
    const similarVenues = await Venue.find({
      _id: { $ne: venue._id },
      status: 'active',
      category: venue.category
    }).limit(3);

    res.render('venues/detail', {
      title: `${venue.name} - Venue Details & Booking`,
      venue,
      upcomingBookings,
      maintenanceBlocks,
      similarVenues
    });
  } catch (error) {
    console.error('Error viewing venue detail:', error);
    req.flash('error_msg', 'Error displaying venue details.');
    res.redirect('/venues');
  }
};
