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
const StockMovement = require('../src/models/StockMovement');
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

describe('Bloque 2B - Control de Stock y Movimientos', () => {
  let app;
  let adminCookie;
  let clientCookie;
  let defaultCategory;
  let sampleBook;

  before(async () => {
    await mongoose.connect(testUri);
  });

  after(async () => {
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    app = createApp();
    await StockMovement.deleteMany({});
    await Book.deleteMany({});
    await Category.deleteMany({});
    await User.deleteMany({});

    // Crear cliente
    const clientPassHash = await bcrypt.hash('cliente123', 12);
    await User.create({
      name: 'Cliente Stock',
      email: 'clientestock@example.com',
      passwordHash: clientPassHash,
      role: 'cliente',
    });

    // Crear administrador
    const adminPassHash = await bcrypt.hash('admin1234', 12);
    await User.create({
      name: 'Admin Stock',
      email: 'adminstock@example.com',
      passwordHash: adminPassHash,
      role: 'administrador',
    });

    // Logins
    const clientLogin = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email: 'clientestock@example.com', password: 'cliente123' });
    clientCookie = clientLogin.headers['set-cookie']
      .map((c) => c.split(';')[0])
      .join('; ');

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email: 'adminstock@example.com', password: 'admin1234' });
    adminCookie = adminLogin.headers['set-cookie']
      .map((c) => c.split(';')[0])
      .join('; ');

    // Categoría y libro base con stock inicial = 10
    defaultCategory = await Category.create({
      name: 'Novelas',
      slug: 'novelas',
    });

    sampleBook = await Book.create({
      title: 'Cien años de soledad',
      author: 'Gabriel García Márquez',
      categoryId: defaultCategory._id,
      price: 25.0,
      productType: 'PHYSICAL',
      stock: 10,
    });
  });

  test('Cliente recibe 403 al ajustar stock', async () => {
    const res = await request(app)
      .patch(`/api/books/${sampleBook._id}/stock`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', clientCookie)
      .send({ delta: 5, reason: 'Intento no autorizado' });

    assert.equal(res.status, 403);
    assert.deepEqual(res.body, { error: 'Forbidden' });
  });

  test('Admin suma +5: 200 y el stock sube', async () => {
    const res = await request(app)
      .patch(`/api/books/${sampleBook._id}/stock`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({ delta: 5, reason: 'Llegada de lote de proveedor' });

    assert.equal(res.status, 200);
    assert.equal(res.body.stock, 15);
    assert.equal(res.body.fileKey, undefined);

    const bookInDb = await Book.findById(sampleBook._id);
    assert.equal(bookInDb.stock, 15);
  });

  test('Admin resta -2 con stock suficiente: 200', async () => {
    const res = await request(app)
      .patch(`/api/books/${sampleBook._id}/stock`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({ delta: -2, reason: 'Libros dañados en bodega' });

    assert.equal(res.status, 200);
    assert.equal(res.body.stock, 8);
    assert.equal(res.body.fileKey, undefined);

    const bookInDb = await Book.findById(sampleBook._id);
    assert.equal(bookInDb.stock, 8);
  });

  test('Resta mayor al stock: 409 y el stock no cambia', async () => {
    const res = await request(app)
      .patch(`/api/books/${sampleBook._id}/stock`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({ delta: -20, reason: 'Resta excesiva' });

    assert.equal(res.status, 409);
    assert.deepEqual(res.body, { error: 'Stock insuficiente' });

    const bookInDb = await Book.findById(sampleBook._id);
    assert.equal(bookInDb.stock, 10);
  });

  test('Cada ajuste exitoso crea un StockMovement con delta y reason correctos', async () => {
    await request(app)
      .patch(`/api/books/${sampleBook._id}/stock`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({ delta: 3, reason: 'Recepción de mercadería' });

    const movements = await StockMovement.find({ bookId: sampleBook._id });
    assert.equal(movements.length, 1);
    assert.equal(movements[0].delta, 3);
    assert.equal(movements[0].reason, 'Recepción de mercadería');
    assert.equal(movements[0].type, 'ADJUSTMENT');
    assert.ok(movements[0].adminId);
  });

  test('delta 0: 400', async () => {
    const res = await request(app)
      .patch(`/api/books/${sampleBook._id}/stock`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({ delta: 0, reason: 'Delta no permitido' });

    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { error: 'Solicitud inválida' });
  });

  test('GET movements ordenado del más reciente al más antiguo', async () => {
    // Primer ajuste
    await request(app)
      .patch(`/api/books/${sampleBook._id}/stock`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({ delta: 2, reason: 'Primer movimiento' });

    // Segundo ajuste
    await request(app)
      .patch(`/api/books/${sampleBook._id}/stock`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({ delta: -1, reason: 'Segundo movimiento' });

    const res = await request(app)
      .get(`/api/books/${sampleBook._id}/movements`)
      .set('Cookie', adminCookie);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.equal(res.body.length, 2);

    // El primero en la lista devuelta debe ser el más reciente
    assert.equal(res.body[0].reason, 'Segundo movimiento');
    assert.equal(res.body[0].delta, -1);
    assert.equal(res.body[1].reason, 'Primer movimiento');
    assert.equal(res.body[1].delta, 2);
    assert.ok(new Date(res.body[0].createdAt) >= new Date(res.body[1].createdAt));
  });

  test('Dos restas simultáneas que juntas superan el stock: solo una tiene éxito (Promise.all)', async () => {
    // Stock inicial de sampleBook = 10
    // Lanzamos dos peticiones concurrentes de -7 cada una (total -14 > 10)
    const [res1, res2] = await Promise.all([
      request(app)
        .patch(`/api/books/${sampleBook._id}/stock`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', adminCookie)
        .send({ delta: -7, reason: 'Operación concurrente 1' }),
      request(app)
        .patch(`/api/books/${sampleBook._id}/stock`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', adminCookie)
        .send({ delta: -7, reason: 'Operación concurrente 2' }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    assert.deepEqual(statuses, [200, 409]);

    // Comprobar que el stock final quedó en 3 y solo se creó 1 movimiento
    const bookInDb = await Book.findById(sampleBook._id);
    assert.equal(bookInDb.stock, 3);

    const movements = await StockMovement.find({ bookId: sampleBook._id });
    assert.equal(movements.length, 1);
  });
});

