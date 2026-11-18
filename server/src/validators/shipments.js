const { z } = require('zod');

const createShipmentSchema = z.object({
  orderId: z.string().trim().regex(/^[0-9a-fA-F]{24}$/, {
    message: 'orderId debe ser un ObjectId válido',
  }),
  carrier: z.string().trim().min(2).max(60).optional(),
  trackingNumber: z.string().trim().min(3).max(60).optional(),
});

const updateShipmentSchema = z.object({
  carrier: z.string().trim().min(2).max(60).optional(),
  trackingNumber: z.string().trim().min(3).max(60).optional(),
  status: z
    .enum(['PREPARING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'INCIDENT'])
    .optional(),
  note: z.string().trim().max(200).optional(),
});

module.exports = {
  createShipmentSchema,
  updateShipmentSchema,
};
