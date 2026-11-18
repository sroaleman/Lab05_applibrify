const express = require('express');
const { createPaymentOrderSchema, capturePaymentOrderSchema } = require('../validators/payments');
const { createPaymentForOrder, capturePaymentForOrder } = require('../services/payments');

function createPaymentsRouter(paypalClient) {
  const router = express.Router();

  // POST /api/payments/paypal/order - Crear orden en PayPal para el pedido
  router.post('/paypal/order', async (req, res, next) => {
    try {
      const { orderId } = createPaymentOrderSchema.parse(req.body);

      try {
        const result = await createPaymentForOrder(req.user._id, orderId, paypalClient);
        return res.status(201).json(result);
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

  // POST /api/payments/paypal/capture - Capturar orden en PayPal y confirmar pedido
  router.post('/paypal/capture', async (req, res, next) => {
    try {
      const { orderId, providerOrderId } = capturePaymentOrderSchema.parse(req.body);

      try {
        const result = await capturePaymentForOrder(
          req.user._id,
          orderId,
          providerOrderId,
          paypalClient
        );
        return res.status(200).json(result);
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

  return router;
}

const defaultPaymentsRouter = createPaymentsRouter();

module.exports = defaultPaymentsRouter;
module.exports.createPaymentsRouter = createPaymentsRouter;
