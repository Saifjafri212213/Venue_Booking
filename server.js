/**
 * Main Application Server
 * Event & Venue Booking Management System
 */
require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const connectDB = require('./config/db');
const Venue = require('./models/Venue');
const Booking = require('./models/Booking');
const User = require('./models/User');

// Initialize Express App
const app = express();

// Connect to MongoDB Database
connectDB();

// Setup EJS Template Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Body Parser Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve Static Files (CSS, JS, Images)
app.use(express.static(path.join(__dirname, 'public')));

// Express Session Middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'event_venue_secret_key_2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 // 1 day session duration
    }
  })
);

// Connect Flash Messages Middleware
app.use(flash());

// Global Local Variables Middleware
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.currentPath = req.path;
  next();
});

// Import Routes
const authRoutes = require('./routes/authRoutes');
const venueRoutes = require('./routes/venueRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const adminRoutes = require('./routes/adminRoutes');
const organiserRoutes = require('./routes/organiserRoutes');
const apiRoutes = require('./routes/apiRoutes');

// Landing Page Route
app.get('/', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const [
      totalVenues,
      totalBookings,
      totalOrganisers,
      todayEvents,
      featuredVenues,
      recentApproved
    ] = await Promise.all([
      Venue.countDocuments({ status: 'active' }),
      Booking.countDocuments(),
      User.countDocuments({ role: 'organiser' }),
      Booking.find({
        bookingDate: { $gte: today, $lte: endOfToday },
        status: { $in: ['Approved', 'Completed'] }
      }).populate('venue').sort({ startTime: 1 }),
      Venue.find({ status: 'active' }).sort({ featured: -1, capacity: -1 }).limit(6),
      Booking.find({ status: 'Approved' })
        .populate('venue')
        .populate('organiser', 'name organization')
        .sort({ bookingDate: 1 })
        .limit(4)
    ]);

    res.render('index', {
      title: 'Campus Event & Venue Booking Management System',
      stats: {
        totalVenues: totalVenues || 0,
        totalBookings: totalBookings || 0,
        totalOrganisers: totalOrganisers || 0,
        todayEventsCount: todayEvents.length
      },
      todayEvents,
      featuredVenues,
      recentApproved
    });
  } catch (error) {
    console.error('Home route error:', error);
    res.render('index', {
      title: 'Campus Event & Venue Booking Management System',
      stats: {
        totalVenues: 0,
        totalBookings: 0,
        totalOrganisers: 0,
        todayEventsCount: 0
      },
      todayEvents: [],
      featuredVenues: [],
      recentApproved: []
    });
  }
});

// Mount Feature Routes
app.use('/auth', authRoutes);
app.use('/venues', venueRoutes);
app.use('/bookings', bookingRoutes);
app.use('/admin', adminRoutes);
app.use('/organiser', organiserRoutes);
app.use('/api', apiRoutes);

// 404 Route Handler
app.use((req, res) => {
  res.status(404).render('index', {
    title: '404 - Page Not Found',
    error_msg: 'The requested page does not exist.',
    stats: { totalVenues: 0, totalBookings: 0, totalOrganisers: 0, todayEventsCount: 0 },
    todayEvents: [],
    featuredVenues: [],
    recentApproved: []
  });
});

// Start Server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🏛️  Campus Venue & Event Server running on http://localhost:${PORT}`);
  console.log(`=================================================`);
});
