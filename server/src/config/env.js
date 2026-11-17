const path = require('path');
const dotenv = require('dotenv');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '..', '.env');
  dotenv.config({ path: envPath });

  if (!process.env.MONGODB_URI) {
    console.error('Missing required environment variable');
    process.exit(1);
  }

  if (!process.env.PORT) {
    process.env.PORT = '3001';
  }
}

module.exports = { loadEnv };
