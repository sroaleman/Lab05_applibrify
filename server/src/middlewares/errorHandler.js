function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  console.error('Request error', err.name);

  if (
    (err instanceof SyntaxError && err.status === 400 && 'body' in err) ||
    err.type === 'entity.parse.failed'
  ) {
    return res.status(400).json({ error: 'Solicitud inválida' });
  }

  if (err.name === 'ZodError') {
    return res.status(400).json({ error: 'Solicitud inválida' });
  }

  if (err.code === 11000) {
    return res.status(409).json({ error: 'No se pudo completar el registro' });
  }

  return res.status(500).json({ error: 'Internal server error' });
}

module.exports = { errorHandler };
