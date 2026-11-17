const express = require('express');
const { z } = require('zod');
const User = require('../models/User');

const router = express.Router();

const updateRoleSchema = z.object({
  role: z.enum(['cliente', 'administrador']),
});

router.get('/', async (req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    return res.status(200).json(users.map((u) => u.toJSON()));
  } catch (err) {
    return next(err);
  }
});

router.patch('/:id/role', async (req, res, next) => {
  try {
    const { role } = updateRoleSchema.parse(req.body);

    if (String(req.user._id) === String(req.params.id) && role === 'cliente') {
      return res.status(400).json({ error: 'No puedes quitarte tu propio rol' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    return res.status(200).json(user.toJSON());
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

