const express = require('express');
const mongoose = require('mongoose');
const Category = require('../models/Category');
const Book = require('../models/Book');
const { auth } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/requireRole');
const {
  createCategorySchema,
  updateCategorySchema,
} = require('../validators/catalog');

const router = express.Router();

// GET /api/categories - Público
router.get('/', async (req, res, next) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    return res.status(200).json(categories.map((c) => c.toJSON()));
  } catch (err) {
    return next(err);
  }
});

// POST /api/categories - Solo administrador
router.post('/', auth, requireRole('administrador'), async (req, res, next) => {
  try {
    const data = createCategorySchema.parse(req.body);
    const category = await Category.create(data);
    return res.status(201).json(category.toJSON());
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/categories/:id - Solo administrador
router.patch('/:id', auth, requireRole('administrador'), async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Solicitud inválida' });
    }

    const data = updateCategorySchema.parse(req.body);
    const category = await Category.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true,
    });

    if (!category) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    return res.status(200).json(category.toJSON());
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/categories/:id - Solo administrador
router.delete('/:id', auth, requireRole('administrador'), async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Solicitud inválida' });
    }

    const hasBooks = await Book.exists({ categoryId: req.params.id });
    if (hasBooks) {
      return res.status(409).json({ error: 'La categoría tiene libros' });
    }

    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

