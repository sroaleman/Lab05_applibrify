const { z } = require('zod');

const addressSchema = z.object({
  label: z.string().trim().max(50).optional().default(''),
  recipient: z.string().trim().min(1).max(120),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional().default(''),
  city: z.string().trim().min(1).max(100),
  region: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().min(1).max(20),
  country: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(1).max(30),
  isDefault: z.boolean().optional().default(false),
});

const updateAddressSchema = addressSchema.partial();

module.exports = {
  addressSchema,
  updateAddressSchema,
};
