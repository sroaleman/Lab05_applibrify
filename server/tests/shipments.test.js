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
const LibraryEntry = require('../src/models/LibraryEntry');
const Shipment = require('../src/models/Shipment');
const { createApp } = require('../src/app');

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

describe('Bloque 4C - Gestión de Envíos Físicos', () => {
  let app;
  let adminCookie;
  let userACookie;
  let userBCookie;
  let userAId;
  let userBId;
  let physicalBook;
  let digitalBook;
  let category;

  before(async () => {
    await mongoose.connect(testUri);
  });

  after(async () => {
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    app = createApp();
    await Shipment.deleteMany({});
    await LibraryEntry.deleteMany({});
    await Payment.deleteMany({});
    await Order.deleteMany({});
    await Address.deleteMany({});
    await Cart.deleteMany({});
    await Book.deleteMany({});
    await Category.deleteMany({});
    await User.deleteMany({});

    const passHash = await bcrypt.hash('password123', 12);

    const admin = await User.create({
      name: 'Admin Boss',
      email: 'admin@example.com',
      passwordHash: passHash,
      role: 'administrador',
    });

    const userA = await User.create({
      name: 'Cliente A',
      email: 'clientea@example.com',
      passwordHash: passHash,
      role: 'cliente',
    });
    userAId = userA._id;

    const userB = await User.create({
      name: 'Cliente B',
      email: 'clienteb@example.com',
      passwordHash: passHash,
      role: 'cliente',
    });
    userBId = userB._id;

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email: 'admin@example.com', password: 'password123' });
    adminCookie = adminLogin.headers['set-cookie']
      .map((c) => c.split(';')[0])
      .join('; ');

    const loginA = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email: 'clientea@example.com', password: 'password123' });
    userACookie = loginA.headers['set-cookie']
      .map((c) => c.split(';')[0])
      .join('; ');

    const loginB = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email: 'clienteb@example.com', password: 'password123' });
    userBCookie = loginB.headers['set-cookie']
      .map((c) => c.split(';')[0])
      .join('; ');

    category = await Category.create({ name: 'Ficción', slug: 'ficcion' });

    physicalBook = await Book.create({
      title: 'Libro de Tapa Dura',
      author: 'Autor Físico',
      categoryId: category._id,
      price: 40.0,
      productType: 'PHYSICAL',
      stock: 10,
      isActive: true,
    });

    digitalBook = await Book.create({
      title: 'Libro E-Book',
      author: 'Autor Digital',
      categoryId: category._id,
      price: 20.0,
      productType: 'DIGITAL',
      fileKey: 'files/ebook.pdf',
      isActive: true,
    });
  });

  test('Cliente recibe 403 en POST /api/shipments', async () => {
    const res = await request(app)
      .post('/api/shipments')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({ orderId: new mongoose.Types.ObjectId().toString() });

    assert.equal(res.status, 403);
    assert.deepEqual(res.body, { error: 'Forbidden' });
  });

  test('Crear envío para pedido pagado con físicos: 201, status PREPARING, evento inicial', async () => {
    const order = await Order.create({
      userId: userAId,
      items: [
        {
          bookId: physicalBook._id,
          titleSnapshot: physicalBook.title,
          productType: 'PHYSICAL',
          unitPrice: 40.0,
          qty: 1,
          lineTotal: 40.0,
        },
      ],
      subtotal: 40.0,
      total: 40.0,
      currency: 'USD',
      shippingAddress: {
        recipient: 'Cliente A',
        line1: 'Calle 123',
        city: 'Bogota',
        region: 'Cundinamarca',
        postalCode: '110111',
        country: 'Colombia',
        phone: '1234567',
      },
      status: 'PAID',
      paymentStatus: 'CAPTURED',
    });

    const res = await request(app)
      .post('/api/shipments')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({ orderId: order._id.toString(), carrier: 'Servientrega' });

    assert.equal(res.status, 201);
    assert.equal(res.body.status, 'PREPARING');
    assert.equal(res.body.carrier, 'Servientrega');
    assert.ok(res.body.trackingNumber);
    assert.equal(res.body.events.length, 1);
    assert.equal(res.body.events[0].status, 'PREPARING');
  });

  test('Crear envío para pedido solo digital: 400', async () => {
    const digitalOrder = await Order.create({
      userId: userAId,
      items: [
        {
          bookId: digitalBook._id,
          titleSnapshot: digitalBook.title,
          productType: 'DIGITAL',
          unitPrice: 20.0,
          qty: 1,
          lineTotal: 20.0,
        },
      ],
      subtotal: 20.0,
      total: 20.0,
      currency: 'USD',
      status: 'PAID',
      paymentStatus: 'CAPTURED',
    });

    const res = await request(app)
      .post('/api/shipments')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({ orderId: digitalOrder._id.toString() });

    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { error: 'El pedido no tiene libros físicos' });
  });

  test('Crear envío para pedido no pagado (PENDING_PAYMENT): 409', async () => {
    const pendingOrder = await Order.create({
      userId: userAId,
      items: [
        {
          bookId: physicalBook._id,
          titleSnapshot: physicalBook.title,
          productType: 'PHYSICAL',
          unitPrice: 40.0,
          qty: 1,
          lineTotal: 40.0,
        },
      ],
      subtotal: 40.0,
      total: 40.0,
      currency: 'USD',
      status: 'PENDING_PAYMENT',
      paymentStatus: 'CREATED',
    });

    const res = await request(app)
      .post('/api/shipments')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({ orderId: pendingOrder._id.toString() });

    assert.equal(res.status, 409);
    assert.deepEqual(res.body, { error: 'El pedido no está pagado' });
  });

  test('Crear segundo envío para el mismo pedido: 409', async () => {
    const order = await Order.create({
      userId: userAId,
      items: [
        {
          bookId: physicalBook._id,
          titleSnapshot: physicalBook.title,
          productType: 'PHYSICAL',
          unitPrice: 40.0,
          qty: 1,
          lineTotal: 40.0,
        },
      ],
      subtotal: 40.0,
      total: 40.0,
      currency: 'USD',
      status: 'PAID',
      paymentStatus: 'CAPTURED',
    });

    // Primer envío
    await request(app)
      .post('/api/shipments')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({ orderId: order._id.toString() });

    // Segundo envío para el mismo pedido
    const res = await request(app)
      .post('/api/shipments')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({ orderId: order._id.toString() });

    assert.equal(res.status, 409);
    assert.deepEqual(res.body, { error: 'El pedido ya cuenta con un envío registrado' });
  });

  test('Transición válida PREPARING -> SHIPPED: 200 y se agrega evento', async () => {
    const order = await Order.create({
      userId: userAId,
      items: [
        {
          bookId: physicalBook._id,
          titleSnapshot: physicalBook.title,
          productType: 'PHYSICAL',
          unitPrice: 40.0,
          qty: 1,
          lineTotal: 40.0,
        },
      ],
      subtotal: 40.0,
      total: 40.0,
      currency: 'USD',
      status: 'PAID',
      paymentStatus: 'CAPTURED',
    });

    const createRes = await request(app)
      .post('/api/shipments')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({ orderId: order._id.toString() });

    const shipmentId = createRes.body._id;

    const updateRes = await request(app)
      .patch(`/api/shipments/${shipmentId}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({ status: 'SHIPPED', note: 'Paquete entregado a transportadora' });

    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.status, 'SHIPPED');
    assert.equal(updateRes.body.events.length, 2);
    assert.equal(updateRes.body.events[1].status, 'SHIPPED');
    assert.equal(updateRes.body.events[1].note, 'Paquete entregado a transportadora');
  });

  test('Salto inválido PREPARING -> DELIVERED: 400 y el estado no cambia', async () => {
    const order = await Order.create({
      userId: userAId,
      items: [
        {
          bookId: physicalBook._id,
          titleSnapshot: physicalBook.title,
          productType: 'PHYSICAL',
          unitPrice: 40.0,
          qty: 1,
          lineTotal: 40.0,
        },
      ],
      subtotal: 40.0,
      total: 40.0,
      currency: 'USD',
      status: 'PAID',
      paymentStatus: 'CAPTURED',
    });

    const createRes = await request(app)
      .post('/api/shipments')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({ orderId: order._id.toString() });

    const shipmentId = createRes.body._id;

    const res = await request(app)
      .patch(`/api/shipments/${shipmentId}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({ status: 'DELIVERED' });

    assert.equal(res.status, 400);

    const shipmentInDb = await Shipment.findById(shipmentId);
    assert.equal(shipmentInDb.status, 'PREPARING');
  });

  test('Retroceso inválido DELIVERED -> SHIPPED: 400', async () => {
    const order = await Order.create({
      userId: userAId,
      items: [
        {
          bookId: physicalBook._id,
          titleSnapshot: physicalBook.title,
          productType: 'PHYSICAL',
          unitPrice: 40.0,
          qty: 1,
          lineTotal: 40.0,
        },
      ],
      subtotal: 40.0,
      total: 40.0,
      currency: 'USD',
      status: 'PAID',
      paymentStatus: 'CAPTURED',
    });

    const createRes = await request(app)
      .post('/api/shipments')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({ orderId: order._id.toString() });

    const shipmentId = createRes.body._id;

    // PREPARING -> SHIPPED -> IN_TRANSIT -> DELIVERED
    await request(app)
      .patch(`/api/shipments/${shipmentId}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({ status: 'SHIPPED' });

    await request(app)
      .patch(`/api/shipments/${shipmentId}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({ status: 'IN_TRANSIT' });

    await request(app)
      .patch(`/api/shipments/${shipmentId}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({ status: 'DELIVERED' });

    // Intento de retroceder a SHIPPED
    const res = await request(app)
      .patch(`/api/shipments/${shipmentId}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({ status: 'SHIPPED' });

    assert.equal(res.status, 400);

    const shipmentInDb = await Shipment.findById(shipmentId);
    assert.equal(shipmentInDb.status, 'DELIVERED');
  });

  test('trackingNumber repetido en otro envío: 409', async () => {
    const order1 = await Order.create({
      userId: userAId,
      items: [
        {
          bookId: physicalBook._id,
          titleSnapshot: physicalBook.title,
          productType: 'PHYSICAL',
          unitPrice: 40.0,
          qty: 1,
          lineTotal: 40.0,
        },
      ],
      subtotal: 40.0,
      total: 40.0,
      currency: 'USD',
      status: 'PAID',
      paymentStatus: 'CAPTURED',
    });

    const order2 = await Order.create({
      userId: userBId,
      items: [
        {
          bookId: physicalBook._id,
          titleSnapshot: physicalBook.title,
          productType: 'PHYSICAL',
          unitPrice: 40.0,
          qty: 1,
          lineTotal: 40.0,
        },
      ],
      subtotal: 40.0,
      total: 40.0,
      currency: 'USD',
      status: 'PAID',
      paymentStatus: 'CAPTURED',
    });

    await request(app)
      .post('/api/shipments')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({ orderId: order1._id.toString(), trackingNumber: 'GUIA-DUPLICADA-123' });

    const res = await request(app)
      .post('/api/shipments')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({ orderId: order2._id.toString(), trackingNumber: 'GUIA-DUPLICADA-123' });

    assert.equal(res.status, 409);
  });

  test('Cuando el envío llega a DELIVERED y el pedido es mixto con digitales concedidos, el pedido queda COMPLETED', async () => {
    const mixedOrder = await Order.create({
      userId: userAId,
      items: [
        {
          bookId: physicalBook._id,
          titleSnapshot: physicalBook.title,
          productType: 'PHYSICAL',
          unitPrice: 40.0,
          qty: 1,
          lineTotal: 40.0,
        },
        {
          bookId: digitalBook._id,
          titleSnapshot: digitalBook.title,
          productType: 'DIGITAL',
          unitPrice: 20.0,
          qty: 1,
          lineTotal: 20.0,
        },
      ],
      subtotal: 60.0,
      total: 60.0,
      currency: 'USD',
      status: 'PAID',
      paymentStatus: 'CAPTURED',
    });

    // Simular que el ítem digital ya fue concedido en LibraryEntry
    await LibraryEntry.create({
      userId: userAId,
      bookId: digitalBook._id,
      orderId: mixedOrder._id,
    });

    const createRes = await request(app)
      .post('/api/shipments')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({ orderId: mixedOrder._id.toString() });

    const shipmentId = createRes.body._id;

    await request(app)
      .patch(`/api/shipments/${shipmentId}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({ status: 'SHIPPED' });

    await request(app)
      .patch(`/api/shipments/${shipmentId}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({ status: 'IN_TRANSIT' });

    await request(app)
      .patch(`/api/shipments/${shipmentId}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({ status: 'DELIVERED' });

    const completedOrder = await Order.findById(mixedOrder._id);
    assert.equal(completedOrder.status, 'COMPLETED');
  });

  test('El cliente dueño del pedido ve el envío en GET /api/orders/:id; otro cliente recibe 404', async () => {
    const order = await Order.create({
      userId: userAId,
      items: [
        {
          bookId: physicalBook._id,
          titleSnapshot: physicalBook.title,
          productType: 'PHYSICAL',
          unitPrice: 40.0,
          qty: 1,
          lineTotal: 40.0,
        },
      ],
      subtotal: 40.0,
      total: 40.0,
      currency: 'USD',
      status: 'PAID',
      paymentStatus: 'CAPTURED',
    });

    await request(app)
      .post('/api/shipments')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({
        orderId: order._id.toString(),
        carrier: 'Envia',
        trackingNumber: 'ENV-123456789',
      });

    // Cliente A (dueño) consulta el pedido
    const resA = await request(app)
      .get(`/api/orders/${order._id}`)
      .set('Cookie', userACookie);

    assert.equal(resA.status, 200);
    assert.ok(resA.body.shipment);
    assert.equal(resA.body.shipment.carrier, 'Envia');
    assert.equal(resA.body.shipment.trackingNumber, 'ENV-123456789');
    assert.equal(resA.body.shipment.status, 'PREPARING');
    assert.ok(Array.isArray(resA.body.shipment.events));

    // Cliente B consulta el pedido ajeno -> 404
    const resB = await request(app)
      .get(`/api/orders/${order._id}`)
      .set('Cookie', userBCookie);

    assert.equal(resB.status, 404);
    assert.deepEqual(resB.body, { error: 'Pedido no encontrado' });
  });

  test('GET /api/orders/:id no expone datos de otros usuarios', async () => {
    const order = await Order.create({
      userId: userBId,
      items: [
        {
          bookId: physicalBook._id,
          titleSnapshot: physicalBook.title,
          productType: 'PHYSICAL',
          unitPrice: 40.0,
          qty: 1,
          lineTotal: 40.0,
        },
      ],
      subtotal: 40.0,
      total: 40.0,
      currency: 'USD',
      status: 'PAID',
      paymentStatus: 'CAPTURED',
    });

    // Cliente A solicita el pedido de Cliente B
    const res = await request(app)
      .get(`/api/orders/${order._id}`)
      .set('Cookie', userACookie);

    assert.equal(res.status, 404);
    assert.equal(res.body.shipment, undefined);
  });
});
