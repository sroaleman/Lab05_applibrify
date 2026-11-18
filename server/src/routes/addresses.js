const express = require('express');
const mongoose = require('mongoose');
const Address = require('../models/Address');
const { addressSchema, updateAddressSchema } = require('../validators/address');

const router = express.Router();

// GET /api/addresses - Listar solo las direcciones del usuario autenticado
router.get('/', async (req, res, next) => {
  try {
    const addresses = await Address.find({ userId: req.user._id }).sort({
      isDefault: -1,
      createdAt: -1,
    });
    return res.status(200).json(addresses.map((a) => a.toJSON()));
  } catch (err) {
    return next(err);
  }
});

// POST /api/addresses - Crear dirección para el usuario autenticado
router.post('/', async (req, res, next) => {
  try {
    const data = addressSchema.parse(req.body);

    if (data.isDefault) {
      // Desmarcar otras direcciones principales del usuario
      await Address.updateMany({ userId: req.user._id }, { isDefault: false });
    } else {
      // Si es la primera dirección del usuario, podemos hacerla default opcionalmente,
      // o mantener lo que especifique el cliente.
      const hasAddresses = await Address.exists({ userId: req.user._id });
      if (!hasAddresses) {
        data.isDefault = true;
      }
    }

    const address = await Address.create({
      ...data,
      userId: req.user._id,
    });

    return res.status(201).json(address.toJSON());
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/addresses/:id - Editar dirección
router.patch('/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Solicitud inválida' });
    }

    const data = updateAddressSchema.parse(req.body);

    // Buscar que pertenezca al usuario; si no es del usuario, 404 (no revelar existencia)
    const address = await Address.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!address) {
      return res.status(404).json({ error: 'Dirección no encontrada' });
    }

    if (data.isDefault) {
      await Address.updateMany(
        { userId: req.user._id, _id: { $ne: req.params.id } },
        { isDefault: false }
      );
    }

    Object.assign(address, data);
    await address.save();

    return res.status(200).json(address.toJSON());
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/addresses/:id - Borrar dirección
router.delete('/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Solicitud inválida' });
    }

    const deleted = await Address.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!deleted) {
      return res.status(404).json({ error: 'Dirección no encontrada' });
    }

    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
