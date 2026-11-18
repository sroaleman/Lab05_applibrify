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

describe('Bloque 3B - Pedidos desde Carrito', () => {
  let app;
  let userACookie;
  let userBCookie;
  let userAId;
  let userBId;
  let digitalBook;
  let physicalBook;
  let userAAddress;
  let userBAddress;

  before(async () => {
    await mongoose.connect(testUri);
  });

  after(async () => {
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    app = createApp();
    await Order.deleteMany({});
    await Address.deleteMany({});
    await Cart.deleteMany({});
    await Book.deleteMany({});
    await Category.deleteMany({});
    await User.deleteMany({});

    const passHash = await bcrypt.hash('password123', 12);

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

    // Login clientes
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

    const category = await Category.create({ name: 'Ficción', slug: 'ficcion' });

    digitalBook = await Book.create({
      title: 'Libro Digital Uno',
      author: 'Autor A',
      categoryId: category._id,
      price: 15.0,
      productType: 'DIGITAL',
      fileKey: 'files/digital-one.pdf',
      isActive: true,
    });

    physicalBook = await Book.create({
      title: 'Libro Físico Uno',
      author: 'Autor B',
      categoryId: category._id,
      price: 20.0,
      productType: 'PHYSICAL',
      stock: 5,
      isActive: true,
    });

    userAAddress = await Address.create({
      userId: userAId,
      recipient: 'Cliente A Recipient',
      line1: 'Calle 100 # 15-20',
      city: 'Bogota',
      region: 'Cundinamarca',
      postalCode: '110111',
      country: 'Colombia',
      phone: '+573001112233',
      isDefault: true,
    });

    userBAddress = await Address.create({
      userId: userBId,
      recipient: 'Cliente B Recipient',
      line1: 'Carrera 7 # 45-10',
      city: 'Medellin',
      region: 'Antioquia',
      postalCode: '050001',
      country: 'Colombia',
      phone: '+573004445566',
      isDefault: true,
    });
  });

  test('Carrito vacío: POST /api/orders responde 400', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({});

    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { error: 'El carrito está vacío' });
  });

  test('Carrito solo DIGITAL: crea pedido PENDING_PAYMENT sin shippingAddress, aunque se envíe addressId', async () => {
    // Agregar digitalBook al carrito
    await request(app)
      .put(`/api/cart/items/${digitalBook._id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({ qty: 2 });

    const res = await request(app)
      .post('/api/orders')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({ addressId: userAAddress._id.toString() });

    assert.equal(res.status, 201);
    assert.equal(res.body.status, 'PENDING_PAYMENT');
    assert.equal(res.body.paymentStatus, 'CREATED');
    assert.equal(res.body.shippingAddress, null);
    assert.equal(res.body.items.length, 1);
    assert.equal(res.body.items[0].productType, 'DIGITAL');
    assert.equal(res.body.items[0].qty, 2);
    assert.equal(res.body.items[0].unitPrice, 15.0);
    assert.equal(res.body.items[0].lineTotal, 30.0);
    assert.equal(res.body.total, 30.0);
    assert.equal(res.body.items[0].fileKey, undefined);
  });

  test('Carrito con PHYSICAL sin addressId: 400 "Solicitud inválida" o "Dirección requerida"', async () => {
    // Agregar físico al carrito
    await request(app)
      .put(`/api/cart/items/${physicalBook._id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({ qty: 1 });

    const res = await request(app)
      .post('/api/orders')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({});

    assert.equal(res.status, 400);
    assert.ok(
      res.body.error === 'Dirección requerida' || res.body.error === 'Solicitud inválida'
    );
  });

  test('Carrito con PHYSICAL y addressId ajena: 404', async () => {
    await request(app)
      .put(`/api/cart/items/${physicalBook._id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({ qty: 1 });

    const res = await request(app)
      .post('/api/orders')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({ addressId: userBAddress._id.toString() });

    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: 'Dirección no encontrada' });
  });

  test('Carrito con PHYSICAL y addressId propia: crea pedido con shippingAddress como snapshot', async () => {
    await request(app)
      .put(`/api/cart/items/${physicalBook._id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({ qty: 1 });

    const res = await request(app)
      .post('/api/orders')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({ addressId: userAAddress._id.toString() });

    assert.equal(res.status, 201);
    assert.ok(res.body.shippingAddress);
    assert.equal(res.body.shippingAddress.recipient, userAAddress.recipient);
    assert.equal(res.body.shippingAddress.line1, userAAddress.line1);
    assert.equal(res.body.shippingAddress.postalCode, userAAddress.postalCode);
  });

  test('Stock insuficiente al crear el pedido: 409, no crea pedido', async () => {
    // 1. Agregar physicalBook (stock actual = 5) con qty = 3
    await request(app)
      .put(`/api/cart/items/${physicalBook._id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({ qty: 3 });

    // 2. Modificamos el stock del libro en la BD para que quede menor a 3 (ej. stock = 2)
    await Book.findByIdAndUpdate(physicalBook._id, { stock: 2 });

    const res = await request(app)
      .post('/api/orders')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({ addressId: userAAddress._id.toString() });

    assert.equal(res.status, 409);
    assert.deepEqual(res.body, { error: 'Stock insuficiente' });

    const orderCount = await Order.countDocuments({});
    assert.equal(orderCount, 0);
  });

  test('El total se calcula con precios de la base aunque el body incluya price', async () => {
    await request(app)
      .put(`/api/cart/items/${digitalBook._id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({ qty: 2 });

    const res = await request(app)
      .post('/api/orders')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({
        addressId: userAAddress._id.toString(),
        price: 1.0,
        subtotal: 1.0,
        total: 1.0,
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.items[0].unitPrice, 15.0);
    assert.equal(res.body.items[0].lineTotal, 30.0);
    assert.equal(res.body.total, 30.0);
  });

  test('No descuenta stock al crear el pedido (stock igual antes y después)', async () => {
    await request(app)
      .put(`/api/cart/items/${physicalBook._id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({ qty: 2 });

    const beforeBook = await Book.findById(physicalBook._id);
    assert.equal(beforeBook.stock, 5);

    const res = await request(app)
      .post('/api/orders')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({ addressId: userAAddress._id.toString() });

    assert.equal(res.status, 201);

    const afterBook = await Book.findById(physicalBook._id);
    assert.equal(afterBook.stock, 5);
  });

  test('No vacía el carrito al crear el pedido', async () => {
    await request(app)
      .put(`/api/cart/items/${digitalBook._id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({ qty: 1 });

    const res = await request(app)
      .post('/api/orders')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({});

    assert.equal(res.status, 201);

    const cartRes = await request(app)
      .get('/api/cart')
      .set('Cookie', userACookie);

    assert.equal(cartRes.status, 200);
    assert.equal(cartRes.body.items.length, 1);
  });

  test('GET /api/orders/:id de otro cliente: 404', async () => {
    await request(app)
      .put(`/api/cart/items/${digitalBook._id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({ qty: 1 });

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({});

    const orderId = orderRes.body._id;

    // Cliente B intenta consultar la orden de Cliente A
    const resB = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Cookie', userBCookie);

    assert.equal(resB.status, 404);
    assert.deepEqual(resB.body, { error: 'Pedido no encontrado' });
  });

  test('GET /api/orders/me devuelve solo los pedidos del usuario', async () => {
    // Cliente A crea un pedido
    await request(app)
      .put(`/api/cart/items/${digitalBook._id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({ qty: 1 });

    await request(app)
      .post('/api/orders')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({});

    // Cliente B consulta /api/orders/me
    const resB = await request(app)
      .get('/api/orders/me')
      .set('Cookie', userBCookie);

    assert.equal(resB.status, 200);
    assert.equal(resB.body.length, 0);

    // Cliente A consulta /api/orders/me
    const resA = await request(app)
      .get('/api/orders/me')
      .set('Cookie', userACookie);

    assert.equal(resA.status, 200);
    assert.equal(resA.body.length, 1);
    assert.equal(resA.body[0].items[0].titleSnapshot, 'Libro Digital Uno');
  });

  test('Administrador lista pedidos de todos los clientes', async () => {
    // 1. Crear usuario administrador y loguearlo
    const passHash = await bcrypt.hash('password123', 12);
    await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      passwordHash: passHash,
      role: 'administrador',
    });

    const loginAdmin = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email: 'admin@example.com', password: 'password123' });
    const adminCookie = loginAdmin.headers['set-cookie']
      .map((c) => c.split(';')[0])
      .join('; ');

    // 2. Cliente A crea un pedido (DIGITAL)
    await request(app)
      .put(`/api/cart/items/${digitalBook._id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({ qty: 1 });

    const orderResA = await request(app)
      .post('/api/orders')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({});
    assert.equal(orderResA.status, 201);

    // 3. Cliente B crea un pedido (PHYSICAL)
    await request(app)
      .put(`/api/cart/items/${physicalBook._id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userBCookie)
      .send({ qty: 2 });

    const orderResB = await request(app)
      .post('/api/orders')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userBCookie)
      .send({ addressId: userBAddress._id.toString() });
    assert.equal(orderResB.status, 201);

    // 4. Cliente regular intenta listar pedidos: recibe 403 Forbidden
    const forbiddenRes = await request(app)
      .get('/api/orders')
      .set('Cookie', userACookie);
    assert.equal(forbiddenRes.status, 403);

    // 5. Administrador lista pedidos: recibe 200 con pedidos de dos clientes distintos
    const adminRes = await request(app)
      .get('/api/orders')
      .set('Cookie', adminCookie);
    assert.equal(adminRes.status, 200);

    const orders = adminRes.body.orders || adminRes.body;
    assert.equal(orders.length, 2);

    // Verificar que los pedidos pertenecen a dos clientes distintos
    const userIds = orders.map((o) => o.userId.toString());
    assert.ok(userIds.includes(userAId.toString()));
    assert.ok(userIds.includes(userBId.toString()));

    // Verificar estructura de cada pedido
    for (const order of orders) {
      assert.ok(order._id);
      assert.ok(order.userId);
      assert.ok(order.status);
      assert.ok(order.paymentStatus);
      assert.ok(order.total !== undefined);
      assert.ok(order.currency);
      assert.ok(order.createdAt);
      assert.ok(order.deliveryType);
      // No debe incluir información confidencial como fileKey ni passwordHash
      assert.equal(order.passwordHash, undefined);
      assert.equal(order.fileKey, undefined);
    }
  });
});
