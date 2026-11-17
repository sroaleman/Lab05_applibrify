const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { registerSchema, loginSchema } = require('../validators/auth');
const { auth } = require('../middlewares/auth');

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function createLoginLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts' },
  });
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: TWO_HOURS_MS,
    path: '/',
  };
}

function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '2h',
  });
}

function createAuthRouter(limiter = createLoginLimiter()) {
  const router = express.Router();

  router.post('/register', async (req, res, next) => {
    try {
      const data = registerSchema.parse(req.body);
      const passwordHash = await bcrypt.hash(data.password, 12);
      const user = await User.create({
        name: data.name,
        email: data.email.toLowerCase(),
        passwordHash,
        role: 'cliente',
      });
      return res.status(201).json(user.toJSON());
    } catch (err) {
      return next(err);
    }
  });

  router.post('/login', limiter, async (req, res, next) => {
    try {
      const data = loginSchema.parse(req.body);
      const user = await User.findOne({ email: data.email.toLowerCase() }).select(
        '+passwordHash'
      );
      if (!user) {
        return res.status(401).json({ error: 'Email o contraseña incorrectos' });
      }

      const matches = await bcrypt.compare(data.password, user.passwordHash);
      if (!matches) {
        return res.status(401).json({ error: 'Email o contraseña incorrectos' });
      }

      const token = signToken(user._id);
      res.cookie('token', token, cookieOptions());
      return res.status(200).json(user.toJSON());
    } catch (err) {
      return next(err);
    }
  });

  router.post('/logout', (req, res) => {
    res.clearCookie('token', cookieOptions());
    return res.status(204).end();
  });

  router.get('/me', auth, (req, res) => {
    return res.status(200).json(req.user.toJSON());
  });

  return router;
}

const authRouter = createAuthRouter();

module.exports = authRouter;
module.exports.authRouter = authRouter;
module.exports.createAuthRouter = createAuthRouter;
module.exports.createLoginLimiter = createLoginLimiter;
