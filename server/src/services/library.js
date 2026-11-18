const jwt = require('jsonwebtoken');
const LibraryEntry = require('../models/LibraryEntry');
const Order = require('../models/Order');
const Book = require('../models/Book');

/**
 * Concede acceso a los libros digitales de un pedido confirmado.
 * Es idempotente: si ya existe una entrada para (userId, bookId), no duplica.
 */
async function grantAccess(userId, orderId) {
  const order = await Order.findById(orderId);
  if (!order) {
    const err = new Error('Pedido no encontrado');
    err.status = 404;
    throw err;
  }

  const digitalItems = order.items.filter((item) => item.productType === 'DIGITAL');

  for (const item of digitalItems) {
    try {
      await LibraryEntry.create({
        userId,
        bookId: item.bookId,
        orderId: order._id,
      });
    } catch (err) {
      // Ignorar error de duplicado (código 11000) por idempotencia
      if (err.code !== 11000) {
        throw err;
      }
    }
  }
}

/**
 * Lista los libros digitales adquiridos por el usuario.
 * Retorna título, autor y portada. NUNCA expone fileKey.
 */
async function listLibrary(userId) {
  const entries = await LibraryEntry.find({ userId })
    .populate('bookId', 'title author coverUrl')
    .sort({ grantedAt: -1 });

  const books = [];
  for (const entry of entries) {
    if (entry.bookId) {
      books.push({
        bookId: entry.bookId._id,
        title: entry.bookId.title,
        author: entry.bookId.author,
        coverUrl: entry.bookId.coverUrl || '',
        grantedAt: entry.grantedAt,
      });
    }
  }

  return books;
}

/**
 * Genera una URL firmada temporal (5 minutos de expiración) para descargar el archivo.
 */
async function getDownloadUrl(userId, bookId) {
  const entry = await LibraryEntry.findOne({ userId, bookId });
  if (!entry) {
    const err = new Error('No tienes acceso a este libro');
    err.status = 404;
    throw err;
  }

  const token = jwt.sign(
    {
      sub: String(userId),
      bookId: String(bookId),
    },
    process.env.JWT_SECRET,
    { expiresIn: '5m' }
  );

  return `/api/library/${bookId}/file?token=${token}`;
}

module.exports = {
  grantAccess,
  listLibrary,
  getDownloadUrl,
};
