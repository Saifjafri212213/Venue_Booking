/**
 * Organiser Routes
 */
const express = require('express');
const router = express.Router();
const organiserController = require('../controllers/organiserController');
const { ensureAuthenticated, ensureRole } = require('../middleware/auth');

// Protect organiser routes
router.use(ensureAuthenticated, ensureRole(['organiser', 'admin']));

// Dashboard
router.get('/dashboard', organiserController.getDashboard);

// My Bookings
router.get('/my-bookings', organiserController.getMyBookings);

module.exports = router;
