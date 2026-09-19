const mongoose = require('mongoose');

const maintenanceBlockSchema = new mongoose.Schema(
  {
    venue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Venue',
      required: [true, 'Please select a venue for maintenance']
    },
    title: {
      type: String,
      required: [true, 'Please provide a maintenance title/task name'],
      trim: true,
      maxlength: 120
    },
    reason: {
      type: String,
      required: [true, 'Please provide the maintenance reason or work details'],
      trim: true
    },
    blockDate: {
      type: Date,
      required: [true, 'Please select the maintenance date']
    },
    startTime: {
      type: String,
      required: [true, 'Please enter maintenance start time (HH:mm)'],
      default: '08:00',
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter a valid start time format (HH:mm)']
    },
    endTime: {
      type: String,
      required: [true, 'Please enter maintenance end time (HH:mm)'],
      default: '20:00',
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter a valid end time format (HH:mm)']
    },
    blockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['Active', 'Completed', 'Cancelled'],
      default: 'Active'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('MaintenanceBlock', maintenanceBlockSchema);
