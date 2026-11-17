const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

router.get('/health', (req, res) => {
  const db = mongoose.connection.readyState === 1 ? 'ok' : 'error';
  res.status(200).json({
    status: 'ok',
    db,
  });
});

module.exports = router;
