const { z } = require('zod');

const createOrderSchema = z.object({
  addressId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, {
      message: 'addressId debe ser un ObjectId válido',
    })
    .optional(),
});

module.exports = {
  createOrderSchema,
};
