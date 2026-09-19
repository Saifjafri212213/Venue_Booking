const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    bookingReference: {
      type: String,
      unique: true,
      required: true,
      uppercase: true,
      trim: true
    },
    venue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Venue',
      required: [true, 'Please specify the venue']
    },
    organiser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Please specify the organiser']
    },
    eventTitle: {
      type: String,
      required: [true, 'Please provide an event title'],
      trim: true,
      maxlength: 150
    },
    eventType: {
      type: String,
      enum: [
        'Academic',
        'Cultural',
        'Tech Fest',
        'Workshop',
        'Seminar',
        'Corporate',
        'Society Meeting',
        'Sports & Fitness',
        'Celebration',
        'Other'
      ],
      default: 'Seminar'
    },
    description: {
      type: String,
      trim: true,
      default: 'Campus event organized for community engagement and learning.'
    },
    expectedAttendees: {
      type: Number,
      required: [true, 'Please specify expected attendee count'],
      min: [1, 'Attendees count must be at least 1']
    },
    bookingDate: {
      type: Date,
      required: [true, 'Please select the booking date']
    },
    startTime: {
      type: String,
      required: [true, 'Please select a start time (e.g. 09:00)'],
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter a valid start time format (HH:mm)']
    },
    endTime: {
      type: String,
      required: [true, 'Please select an end time (e.g. 12:00)'],
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter a valid end time format (HH:mm)']
    },
    durationHours: {
      type: Number,
      required: true,
      min: [0.5, 'Minimum booking duration is 30 minutes']
    },
    hourlyRate: {
      type: Number,
      required: true
    },
    totalCost: {
      type: Number,
      required: true
    },
    specialFacilities: {
      type: [String],
      default: []
    },
    specialRequests: {
      type: String,
      trim: true,
      default: ''
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'Completed', 'Cancelled'],
      default: 'Pending'
    },
    // --- PAYMENT FIRST WORKFLOW FIELDS ---
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'pending_verification', 'paid', 'rejected'],
      default: 'unpaid'
    },
    paymentAmount: {
      type: Number,
      default: function () {
        return this.totalCost || 0;
      }
    },
    paymentExpiresAt: {
      type: Date
    },
    utrNumber: {
      type: String,
      trim: true,
      uppercase: true,
      sparse: true,
      default: null
    },
    paymentScreenshot: {
      type: String,
      default: ''
    },
    paymentSubmittedAt: {
      type: Date
    },
    paymentVerifiedAt: {
      type: Date
    },
    paymentVerifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    adminRemarks: {
      type: String,
      trim: true,
      default: ''
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: ''
    },
    approvedAt: {
      type: Date
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rejectedAt: {
      type: Date
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    cancelledAt: {
      type: Date
    },
    cancellationReason: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// Formatted booking date helper virtual
bookingSchema.virtual('formattedDate').get(function () {
  if (!this.bookingDate) return '';
  const d = new Date(this.bookingDate);
  return d.toISOString().split('T')[0];
});

// Helper virtual: is payment window currently active
bookingSchema.virtual('isPaymentExpired').get(function () {
  if (this.paymentStatus !== 'unpaid' || !this.paymentExpiresAt) return false;
  return new Date() > new Date(this.paymentExpiresAt);
});

module.exports = mongoose.model('Booking', bookingSchema);
