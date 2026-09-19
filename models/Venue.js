const mongoose = require('mongoose');

const venueSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a venue name'],
      trim: true,
      maxlength: 120
    },
    code: {
      type: String,
      required: [true, 'Please provide a unique venue code'],
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 20
    },
    category: {
      type: String,
      required: [true, 'Please select a venue category'],
      enum: [
        'Auditorium',
        'Conference Hall',
        'Seminar Room',
        'Amphitheatre',
        'Workshop Lab',
        'Banquet Hall',
        'Sports Arena',
        'Meeting Room'
      ],
      default: 'Auditorium'
    },
    capacity: {
      type: Number,
      required: [true, 'Please specify seating/attendee capacity'],
      min: [1, 'Capacity must be at least 1 person']
    },
    location: {
      type: String,
      required: [true, 'Please specify the campus location'],
      trim: true
    },
    building: {
      type: String,
      trim: true,
      default: 'Main Campus Complex'
    },
    floor: {
      type: String,
      trim: true,
      default: 'Ground Floor'
    },
    facilities: {
      type: [String],
      default: []
    },
    hourlyRate: {
      type: Number,
      required: [true, 'Please specify hourly booking rate ($)'],
      min: [0, 'Hourly rate cannot be negative'],
      default: 50
    },
    operatingHours: {
      openTime: {
        type: String,
        default: '08:00'
      },
      closeTime: {
        type: String,
        default: '22:00'
      }
    },
    images: {
      type: [String],
      default: [
        'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=80'
      ]
    },
    featuredImage: {
      type: String,
      default: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=80'
    },
    rules: {
      type: [String],
      default: [
        'No open flames or unauthorized pyrotechnics.',
        'Audio levels must comply with campus decibel limits after 9:00 PM.',
        'Vacate venue promptly at the conclusion of the booked slot.',
        'Leave the hall clean and return AV peripherals to the technician desk.'
      ]
    },
    description: {
      type: String,
      trim: true,
      default: 'A versatile venue equipped with state-of-the-art multimedia facilities, comfortable acoustic seating, and climate control.'
    },
    status: {
      type: String,
      enum: ['active', 'maintenance', 'inactive'],
      default: 'active'
    },
    featured: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Virtual for formatted price
venueSchema.virtual('formattedRate').get(function () {
  return `$${this.hourlyRate}/hr`;
});

module.exports = mongoose.model('Venue', venueSchema);
