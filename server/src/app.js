const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const healthRouter = require('./routes/health');
const { authRouter, createAuthRouter } = require('./routes/auth');
const usersRouter = require('./routes/users');
const categoriesRouter = require('./routes/categories');
const booksRouter = require('./routes/books');
const cartRouter = require('./routes/cart');
const addressesRouter = require('./routes/addresses');
const ordersRouter = require('./routes/orders');
const { originCheck } = require('./middlewares/originCheck');
const { auth } = require('./middlewares/auth');
const { requireRole } = require('./middlewares/requireRole');
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
  app.use('/api/users', auth, requireRole('administrador'), usersRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/books', booksRouter);
  app.use('/api/cart', auth, cartRouter);
  app.use('/api/addresses', auth, addressesRouter);
  app.use('/api/orders', auth, ordersRouter);
  app.use(errorHandler);

  return app;
}

const app = createApp();

module.exports = { app, createApp };
