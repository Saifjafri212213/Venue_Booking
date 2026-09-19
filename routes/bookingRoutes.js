/**
 * Booking Routes
 */
const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { ensureAuthenticated } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

// Request a new booking
router.get('/new', ensureAuthenticated, bookingController.getNewBookingForm);
router.post('/', ensureAuthenticated, bookingController.postCreateBooking);

// Payment first flow
router.get('/:id/payment', ensureAuthenticated, bookingController.getPaymentPage);
router.post(
  '/:id/payment-proof',
  ensureAuthenticated,
  upload.single('paymentScreenshot'),
  bookingController.postSubmitPaymentProof
);
router.get('/:id/retry-payment', ensureAuthenticated, bookingController.getRetryPayment);

// View booking pass / detail / receipt
router.get('/:id', ensureAuthenticated, bookingController.getBookingDetail);

// Cancel booking
router.post('/:id/cancel', ensureAuthenticated, bookingController.postCancelBooking);

module.exports = router;
