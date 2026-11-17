const mongoose = require('mongoose');

function getMongoUri() {
  if (process.env.NODE_ENV === 'test') {
    return process.env.MONGODB_TEST_URI || '';
  }
  return process.env.MONGODB_URI;
}

async function connectDb() {
  const uri = getMongoUri();
  if (!uri) {
    if (process.env.NODE_ENV === 'test') {
      console.error('MONGODB_TEST_URI is required to run tests');
      process.exit(1);
    }
    console.error('MongoDB connection error');
    return;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error', err.name);
  }
}

module.exports = { connectDb, getMongoUri };
