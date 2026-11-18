const { z } = require('zod');

const cartItemSchema = z.object({
  qty: z
    .number()
    .int('qty debe ser un número entero')
    .min(0, 'qty debe ser mayor o igual a 0')
    .max(100, 'qty no puede ser mayor a 100'),
});

const bookIdParamSchema = z.object({
  bookId: z.string().trim().regex(/^[0-9a-fA-F]{24}$/, {
    message: 'bookId debe ser un ObjectId válido',
  }),
});

module.exports = {
  cartItemSchema,
  bookIdParamSchema,
};
