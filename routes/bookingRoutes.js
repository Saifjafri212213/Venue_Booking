/**
 * Booking Routes
 */
const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { ensureAuthenticated } = require('../middleware/auth');

// Request a new booking
router.get('/new', ensureAuthenticated, bookingController.getNewBookingForm);
router.post('/', ensureAuthenticated, bookingController.postCreateBooking);

// View booking pass / detail
router.get('/:id', ensureAuthenticated, bookingController.getBookingDetail);

// Cancel booking
router.post('/:id/cancel', ensureAuthenticated, bookingController.postCancelBooking);

module.exports = router;
