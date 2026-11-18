const Cart = require('../models/Cart');
const Book = require('../models/Book');

/**
 * Obtiene o crea el carrito para un usuario.
 */
async function getOrCreateCart(userId) {
  let cart = await Cart.findOne({ userId });
  if (!cart) {
    cart = await Cart.create({ userId, items: [] });
  }
  return cart;
}

/**
 * Modifica o elimina un ítem del carrito.
 * Valida que el libro exista, esté activo y tenga stock suficiente si es físico.
 * Si qty es 0, quita el ítem del carrito.
 * Nunca almacena precios en el carrito (se resuelven siempre desde Book).
 */
async function setItem(userId, bookId, qty) {
  const cart = await getOrCreateCart(userId);

  if (qty === 0) {
    cart.items = cart.items.filter((item) => String(item.bookId) !== String(bookId));
    await cart.save();
    return cart;
  }

  const book = await Book.findById(bookId);
  if (!book || !book.isActive) {
    const error = new Error('Libro no encontrado o no disponible');
    error.code = 'BOOK_NOT_FOUND';
    throw error;
  }

  // Validación de stock (para libros físicos)
  if (book.productType === 'PHYSICAL' && book.stock < qty) {
    const error = new Error('Stock insuficiente');
    error.code = 'INSUFFICIENT_STOCK';
    throw error;
  }

  const existingIndex = cart.items.findIndex(
    (item) => String(item.bookId) === String(bookId)
  );

  if (existingIndex >= 0) {
    cart.items[existingIndex].qty = qty;
  } else {
    cart.items.push({ bookId, qty });
  }

  await cart.save();
  return cart;
}

/**
 * Devuelve la vista completa del carrito calculada en el servidor.
 * Items con title, productType, price, currency, qty, subtotal por línea y total global.
 * No expone fileKey ni stock exacto.
 */
async function getCartView(userId) {
  const cart = await getOrCreateCart(userId);

  if (!cart.items || cart.items.length === 0) {
    return {
      items: [],
      total: 0,
    };
  }

  const bookIds = cart.items.map((item) => item.bookId);
  const books = await Book.find({ _id: { $in: bookIds }, isActive: true });
  const booksMap = new Map(books.map((b) => [String(b._id), b]));

  const viewItems = [];
  let total = 0;

  for (const item of cart.items) {
    const book = booksMap.get(String(item.bookId));
    if (!book) {
      // Si el libro fue eliminado o inactivado, se omite de la vista activa
      continue;
    }

    const price = book.price;
    const subtotal = Math.round(price * item.qty * 100) / 100;
    total = Math.round((total + subtotal) * 100) / 100;

    viewItems.push({
      bookId: book._id,
      title: book.title,
      productType: book.productType,
      coverUrl: book.coverUrl || '',
      price: book.price,
      currency: book.currency,
      qty: item.qty,
      subtotal,
    });
  }

  return {
    items: viewItems,
    total,
  };
}

module.exports = {
  getOrCreateCart,
  setItem,
  getCartView,
};
