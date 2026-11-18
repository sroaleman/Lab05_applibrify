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
const paymentsRouter = require('./routes/payments');
const libraryRouter = require('./routes/library');
const { originCheck } = require('./middlewares/originCheck');
const { auth } = require('./middlewares/auth');
const { requireRole } = require('./middlewares/requireRole');
const { errorHandler } = require('./middlewares/errorHandler');

function createApp(options = {}) {
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

  // originCheck aplica a mutaciones (POST, PUT, PATCH, DELETE).
  // Nota de diseño: La ruta de descarga GET /api/library/:bookId/file es de tipo GET
  // (no mutante) y no pasa por originCheck, permitiendo descargas directas desde navegador
  // autenticadas exclusivamente mediante token temporal firmado.
  app.use(originCheck);
  app.use(healthRouter);
  app.use('/api/auth', createAuthRouter());
  app.use('/api/users', auth, requireRole('administrador'), usersRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/books', booksRouter);
  app.use('/api/cart', auth, cartRouter);
  app.use('/api/addresses', auth, addressesRouter);
  app.use('/api/orders', auth, ordersRouter);

  const activePaymentsRouter = options.paymentsRouter || paymentsRouter;
  app.use('/api/payments', auth, activePaymentsRouter);

  const activeLibraryRouter = options.libraryRouter || libraryRouter;
  app.use('/api/library', activeLibraryRouter);

  app.use(errorHandler);

  return app;
}

const app = createApp();

module.exports = { app, createApp };
