const Order = require('../models/Order');
const Address = require('../models/Address');
const Book = require('../models/Book');
const { getCartView } = require('./cart');

/**
 * Crea un pedido a partir del carrito del usuario.
 * NO descuenta stock ni vacía el carrito todavía: eso ocurre en la Etapa 4
 * tras la captura verificada del pago con PayPal.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {string} [addressId]
 * @returns {Promise<Object>} Orden creada
 */
async function createOrderFromCart(userId, addressId) {
  const cartView = await getCartView(userId);

  if (!cartView.items || cartView.items.length === 0) {
    const error = new Error('El carrito está vacío');
    error.code = 'EMPTY_CART';
    error.status = 400;
    throw error;
  }

  const hasPhysical = cartView.items.some((item) => item.productType === 'PHYSICAL');

  let shippingAddressSnapshot = null;

  if (hasPhysical) {
    if (!addressId) {
      const error = new Error('Dirección requerida');
      error.code = 'ADDRESS_REQUIRED';
      error.status = 400;
      throw error;
    }

    const address = await Address.findOne({ _id: addressId, userId });
    if (!address) {
      const error = new Error('Dirección no encontrada');
      error.code = 'ADDRESS_NOT_FOUND';
      error.status = 404;
      throw error;
    }

    shippingAddressSnapshot = {
      recipient: address.recipient,
      line1: address.line1,
      line2: address.line2 || '',
      city: address.city,
      region: address.region,
      postalCode: address.postalCode,
      country: address.country,
      phone: address.phone,
    };
  }

  // Validar stock de cada libro físico directamente desde Book
  const bookIds = cartView.items.map((i) => i.bookId);
  const books = await Book.find({ _id: { $in: bookIds } });
  const booksMap = new Map(books.map((b) => [String(b._id), b]));

  const orderItems = [];
  let subtotal = 0;
  let currency = process.env.CURRENCY_CODE || 'USD';

  for (const item of cartView.items) {
    const book = booksMap.get(String(item.bookId));
    if (!book || !book.isActive) {
      const error = new Error('Libro no disponible');
      error.code = 'BOOK_NOT_FOUND';
      error.status = 404;
      throw error;
    }

    if (book.productType === 'PHYSICAL') {
      if (book.stock < item.qty) {
        const error = new Error('Stock insuficiente');
        error.code = 'INSUFFICIENT_STOCK';
        error.status = 409;
        throw error;
      }
    }

    const unitPrice = book.price;
    const lineTotal = Math.round(unitPrice * item.qty * 100) / 100;
    subtotal = Math.round((subtotal + lineTotal) * 100) / 100;
    currency = book.currency || currency;

    orderItems.push({
      bookId: book._id,
      titleSnapshot: book.title,
      productType: book.productType,
      unitPrice,
      qty: item.qty,
      lineTotal,
    });
  }

  const total = subtotal;

  const order = await Order.create({
    userId,
    items: orderItems,
    subtotal,
    total,
    currency,
    shippingAddress: shippingAddressSnapshot,
    status: 'PENDING_PAYMENT',
    paymentStatus: 'CREATED',
  });

  return order;
}

module.exports = {
  createOrderFromCart,
};
