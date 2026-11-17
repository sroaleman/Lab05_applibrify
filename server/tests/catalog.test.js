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

describe('Bloque 2A - Catálogo de Libros y Categorías', () => {
  let app;
  let adminCookie;
  let clientCookie;
  let defaultCategory;

  before(async () => {
    await mongoose.connect(testUri);
  });

  after(async () => {
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    app = createApp();
    await Book.deleteMany({});
    await Category.deleteMany({});
    await User.deleteMany({});

    // Crear cliente
    const clientPassHash = await bcrypt.hash('cliente123', 12);
    await User.create({
      name: 'Cliente Cat',
      email: 'clientecat@example.com',
      passwordHash: clientPassHash,
      role: 'cliente',
    });

    // Crear administrador
    const adminPassHash = await bcrypt.hash('admin1234', 12);
    await User.create({
      name: 'Admin Cat',
      email: 'admincat@example.com',
      passwordHash: adminPassHash,
      role: 'administrador',
    });

    // Logins
    const clientLogin = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email: 'clientecat@example.com', password: 'cliente123' });
    clientCookie = clientLogin.headers['set-cookie']
      .map((c) => c.split(';')[0])
      .join('; ');

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email: 'admincat@example.com', password: 'admin1234' });
    adminCookie = adminLogin.headers['set-cookie']
      .map((c) => c.split(';')[0])
      .join('; ');

    // Categoría de prueba inicial
    defaultCategory = await Category.create({
      name: 'Ficción',
      slug: 'ficcion',
    });
  });

  test('Cliente no puede crear categoría ni libro (403)', async () => {
    // Intentar crear categoría como cliente
    const catRes = await request(app)
      .post('/api/categories')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', clientCookie)
      .send({ name: 'Terror', slug: 'terror' });

    assert.equal(catRes.status, 403);
    assert.deepEqual(catRes.body, { error: 'Forbidden' });

    // Intentar crear libro como cliente
    const bookRes = await request(app)
      .post('/api/books')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', clientCookie)
      .send({
        title: 'El Resplandor',
        author: 'Stephen King',
        categoryId: defaultCategory._id.toString(),
        price: 19.99,
        productType: 'PHYSICAL',
        stock: 5,
      });

    assert.equal(bookRes.status, 403);
    assert.deepEqual(bookRes.body, { error: 'Forbidden' });
  });

  test('Administrador crea categoría y libro DIGITAL con fileKey; la respuesta no incluye fileKey', async () => {
    // 1. Administrador crea categoría
    const catRes = await request(app)
      .post('/api/categories')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({ name: 'Tecnología', slug: 'tecnologia' });

    assert.equal(catRes.status, 201);
    assert.equal(catRes.body.name, 'Tecnología');
    assert.equal(catRes.body.slug, 'tecnologia');

    // 2. Administrador crea libro DIGITAL
    const bookRes = await request(app)
      .post('/api/books')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({
        title: 'Clean Code',
        author: 'Robert C. Martin',
        categoryId: catRes.body._id,
        price: 29.99,
        productType: 'DIGITAL',
        fileKey: 'files/clean-code.pdf',
      });

    assert.equal(bookRes.status, 201);
    assert.equal(bookRes.body.title, 'Clean Code');
    assert.equal(bookRes.body.productType, 'DIGITAL');
    assert.equal(bookRes.body.fileKey, undefined);

    // Verificar en BD que el fileKey sí existe almacenado internamente
    const dbBook = await Book.findById(bookRes.body._id);
    assert.equal(dbBook.fileKey, 'files/clean-code.pdf');
  });

  test('Libro DIGITAL sin fileKey responde 400', async () => {
    const res = await request(app)
      .post('/api/books')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({
        title: 'Libro Digital Sin Archivo',
        author: 'Autor Anónimo',
        categoryId: defaultCategory._id.toString(),
        price: 9.99,
        productType: 'DIGITAL',
      });

    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { error: 'Solicitud inválida' });
  });

  test('Libro PHYSICAL con fileKey: el fileKey no se guarda', async () => {
    const res = await request(app)
      .post('/api/books')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie)
      .send({
        title: 'Libro Físico',
        author: 'Autor Físico',
        categoryId: defaultCategory._id.toString(),
        price: 15.0,
        productType: 'PHYSICAL',
        fileKey: 'should-not-be-saved.pdf',
        stock: 10,
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.productType, 'PHYSICAL');
    assert.equal(res.body.fileKey, undefined);

    const dbBook = await Book.findById(res.body._id);
    assert.equal(dbBook.fileKey, undefined);
  });

  test('Catálogo filtra por productType y por categoría, y no muestra libros inactivos', async () => {
    const anotherCat = await Category.create({ name: 'Historia', slug: 'historia' });

    // 1. Libro Digital en Ficción (Activo)
    await Book.create({
      title: 'Ficción Digital',
      author: 'Autor A',
      categoryId: defaultCategory._id,
      price: 10,
      productType: 'DIGITAL',
      fileKey: 'digital-f.epub',
      isActive: true,
    });

    // 2. Libro Físico en Ficción (Activo)
    await Book.create({
      title: 'Ficción Físico',
      author: 'Autor B',
      categoryId: defaultCategory._id,
      price: 20,
      productType: 'PHYSICAL',
      isActive: true,
      stock: 5,
    });

    // 3. Libro Físico en Historia (Activo)
    await Book.create({
      title: 'Historia Mundial',
      author: 'Autor C',
      categoryId: anotherCat._id,
      price: 30,
      productType: 'PHYSICAL',
      isActive: true,
      stock: 3,
    });

    // 4. Libro Inactivo en Ficción
    await Book.create({
      title: 'Ficción Inactiva',
      author: 'Autor D',
      categoryId: defaultCategory._id,
      price: 15,
      productType: 'PHYSICAL',
      isActive: false,
    });

    // Consulta general (solo activos)
    const allRes = await request(app).get('/api/books');
    assert.equal(allRes.status, 200);
    assert.equal(allRes.body.total, 3);
    assert.ok(allRes.body.items.every((b) => b.title !== 'Ficción Inactiva'));

    // Filtro por productType=DIGITAL
    const digitalRes = await request(app).get('/api/books?productType=DIGITAL');
    assert.equal(digitalRes.status, 200);
    assert.equal(digitalRes.body.total, 1);
    assert.equal(digitalRes.body.items[0].title, 'Ficción Digital');

    // Filtro por categoría (usando slug 'historia')
    const histRes = await request(app).get('/api/books?category=historia');
    assert.equal(histRes.status, 200);
    assert.equal(histRes.body.total, 1);
    assert.equal(histRes.body.items[0].title, 'Historia Mundial');

    // Filtro por categoría (usando ObjectId de defaultCategory)
    const ficRes = await request(app).get(`/api/books?category=${defaultCategory._id}`);
    assert.equal(ficRes.status, 200);
    assert.equal(ficRes.body.total, 2);
  });

  test('GET /api/books/:id con ID inválido responde 400; con ID inexistente, 404', async () => {
    // ID inválido
    const invalidRes = await request(app).get('/api/books/no-es-un-id-valido');
    assert.equal(invalidRes.status, 400);
    assert.deepEqual(invalidRes.body, { error: 'Solicitud inválida' });

    // ID válido pero inexistente
    const nonExistentId = new mongoose.Types.ObjectId();
    const notFoundRes = await request(app).get(`/api/books/${nonExistentId}`);
    assert.equal(notFoundRes.status, 404);
    assert.deepEqual(notFoundRes.body, { error: 'Libro no encontrado' });
  });

  test('Categoría con libros no se puede borrar (409)', async () => {
    // Asociar un libro a la categoría defaultCategory
    await Book.create({
      title: 'Libro en categoría',
      author: 'Autor',
      categoryId: defaultCategory._id,
      price: 12,
      productType: 'PHYSICAL',
      stock: 1,
    });

    // Intentar borrar la categoría
    const deleteRes = await request(app)
      .delete(`/api/categories/${defaultCategory._id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', adminCookie);

    assert.equal(deleteRes.status, 409);
    assert.deepEqual(deleteRes.body, { error: 'La categoría tiene libros' });

    // Verificar que la categoría sigue existiendo
    const cat = await Category.findById(defaultCategory._id);
    assert.ok(cat);
  });
});

