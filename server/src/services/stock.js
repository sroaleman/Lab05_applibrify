const Book = require('../models/Book');
const StockMovement = require('../models/StockMovement');

/**
 * Ajusta el stock de un libro atómicamente y registra el movimiento de inventario.
 *
 * NOTA: La reserva y descuento de stock por ventas físicas se implementará
 * en la Etapa 4, tras la captura y verificación exitosa del pago con PayPal.
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.bookId
 * @param {number} params.delta
 * @param {string} params.reason
 * @param {string|mongoose.Types.ObjectId} [params.adminId]
 * @param {string} [params.type='ADJUSTMENT']
 * @param {string|mongoose.Types.ObjectId} [params.orderId]
 * @returns {Promise<Object>} Libro actualizado
 */
async function adjustStock({ bookId, delta, reason, adminId, type = 'ADJUSTMENT', orderId }) {
  if (!Number.isInteger(delta) || delta === 0) {
    const err = new Error('delta debe ser un número entero distinto de 0');
    err.code = 'INVALID_DELTA';
    throw err;
  }

  // Actualización atómica con condición de no permitir stock negativo
  const updatedBook = await Book.findOneAndUpdate(
    {
      _id: bookId,
      stock: { $gte: -delta },
    },
    { $inc: { stock: delta } },
    { new: true, runValidators: true }
  );

  if (!updatedBook) {
    // Si no encontró el libro, verificar si existe para determinar la causa exacta
    const exists = await Book.findById(bookId);
    if (!exists) {
      const err = new Error('Libro no encontrado');
      err.code = 'BOOK_NOT_FOUND';
      throw err;
    }

    const err = new Error('Stock insuficiente');
    err.code = 'INSUFFICIENT_STOCK';
    throw err;
  }

  // Crear el registro de StockMovement; si falla, revertir el cambio de stock
  try {
    await StockMovement.create({
      bookId,
      delta,
      reason,
      type,
      adminId,
      orderId,
    });
  } catch (creationError) {
    // Compensación / reversión del stock aplicado
    await Book.findByIdAndUpdate(bookId, { $inc: { stock: -delta } });
    throw creationError;
  }

  return updatedBook;
}

module.exports = {
  adjustStock,
};

