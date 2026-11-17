const path = require('path');
const dotenv = require('dotenv');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '..', '.env');
  dotenv.config({ path: envPath });

  const required = ['MONGODB_URI', 'JWT_SECRET', 'CLIENT_ORIGIN'];
  const missing = required.some((name) => !process.env[name]);
  if (missing) {
    console.error('Missing required environment variable');
    process.exit(1);
  }

  if (!process.env.PORT) {
    process.env.PORT = '3001';
  }

  if (!process.env.JWT_EXPIRES_IN) {
    process.env.JWT_EXPIRES_IN = '2h';
  }
}

module.exports = { loadEnv };
