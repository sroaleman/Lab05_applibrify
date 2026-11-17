const express = require('express');
const mongoose = require('mongoose');
const Book = require('../models/Book');
const Category = require('../models/Category');
const StockMovement = require('../models/StockMovement');
const { auth } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/requireRole');
const { adjustStock } = require('../services/stock');
const {
  createBookSchema,
  updateBookSchema,
  catalogQuerySchema,
  stockAdjustSchema,
} = require('../validators/catalog');

const router = express.Router();

// GET /api/books - Público: catálogo con filtros, búsqueda, paginación y orden
router.get('/', async (req, res, next) => {
  try {
    const queryParams = catalogQuerySchema.parse(req.query);
    const filter = { isActive: true };

    if (queryParams.q) {
      const escaped = queryParams.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { author: { $regex: escaped, $options: 'i' } },
      ];
    }

    if (queryParams.productType) {
      filter.productType = queryParams.productType;
    }

    if (queryParams.category) {
      if (mongoose.Types.ObjectId.isValid(queryParams.category)) {
        filter.categoryId = queryParams.category;
      } else {
        const cat = await Category.findOne({ slug: queryParams.category.toLowerCase() });
        if (cat) {
          filter.categoryId = cat._id;
        } else {
          return res.status(200).json({
            items: [],
            total: 0,
            page: queryParams.page,
            limit: queryParams.limit,
            totalPages: 0,
          });
        }
      }
    }

    let sortOption = { createdAt: -1 };
    switch (queryParams.sort) {
      case 'price_asc':
        sortOption = { price: 1 };
        break;
      case 'price_desc':
        sortOption = { price: -1 };
        break;
      case 'oldest':
        sortOption = { createdAt: 1 };
        break;
      case 'title_asc':
        sortOption = { title: 1 };
        break;
      case 'title_desc':
        sortOption = { title: -1 };
        break;
      case 'newest':
      default:
        sortOption = { createdAt: -1 };
        break;
    }

    const skip = (queryParams.page - 1) * queryParams.limit;
    const [books, total] = await Promise.all([
      Book.find(filter)
        .populate('categoryId', 'name slug')
        .sort(sortOption)
        .skip(skip)
        .limit(queryParams.limit),
      Book.countDocuments(filter),
    ]);

    return res.status(200).json({
      items: books.map((b) => b.toJSON()),
      total,
      page: queryParams.page,
      limit: queryParams.limit,
      totalPages: Math.ceil(total / queryParams.limit),
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/books/:id - Público: detalle de un libro
router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Solicitud inválida' });
    }

    const book = await Book.findOne({ _id: req.params.id, isActive: true }).populate(
      'categoryId',
      'name slug'
    );

    if (!book) {
      return res.status(404).json({ error: 'Libro no encontrado' });
    }

    return res.status(200).json(book.toJSON());
  } catch (err) {
    return next(err);
  }
});

// POST /api/books - Solo administrador
router.post('/', auth, requireRole('administrador'), async (req, res, next) => {
  try {
    const data = createBookSchema.parse(req.body);

    const categoryExists = await Category.exists({ _id: data.categoryId });
    if (!categoryExists) {
      return res.status(400).json({ error: 'La categoría no existe' });
    }

    if (data.productType === 'PHYSICAL') {
      delete data.fileKey;
    }

    const book = await Book.create(data);
    return res.status(201).json(book.toJSON());
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/books/:id - Solo administrador
router.patch('/:id', auth, requireRole('administrador'), async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Solicitud inválida' });
    }

    const data = updateBookSchema.parse(req.body);

    if (data.categoryId) {
      const categoryExists = await Category.exists({ _id: data.categoryId });
      if (!categoryExists) {
        return res.status(400).json({ error: 'La categoría no existe' });
      }
    }

    const existingBook = await Book.findById(req.params.id);
    if (!existingBook) {
      return res.status(404).json({ error: 'Libro no encontrado' });
    }

    const finalProductType = data.productType || existingBook.productType;
    if (finalProductType === 'PHYSICAL') {
      data.fileKey = undefined;
      existingBook.fileKey = undefined;
    }

    Object.assign(existingBook, data);
    await existingBook.save();

    return res.status(200).json(existingBook.toJSON());
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/books/:id/stock - Solo administrador: ajuste de stock
router.patch('/:id/stock', auth, requireRole('administrador'), async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Solicitud inválida' });
    }

    const { delta, reason } = stockAdjustSchema.parse(req.body);

    try {
      const updatedBook = await adjustStock({
        bookId: req.params.id,
        delta,
        reason,
        adminId: req.user._id,
      });

      return res.status(200).json(updatedBook.toJSON());
    } catch (err) {
      if (err.code === 'INSUFFICIENT_STOCK') {
        return res.status(409).json({ error: 'Stock insuficiente' });
      }
      if (err.code === 'BOOK_NOT_FOUND') {
        return res.status(404).json({ error: 'Libro no encontrado' });
      }
      throw err;
    }
  } catch (err) {
    return next(err);
  }
});

// GET /api/books/:id/movements - Solo administrador: últimos 50 movimientos
router.get('/:id/movements', auth, requireRole('administrador'), async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Solicitud inválida' });
    }

    const movements = await StockMovement.find({ bookId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(50);

    return res.status(200).json(movements.map((m) => m.toJSON()));
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/books/:id - Solo administrador (soft delete)
router.delete('/:id', auth, requireRole('administrador'), async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Solicitud inválida' });
    }

    const book = await Book.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!book) {
      return res.status(404).json({ error: 'Libro no encontrado' });
    }

    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
