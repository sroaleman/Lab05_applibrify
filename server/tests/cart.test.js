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

describe('Bloque 3A - Carrito y Direcciones', () => {
  let app;
  let userACookie;
  let userBCookie;
  let userAId;
  let userBId;
  let digitalBook;
  let physicalBook;
  let inactiveBook;

  before(async () => {
    await mongoose.connect(testUri);
  });

  after(async () => {
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    app = createApp();
    await Address.deleteMany({});
    await Cart.deleteMany({});
    await Book.deleteMany({});
    await Category.deleteMany({});
    await User.deleteMany({});

    // Crear dos clientes
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

    // Iniciar sesión con ambos clientes
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

    // Categoría y Libros
    const category = await Category.create({ name: 'General', slug: 'general' });

    digitalBook = await Book.create({
      title: 'Libro Digital Pro',
      author: 'Autor Digital',
      categoryId: category._id,
      price: 15.5,
      productType: 'DIGITAL',
      fileKey: 'files/pro.pdf',
      isActive: true,
    });

    physicalBook = await Book.create({
      title: 'Libro Físico Guía',
      author: 'Autor Físico',
      categoryId: category._id,
      price: 25.0,
      productType: 'PHYSICAL',
      stock: 4,
      isActive: true,
    });

    inactiveBook = await Book.create({
      title: 'Libro Inactivo',
      author: 'Autor Inactivo',
      categoryId: category._id,
      price: 10.0,
      productType: 'PHYSICAL',
      stock: 10,
      isActive: false,
    });
  });

  test('Sin sesión: GET /api/cart responde 401', async () => {
    const res = await request(app).get('/api/cart');
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: 'Unauthorized' });
  });

  test('Agregar libro DIGITAL y PHYSICAL al mismo carrito: ambos aparecen', async () => {
    // Agregar digital
    await request(app)
      .put(`/api/cart/items/${digitalBook._id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({ qty: 1 });

    // Agregar físico
    const res = await request(app)
      .put(`/api/cart/items/${physicalBook._id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({ qty: 2 });

    assert.equal(res.status, 200);
    assert.equal(res.body.items.length, 2);

    const items = res.body.items;
    const dig = items.find((i) => String(i.bookId) === String(digitalBook._id));
    const phys = items.find((i) => String(i.bookId) === String(physicalBook._id));

    assert.ok(dig);
    assert.equal(dig.productType, 'DIGITAL');
    assert.equal(dig.qty, 1);
    assert.equal(dig.fileKey, undefined);

    assert.ok(phys);
    assert.equal(phys.productType, 'PHYSICAL');
    assert.equal(phys.qty, 2);
    assert.equal(phys.fileKey, undefined);
  });

  test('Cantidad mayor al stock: 409 y el carrito no cambia', async () => {
    // physicalBook tiene stock 4, intentamos agregar 5
    const res = await request(app)
      .put(`/api/cart/items/${physicalBook._id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({ qty: 5 });

    assert.equal(res.status, 409);
    assert.deepEqual(res.body, { error: 'Stock insuficiente' });

    // Verificar que el carrito sigue vacío
    const cartRes = await request(app)
      .get('/api/cart')
      .set('Cookie', userACookie);

    assert.equal(cartRes.status, 200);
    assert.equal(cartRes.body.items.length, 0);
  });

  test('qty 0 quita el libro', async () => {
    // Primero agregar con qty 2
    await request(app)
      .put(`/api/cart/items/${physicalBook._id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({ qty: 2 });

    // Modificar a qty 0
    const res = await request(app)
      .put(`/api/cart/items/${physicalBook._id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({ qty: 0 });

    assert.equal(res.status, 200);
    assert.equal(res.body.items.length, 0);
    assert.equal(res.body.total, 0);
  });

  test('Cliente A no ve ni modifica el carrito de cliente B (cada usuario ve solo el suyo)', async () => {
    // Cliente A agrega 1 digitalBook
    await request(app)
      .put(`/api/cart/items/${digitalBook._id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({ qty: 1 });

    // Cliente B consulta su carrito
    const resB = await request(app)
      .get('/api/cart')
      .set('Cookie', userBCookie);

    assert.equal(resB.status, 200);
    assert.equal(resB.body.items.length, 0);

    // Cliente A consulta su carrito
    const resA = await request(app)
      .get('/api/cart')
      .set('Cookie', userACookie);

    assert.equal(resA.status, 200);
    assert.equal(resA.body.items.length, 1);
  });

  test('Total calculado en servidor: aunque se envíe un precio en el body, se ignora', async () => {
    // digitalBook.price = 15.5
    // Enviamos precio falso en el body
    const res = await request(app)
      .put(`/api/cart/items/${digitalBook._id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({ qty: 2, price: 1.0, subtotal: 2.0, total: 2.0 });

    assert.equal(res.status, 200);
    assert.equal(res.body.items[0].price, 15.5);
    assert.equal(res.body.items[0].subtotal, 31.0);
    assert.equal(res.body.total, 31.0);
  });

  test('Libro inactivo no se puede agregar (404)', async () => {
    const res = await request(app)
      .put(`/api/cart/items/${inactiveBook._id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({ qty: 1 });

    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: 'Libro no encontrado' });
  });

  test('Dirección: un cliente no puede editar ni borrar la dirección de otro (404)', async () => {
    // Cliente A crea una dirección
    const createRes = await request(app)
      .post('/api/addresses')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({
        recipient: 'Juan A',
        line1: 'Calle Falsa 123',
        city: 'Bogota',
        region: 'Cundinamarca',
        postalCode: '110111',
        country: 'Colombia',
        phone: '+573001234567',
      });

    assert.equal(createRes.status, 201);
    const addressId = createRes.body._id;

    // Cliente B intenta editar la dirección de Cliente A -> responde 404
    const patchRes = await request(app)
      .patch(`/api/addresses/${addressId}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userBCookie)
      .send({ recipient: 'Hacker' });

    assert.equal(patchRes.status, 404);
    assert.deepEqual(patchRes.body, { error: 'Dirección no encontrada' });

    // Cliente B intenta borrar la dirección de Cliente A -> responde 404
    const deleteRes = await request(app)
      .delete(`/api/addresses/${addressId}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userBCookie);

    assert.equal(deleteRes.status, 404);
    assert.deepEqual(deleteRes.body, { error: 'Dirección no encontrada' });

    // La dirección sigue intacta para Cliente A
    const getRes = await request(app)
      .get('/api/addresses')
      .set('Cookie', userACookie);

    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.length, 1);
    assert.equal(getRes.body[0].recipient, 'Juan A');
  });

  test('Marcar una dirección como principal desmarca la anterior', async () => {
    // Primera dirección de Cliente A (automáticamente principal o con isDefault: true)
    const addr1Res = await request(app)
      .post('/api/addresses')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({
        recipient: 'Principal Uno',
        line1: 'Av 1',
        city: 'Medellin',
        region: 'Antioquia',
        postalCode: '050001',
        country: 'Colombia',
        phone: '123456789',
        isDefault: true,
      });

    assert.equal(addr1Res.status, 201);
    assert.equal(addr1Res.body.isDefault, true);

    // Segunda dirección creada como principal
    const addr2Res = await request(app)
      .post('/api/addresses')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({
        recipient: 'Principal Dos',
        line1: 'Av 2',
        city: 'Medellin',
        region: 'Antioquia',
        postalCode: '050002',
        country: 'Colombia',
        phone: '987654321',
        isDefault: true,
      });

    assert.equal(addr2Res.status, 201);
    assert.equal(addr2Res.body.isDefault, true);

    // Comprobar que la primera dirección quedó con isDefault: false
    const listRes = await request(app)
      .get('/api/addresses')
      .set('Cookie', userACookie);

    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.length, 2);

    const first = listRes.body.find((a) => a._id === addr1Res.body._id);
    const second = listRes.body.find((a) => a._id === addr2Res.body._id);

    assert.equal(first.isDefault, false);
    assert.equal(second.isDefault, true);
  });
});
