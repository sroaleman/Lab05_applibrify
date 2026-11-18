const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Cart = require('../models/Cart');
const Book = require('../models/Book');
const { adjustStock } = require('./stock');
const { paypalClient } = require('./paypal');

/**
 * Inicia el proceso de pago con PayPal para un pedido.
 * El monto se recalcula y extrae directamente del Order persistido.
 */
async function createPaymentForOrder(userId, orderId, client = paypalClient) {
  const order = await Order.findOne({ _id: orderId, userId });
  if (!order) {
    const err = new Error('Pedido no encontrado');
    err.status = 404;
    throw err;
  }

  if (order.status !== 'PENDING_PAYMENT') {
    const err = new Error('El pedido no está pendiente de pago');
    err.status = 400;
    throw err;
  }

  // Si ya existía un Payment CREATED para esta orden, podemos reusarlo o generar uno nuevo
  let paypalOrder;
  try {
    paypalOrder = await client.createPayPalOrder({
      amount: order.total,
      currency: order.currency,
      referenceId: order._id,
    });
  } catch (err) {
    const serviceError = new Error('Error de comunicación con la pasarela de pagos');
    serviceError.status = 502;
    throw serviceError;
  }

  const payment = await Payment.create({
    orderId: order._id,
    provider: 'PAYPAL',
    providerOrderId: paypalOrder.id,
    amount: order.total,
    currency: order.currency,
    status: 'CREATED',
  });

  return {
    providerOrderId: payment.providerOrderId,
  };
}

/**
 * Captura y valida un pago de PayPal para un pedido.
 */
async function capturePaymentForOrder(userId, orderId, providerOrderId, client = paypalClient) {
  // a) Verificar propiedad
  const order = await Order.findOne({ _id: orderId, userId });
  if (!order) {
    const err = new Error('Pedido no encontrado');
    err.status = 404;
    throw err;
  }

  const payment = await Payment.findOne({ orderId: order._id, providerOrderId });
  if (!payment) {
    const err = new Error('Registro de pago no encontrado');
    err.status = 404;
    throw err;
  }

  // b) Idempotencia: si ya está CAPTURED, no vuelve a procesar ni a descontar stock
  if (payment.status === 'CAPTURED') {
    return {
      status: 'CAPTURED',
      orderId: order._id,
      captureId: payment.captureId,
      message: 'Pago ya procesado previamente',
    };
  }

  // c) Captura en PayPal
  let captureResult;
  try {
    captureResult = await client.capturePayPalOrder(providerOrderId);
  } catch (err) {
    const serviceError = new Error('Error al procesar el pago con PayPal');
    serviceError.status = 502;
    throw serviceError;
  }

  // Validaciones del pago
  const isStatusValid = captureResult.status === 'COMPLETED';
  const isCurrencyValid = captureResult.currency === order.currency;
  // Comparación numérica con tolerancia de centavos
  const isAmountValid =
    captureResult.amount !== null &&
    Math.abs(Number(captureResult.amount) - Number(order.total)) < 0.001;

  if (!isStatusValid || !isCurrencyValid || !isAmountValid) {
    payment.status = 'FAILED';
    await payment.save();

    const err = new Error('Los datos de la captura no coinciden con el pedido');
    err.status = 409;
    throw err;
  }

  // d) Descontar stock para libros físicos con compensación en caso de fallo
  const discountedMovements = [];
  const physicalItems = order.items.filter((item) => item.productType === 'PHYSICAL');

  try {
    for (const item of physicalItems) {
      await adjustStock({
        bookId: item.bookId,
        delta: -item.qty,
        reason: 'Venta confirmada por PayPal',
        type: 'SALE',
        orderId: order._id,
      });

      discountedMovements.push({
        bookId: item.bookId,
        qty: item.qty,
      });
    }
  } catch (stockErr) {
    // e) Revertir compensando líneas descontadas previamente
    for (const reverted of discountedMovements) {
      try {
        await adjustStock({
          bookId: reverted.bookId,
          delta: reverted.qty,
          reason: 'Compensación por fallo en procesamiento de venta',
          type: 'RETURN',
          orderId: order._id,
        });
      } catch (revertErr) {
        console.error('Error al compensar stock', revertErr.message);
      }
    }

    payment.status = 'FAILED';
    await payment.save();

    const err = new Error('Stock insuficiente al confirmar el pago');
    err.status = 409;
    throw err;
  }

  // d) Actualizar Payment a CAPTURED
  payment.status = 'CAPTURED';
  payment.captureId = captureResult.captureId;
  await payment.save();

  // Actualizar Order a PAID y paymentStatus CAPTURED
  order.status = 'PAID';
  order.paymentStatus = 'CAPTURED';
  await order.save();

  // Vaciar el carrito del usuario
  await Cart.findOneAndUpdate({ userId }, { items: [] });

  return {
    status: 'CAPTURED',
    orderId: order._id,
    captureId: payment.captureId,
  };
}

module.exports = {
  createPaymentForOrder,
  capturePaymentForOrder,
};
