/**
 * Database Connection Module
 * Connects Express application to MongoDB Atlas with Serverless (Vercel) connection caching
 */
const mongoose = require('mongoose');

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  if (cached.conn && mongoose.connection.readyState >= 1) {
    return cached.conn;
  }

  const mongoUri = process.env.MONGO_URI || 'mongodb+srv://sjafri437_db_user:Sam123%40.@cluster0.3tjg2lg.mongodb.net/event_venue_booking_db?retryWrites=true&w=majority&appName=Cluster0';

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    };

    cached.promise = mongoose.connect(mongoUri, opts).then((m) => {
      console.log(`🌿 MongoDB Connected: ${m.connection.host} / ${m.connection.name}`);
      return m;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.error(`❌ MongoDB Connection Error: ${e.message}`);
    throw e;
  }

  return cached.conn;
};

module.exports = connectDB;
