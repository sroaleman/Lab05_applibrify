const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

function originCheck(req, res, next) {
  if (!MUTATING_METHODS.has(req.method)) {
    return next();
  }

  if (req.path === '/health') {
    return next();
  }

  const allowed = process.env.CLIENT_ORIGIN;
  if (req.get('origin') !== allowed) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  return next();
}

module.exports = { originCheck };
