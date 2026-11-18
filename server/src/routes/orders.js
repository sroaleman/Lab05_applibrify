const express = require('express');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Shipment = require('../models/Shipment');
const { createOrderFromCart } = require('../services/orders');
const { createOrderSchema } = require('../validators/orders');

const router = express.Router();

// POST /api/orders - Crear pedido desde el carrito
router.post('/', async (req, res, next) => {
  try {
    const { addressId } = createOrderSchema.parse(req.body);

    try {
      const order = await createOrderFromCart(req.user._id, addressId);
      return res.status(201).json(order.toJSON());
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

// GET /api/orders/me - Historial del usuario, más reciente al más antiguo
router.get('/me', async (req, res, next) => {
  try {
    const orders = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 });
    return res.status(200).json(orders.map((o) => o.toJSON()));
  } catch (err) {
    return next(err);
  }
});

// GET /api/orders/:id - Detalle de pedido con envío asociado
router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Solicitud inválida' });
    }

    const order = await Order.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const orderData = order.toJSON();

    // Consultar si tiene un envío asociado
    const shipment = await Shipment.findOne({ orderId: order._id });
    if (shipment) {
      orderData.shipment = {
        status: shipment.status,
        carrier: shipment.carrier,
        trackingNumber: shipment.trackingNumber,
        events: shipment.events,
      };
    } else {
      orderData.shipment = null;
    }

    return res.status(200).json(orderData);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
