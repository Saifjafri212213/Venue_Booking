/**
 * Venue Routes (Public & Organiser Directory)
 */
const express = require('express');
const router = express.Router();
const venueController = require('../controllers/venueController');

// Explore all venues
router.get('/', venueController.getAllVenues);

// Venue Detail page
router.get('/:id', venueController.getVenueDetail);

module.exports = router;
