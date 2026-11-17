const { z } = require('zod');

const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message: 'El slug debe estar en minúsculas y sin espacios (formato kebab-case)',
    }),
});

const updateCategorySchema = createCategorySchema.partial();

const createBookSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    author: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).optional().default(''),
    categoryId: z.string().trim().regex(/^[0-9a-fA-F]{24}$/, {
      message: 'categoryId debe ser un ObjectId válido',
    }),
    price: z.number().positive(),
    currency: z.string().trim().optional(),
    productType: z.enum(['DIGITAL', 'PHYSICAL']),
    coverUrl: z.string().trim().optional().default(''),
    fileKey: z.string().trim().optional(),
    stock: z.number().int().nonnegative().optional().default(0),
    isActive: z.boolean().optional().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.productType === 'DIGITAL') {
      if (!data.fileKey || data.fileKey.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'fileKey es obligatorio para productos DIGITAL',
          path: ['fileKey'],
        });
      }
    }
  });

const updateBookSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    author: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).optional(),
    categoryId: z
      .string()
      .trim()
      .regex(/^[0-9a-fA-F]{24}$/, {
        message: 'categoryId debe ser un ObjectId válido',
      })
      .optional(),
    price: z.number().positive().optional(),
    currency: z.string().trim().optional(),
    productType: z.enum(['DIGITAL', 'PHYSICAL']).optional(),
    coverUrl: z.string().trim().optional(),
    fileKey: z.string().trim().optional(),
    stock: z.number().int().nonnegative().optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.productType === 'DIGITAL' && data.fileKey !== undefined) {
      if (!data.fileKey || data.fileKey.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'fileKey no puede estar vacío para productos DIGITAL',
          path: ['fileKey'],
        });
      }
    }
  });

const catalogQuerySchema = z.object({
  q: z.string().trim().optional(),
  category: z.string().trim().optional(),
  productType: z.enum(['DIGITAL', 'PHYSICAL']).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
  sort: z.enum(['price_asc', 'price_desc', 'newest', 'oldest', 'title_asc', 'title_desc']).optional().default('newest'),
});

module.exports = {
  createCategorySchema,
  updateCategorySchema,
  createBookSchema,
  updateBookSchema,
  catalogQuerySchema,
};

