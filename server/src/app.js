const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const healthRouter = require('./routes/health');
const { authRouter, createAuthRouter } = require('./routes/auth');
const { originCheck } = require('./middlewares/originCheck');
const { errorHandler } = require('./middlewares/errorHandler');

function createApp() {
  const app = express();

  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
      credentials: true,
    })
  );
  app.use(originCheck);
  app.use(healthRouter);
  app.use('/api/auth', createAuthRouter());
  app.use(errorHandler);

  return app;
}

const app = createApp();

module.exports = { app, createApp };
