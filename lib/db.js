import mongoose from 'mongoose';

let isConnected = false;

export async function connectDB() {
  if (isConnected) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('⚠️  MONGODB_URI not set — running without database');
    return;
  }

  try {
    await mongoose.connect(uri, {
      maxPoolSize: 1,
      minPoolSize: 0,
      socketTimeoutMS: 30000,
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log('🗄️  MongoDB connected');
  } catch (err) {
    console.error('❌  MongoDB connection failed:', err.message);
    // Don't crash the server — app still works without DB
  }
}

export function isDBConnected() {
  return isConnected;
}
