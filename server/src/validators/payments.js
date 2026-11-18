const { z } = require('zod');

const createPaymentOrderSchema = z.object({
  orderId: z.string().trim().regex(/^[0-9a-fA-F]{24}$/, {
    message: 'orderId debe ser un ObjectId válido',
  }),
});

const capturePaymentOrderSchema = z.object({
  orderId: z.string().trim().regex(/^[0-9a-fA-F]{24}$/, {
    message: 'orderId debe ser un ObjectId válido',
  }),
  providerOrderId: z.string().trim().min(1, {
    message: 'providerOrderId es requerido',
  }),
});

module.exports = {
  createPaymentOrderSchema,
  capturePaymentOrderSchema,
};
