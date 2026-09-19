/**
 * PaymentSetting Model
 * Holds admin-configured bank account details, UPI ID, and QR settings
 */
const mongoose = require('mongoose');

const paymentSettingSchema = new mongoose.Schema(
  {
    accountHolderName: {
      type: String,
      required: [true, 'Please provide the account holder name'],
      trim: true
    },
    bankName: {
      type: String,
      required: [true, 'Please provide the bank name'],
      trim: true
    },
    accountNumber: {
      type: String,
      required: [true, 'Please provide the account number'],
      trim: true
    },
    ifscCode: {
      type: String,
      required: [true, 'Please provide the IFSC code'],
      uppercase: true,
      trim: true,
      match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Please provide a valid 11-character Indian IFSC code (e.g. SBIN0001234)']
    },
    branchName: {
      type: String,
      trim: true,
      default: 'Main Campus Branch'
    },
    upiId: {
      type: String,
      required: [true, 'Please provide the UPI ID'],
      lowercase: true,
      trim: true,
      match: [/^[\w.-]+@[\w.-]+$/, 'Please provide a valid UPI ID (e.g. campusfacilities@okhdfcbank)']
    },
    customQrImage: {
      type: String,
      default: ''
    },
    instructions: {
      type: String,
      trim: true,
      default: 'Please transfer the exact amount and enter your 12-digit bank UTR / Transaction Reference number.'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('PaymentSetting', paymentSettingSchema);
