/**
 * Database Connection Module
 * Connects Express application to MongoDB Atlas or local MongoDB instance
 */
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/food_donation_db');
    console.log(`🌿 MongoDB Connected: ${conn.connection.host} / ${conn.connection.name}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.log('💡 Tip: Ensure MongoDB service is running locally or provide a valid MongoDB Atlas URI in .env');
  }
};

module.exports = connectDB;
