/**
 * Admin Routes
 */
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { ensureAuthenticated, ensureRole } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

// Protect all admin routes with admin role middleware
router.use(ensureAuthenticated, ensureRole('admin'));

// Dashboard
router.get('/dashboard', adminController.getDashboard);

// Venue CRUD
router.get('/venues', adminController.getVenuesList);
router.get('/venues/new', adminController.getVenueCreateForm);
router.post('/venues', adminController.postCreateVenue);
router.get('/venues/:id/edit', adminController.getVenueEditForm);
router.post('/venues/:id', adminController.postUpdateVenue);
router.post('/venues/:id/delete', adminController.postDeleteVenue);

// Booking Requests & Approvals
router.get('/bookings', adminController.getBookingsList);
router.post('/bookings/:id/approve', adminController.postApproveBooking);
router.post('/bookings/:id/reject', adminController.postRejectBooking);
router.post('/bookings/:id/status', adminController.postUpdateBookingStatus);

// Payment Gateway & Bank Account Settings
router.get('/payment-settings', adminController.getPaymentSettings);
router.post(
  '/payment-settings',
  upload.single('customQrImage'),
  adminController.postSavePaymentSettings
);

// Maintenance & Blackouts
router.get('/maintenance', adminController.getMaintenanceList);
router.post('/maintenance', adminController.postCreateMaintenanceBlock);
router.post('/maintenance/:id/delete', adminController.postDeleteMaintenanceBlock);

// Analytics
router.get('/analytics', adminController.getAnalytics);

module.exports = router;
