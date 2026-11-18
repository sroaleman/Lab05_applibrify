const express = require('express');
const mongoose = require('mongoose');
const Shipment = require('../models/Shipment');
const { createShipmentForOrder, updateShipment } = require('../services/shipments');
const { createShipmentSchema, updateShipmentSchema } = require('../validators/shipments');

const router = express.Router();

// GET /api/shipments - Lista de envíos (más reciente al más antiguo)
router.get('/', async (req, res, next) => {
  try {
    const shipments = await Shipment.find().sort({ createdAt: -1 });
    return res.status(200).json(shipments.map((s) => s.toJSON()));
  } catch (err) {
    return next(err);
  }
});

// POST /api/shipments - Crear envío para un pedido pagado
router.post('/', async (req, res, next) => {
  try {
    const data = createShipmentSchema.parse(req.body);

    try {
      const shipment = await createShipmentForOrder(data.orderId, data);
      return res.status(201).json(shipment.toJSON());
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ error: err.message });
      }
      throw err;
    }
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/shipments/:id - Actualizar estado y datos de envío
router.patch('/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Solicitud inválida' });
    }

    const data = updateShipmentSchema.parse(req.body);

    try {
      const updated = await updateShipment(req.params.id, data);
      return res.status(200).json(updated.toJSON());
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ error: err.message });
      }
      throw err;
    }
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
