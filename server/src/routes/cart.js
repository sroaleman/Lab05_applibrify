const express = require('express');
const mongoose = require('mongoose');
const { getCartView, setItem } = require('../services/cart');
const { cartItemSchema, bookIdParamSchema } = require('../validators/cart');

const router = express.Router();

// GET /api/cart - Vista del carrito con subtotales y total
router.get('/', async (req, res, next) => {
  try {
    const view = await getCartView(req.user._id);
    return res.status(200).json(view);
  } catch (err) {
    return next(err);
  }
});

// PUT /api/cart/items/:bookId - Agregar, modificar o quitar (qty 0)
router.put('/items/:bookId', async (req, res, next) => {
  try {
    const { bookId } = bookIdParamSchema.parse(req.params);
    const { qty } = cartItemSchema.parse(req.body);

    try {
      await setItem(req.user._id, bookId, qty);
      const view = await getCartView(req.user._id);
      return res.status(200).json(view);
    } catch (err) {
      if (err.code === 'BOOK_NOT_FOUND') {
        return res.status(404).json({ error: 'Libro no encontrado' });
      }
      if (err.code === 'INSUFFICIENT_STOCK') {
        return res.status(409).json({ error: 'Stock insuficiente' });
      }
      throw err;
    }
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/cart/items/:bookId - Quitar libro del carrito
router.delete('/items/:bookId', async (req, res, next) => {
  try {
    const { bookId } = bookIdParamSchema.parse(req.params);
    await setItem(req.user._id, bookId, 0);
    const view = await getCartView(req.user._id);
    return res.status(200).json(view);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
