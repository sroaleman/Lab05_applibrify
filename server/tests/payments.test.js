const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
const Category = require('../src/models/Category');
const Book = require('../src/models/Book');
const Cart = require('../src/models/Cart');
const Address = require('../src/models/Address');
const Order = require('../src/models/Order');
const Payment = require('../src/models/Payment');
const { createApp } = require('../src/app');
const { createPaymentsRouter } = require('../src/routes/payments');

const testUri = process.env.MONGODB_TEST_URI;
if (!testUri) {
  console.error(
    'ERROR: La variable de entorno MONGODB_TEST_URI no está definida. Pruebas abortadas para no afectar la base de datos de desarrollo.'
  );
  process.exit(1);
}

let dbName = '';
try {
  const parsed = new URL(testUri);
  dbName = parsed.pathname.replace(/^\//, '').split('?')[0];
} catch (e) {
  dbName = testUri.split('?')[0].split('/').pop();
}

if (!dbName.includes('_test')) {
  console.error(
    `ERROR: El nombre de la base de datos en MONGODB_TEST_URI ("${dbName}") no contiene "_test". Pruebas abortadas para proteger la base de datos de desarrollo.`
  );
  process.exit(1);
}

describe('Bloque 4A - Pagos con PayPal (Sandbox / Doble Simulado)', () => {
  let app;
  let mockPayPal;
  let userACookie;
  let userBCookie;
  let userAId;
  let userBId;
  let physicalBook;
  let userAAddress;
  let sampleOrder;

  // Spies para verificar ausencia de secrets y tokens en logs
  let loggedMessages = [];
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  before(async () => {
    await mongoose.connect(testUri);
  });

  after(async () => {
    await mongoose.disconnect();
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  beforeEach(async () => {
    loggedMessages = [];
    console.log = (...args) => {
      loggedMessages.push(args.map(String).join(' '));
      originalConsoleLog(...args);
    };
    console.error = (...args) => {
      loggedMessages.push(args.map(String).join(' '));
      originalConsoleError(...args);
    };

    await Payment.deleteMany({});
    await Order.deleteMany({});
    await Address.deleteMany({});
    await Cart.deleteMany({});
    await Book.deleteMany({});
    await Category.deleteMany({});
    await User.deleteMany({});

    const passHash = await bcrypt.hash('password123', 12);

    const userA = await User.create({
      name: 'User A',
      email: 'usera@example.com',
      passwordHash: passHash,
      role: 'cliente',
    });
    userAId = userA._id;

    const userB = await User.create({
      name: 'User B',
      email: 'userb@example.com',
      passwordHash: passHash,
      role: 'cliente',
    });
    userBId = userB._id;

    // Doble simulado de PayPal por defecto
    mockPayPal = {
      calls: { createOrder: 0, captureOrder: 0 },
      createPayPalOrder: async ({ amount, currency, referenceId }) => {
        mockPayPal.calls.createOrder++;
        return { id: 'PAYPAL-ORDER-12345' };
      },
      capturePayPalOrder: async (providerOrderId) => {
        mockPayPal.calls.captureOrder++;
        return {
          id: providerOrderId,
          status: 'COMPLETED',
          captureId: 'CAPTURE-ID-99999',
          amount: 50.0,
          currency: 'USD',
        };
      },
    };

    app = createApp({
      paymentsRouter: createPaymentsRouter(mockPayPal),
    });

    const loginA = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email: 'usera@example.com', password: 'password123' });
    userACookie = loginA.headers['set-cookie']
      .map((c) => c.split(';')[0])
      .join('; ');

    const loginB = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email: 'userb@example.com', password: 'password123' });
    userBCookie = loginB.headers['set-cookie']
      .map((c) => c.split(';')[0])
      .join('; ');

    const category = await Category.create({ name: 'Ficción', slug: 'ficcion' });

    physicalBook = await Book.create({
      title: 'Libro Físico Pagos',
      author: 'Autor Test',
      categoryId: category._id,
      price: 50.0,
      currency: 'USD',
      productType: 'PHYSICAL',
      stock: 10,
      isActive: true,
    });

    userAAddress = await Address.create({
      userId: userAId,
      recipient: 'User A Recipient',
      line1: 'Calle 100',
      city: 'Bogota',
      region: 'Cundinamarca',
      postalCode: '110111',
      country: 'Colombia',
      phone: '+573001112233',
    });

    // Crear pedido base para User A: 1 physicalBook (total = 50.0)
    sampleOrder = await Order.create({
      userId: userAId,
      items: [
        {
          bookId: physicalBook._id,
          titleSnapshot: physicalBook.title,
          productType: 'PHYSICAL',
          unitPrice: 50.0,
          qty: 1,
          lineTotal: 50.0,
        },
      ],
      subtotal: 50.0,
      total: 50.0,
      currency: 'USD',
      shippingAddress: {
        recipient: userAAddress.recipient,
        line1: userAAddress.line1,
        city: userAAddress.city,
        region: userAAddress.region,
        postalCode: userAAddress.postalCode,
        country: userAAddress.country,
        phone: userAAddress.phone,
      },
      status: 'PENDING_PAYMENT',
      paymentStatus: 'CREATED',
    });

    // Poner el item en el carrito de User A para verificar su vaciado posterior
    await Cart.create({
      userId: userAId,
      items: [{ bookId: physicalBook._id, qty: 1 }],
    });
  });

  test('Crear pago de pedido propio: 201 y Payment CREATED', async () => {
    const res = await request(app)
      .post('/api/payments/paypal/order')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({ orderId: sampleOrder._id.toString() });

    assert.equal(res.status, 201);
    assert.equal(res.body.providerOrderId, 'PAYPAL-ORDER-12345');

    const payment = await Payment.findOne({ orderId: sampleOrder._id });
    assert.ok(payment);
    assert.equal(payment.status, 'CREATED');
    assert.equal(payment.amount, 50.0);
    assert.equal(payment.currency, 'USD');
  });

  test('Crear pago de pedido ajeno: 404', async () => {
    const res = await request(app)
      .post('/api/payments/paypal/order')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userBCookie)
      .send({ orderId: sampleOrder._id.toString() });

    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: 'Pedido no encontrado' });
  });

  test('Capturar con monto distinto al del pedido: 409, pedido sigue PENDING_PAYMENT, stock igual', async () => {
    // 1. Crear el pago
    await request(app)
      .post('/api/payments/paypal/order')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({ orderId: sampleOrder._id.toString() });

    // Modificar el mock para que devuelva un monto capturado diferente (ej. 30.0 en vez de 50.0)
    mockPayPal.capturePayPalOrder = async (providerOrderId) => ({
      id: providerOrderId,
      status: 'COMPLETED',
      captureId: 'CAPTURE-WRONG-AMOUNT',
      amount: 30.0,
      currency: 'USD',
    });

    const res = await request(app)
      .post('/api/payments/paypal/capture')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({
        orderId: sampleOrder._id.toString(),
        providerOrderId: 'PAYPAL-ORDER-12345',
      });

    assert.equal(res.status, 409);
    assert.deepEqual(res.body, {
      error: 'Los datos de la captura no coinciden con el pedido',
    });

    // Comprobar que el pedido sigue en PENDING_PAYMENT
    const orderInDb = await Order.findById(sampleOrder._id);
    assert.equal(orderInDb.status, 'PENDING_PAYMENT');

    // Comprobar que el stock no cambió
    const bookInDb = await Book.findById(physicalBook._id);
    assert.equal(bookInDb.stock, 10);

    // Comprobar que el pago quedó en FAILED
    const payment = await Payment.findOne({ orderId: sampleOrder._id });
    assert.equal(payment.status, 'FAILED');
  });

  test('Captura válida: pedido PAID, paymentStatus CAPTURED, stock descontado, carrito vacío', async () => {
    // 1. Crear el pago
    await request(app)
      .post('/api/payments/paypal/order')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({ orderId: sampleOrder._id.toString() });

    // 2. Capturar
    const res = await request(app)
      .post('/api/payments/paypal/capture')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({
        orderId: sampleOrder._id.toString(),
        providerOrderId: 'PAYPAL-ORDER-12345',
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'CAPTURED');
    assert.equal(res.body.captureId, 'CAPTURE-ID-99999');

    // Verificar Order
    const orderInDb = await Order.findById(sampleOrder._id);
    assert.equal(orderInDb.status, 'PAID');
    assert.equal(orderInDb.paymentStatus, 'CAPTURED');

    // Verificar Stock descontado (10 - 1 = 9)
    const bookInDb = await Book.findById(physicalBook._id);
    assert.equal(bookInDb.stock, 9);

    // Verificar carrito vacío
    const cartInDb = await Cart.findOne({ userId: userAId });
    assert.equal(cartInDb.items.length, 0);
  });

  test('Captura repetida: no vuelve a descontar stock ni a llamar a PayPal', async () => {
    // 1. Crear el pago
    await request(app)
      .post('/api/payments/paypal/order')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({ orderId: sampleOrder._id.toString() });

    // 2. Primera captura
    await request(app)
      .post('/api/payments/paypal/capture')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({
        orderId: sampleOrder._id.toString(),
        providerOrderId: 'PAYPAL-ORDER-12345',
      });

    assert.equal(mockPayPal.calls.captureOrder, 1);

    // 3. Segunda captura
    const res2 = await request(app)
      .post('/api/payments/paypal/capture')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({
        orderId: sampleOrder._id.toString(),
        providerOrderId: 'PAYPAL-ORDER-12345',
      });

    assert.equal(res2.status, 200);
    assert.equal(res2.body.status, 'CAPTURED');
    // No debe haber llamado a PayPal una segunda vez
    assert.equal(mockPayPal.calls.captureOrder, 1);

    // El stock debe permanecer descontado una sola vez (9, no 8)
    const bookInDb = await Book.findById(physicalBook._id);
    assert.equal(bookInDb.stock, 9);
  });

  test('PayPal responde error: 502, pedido y stock sin cambios', async () => {
    await request(app)
      .post('/api/payments/paypal/order')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({ orderId: sampleOrder._id.toString() });

    // Simular error en captura de PayPal
    mockPayPal.capturePayPalOrder = async () => {
      throw new Error('PayPal gateway error');
    };

    const res = await request(app)
      .post('/api/payments/paypal/capture')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({
        orderId: sampleOrder._id.toString(),
        providerOrderId: 'PAYPAL-ORDER-12345',
      });

    assert.equal(res.status, 502);

    const orderInDb = await Order.findById(sampleOrder._id);
    assert.equal(orderInDb.status, 'PENDING_PAYMENT');

    const bookInDb = await Book.findById(physicalBook._id);
    assert.equal(bookInDb.stock, 10);
  });

  test('Cliente que intenta capturar pedido ajeno: 404', async () => {
    await request(app)
      .post('/api/payments/paypal/order')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({ orderId: sampleOrder._id.toString() });

    const res = await request(app)
      .post('/api/payments/paypal/capture')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userBCookie)
      .send({
        orderId: sampleOrder._id.toString(),
        providerOrderId: 'PAYPAL-ORDER-12345',
      });

    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: 'Pedido no encontrado' });
  });

  test('El monto se toma del pedido, aunque el body incluya un monto distinto', async () => {
    let capturedAmountInMock = null;
    mockPayPal.createPayPalOrder = async ({ amount }) => {
      capturedAmountInMock = amount;
      return { id: 'PAYPAL-ORDER-CUSTOM' };
    };

    const res = await request(app)
      .post('/api/payments/paypal/order')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({
        orderId: sampleOrder._id.toString(),
        amount: 1.0, // Monto falso enviado en el body
      });

    assert.equal(res.status, 201);
    assert.equal(capturedAmountInMock, 50.0);
  });

  test('Ningún log contiene el secret ni el token (verificar con un spy en console)', async () => {
    const fakeSecret = 'SUPER_SECRET_PAYPAL_KEY_XYZ';
    const fakeToken = 'ACCESS_TOKEN_ABC123456789';

    // Ejecutar flujo de orden y captura
    await request(app)
      .post('/api/payments/paypal/order')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({ orderId: sampleOrder._id.toString() });

    await request(app)
      .post('/api/payments/paypal/capture')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({
        orderId: sampleOrder._id.toString(),
        providerOrderId: 'PAYPAL-ORDER-12345',
      });

    const combinedLogs = loggedMessages.join('\n');
    assert.equal(combinedLogs.includes(fakeSecret), false);
    assert.equal(combinedLogs.includes(fakeToken), false);
    assert.equal(combinedLogs.includes(process.env.PAYPAL_CLIENT_SECRET || 'NONE'), false);
  });
});
