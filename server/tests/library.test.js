const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const User = require('../src/models/User');
const Category = require('../src/models/Category');
const Book = require('../src/models/Book');
const Cart = require('../src/models/Cart');
const Address = require('../src/models/Address');
const Order = require('../src/models/Order');
const Payment = require('../src/models/Payment');
const LibraryEntry = require('../src/models/LibraryEntry');
const { createApp } = require('../src/app');
const { createPaymentsRouter } = require('../src/routes/payments');
const { createLibraryRouter } = require('../src/routes/library');
const { createLocalStorageService } = require('../src/services/storage');

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

describe('Bloque 4B - Biblioteca Digital y Descargas', () => {
  let app;
  let mockPayPal;
  let storage;
  let userACookie;
  let userBCookie;
  let userAId;
  let userBId;
  let digitalBook;
  let physicalBook;
  let category;

  const testStorageDir = path.join(__dirname, '..', 'storage-test-temp');

  before(async () => {
    await mongoose.connect(testUri);
    storage = createLocalStorageService(testStorageDir);
  });

  after(async () => {
    await mongoose.disconnect();
    // Limpiar directorio de storage temporal de pruebas
    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    await LibraryEntry.deleteMany({});
    await Payment.deleteMany({});
    await Order.deleteMany({});
    await Address.deleteMany({});
    await Cart.deleteMany({});
    await Book.deleteMany({});
    await Category.deleteMany({});
    await User.deleteMany({});

    // Guardar archivo físico de prueba en el storage simulado
    storage.saveFile('files/digital-test.pdf', Buffer.from('%PDF-1.4 Contenido secreto del libro digital'));

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

    mockPayPal = {
      calls: { createOrder: 0, captureOrder: 0 },
      createPayPalOrder: async ({ amount, currency, referenceId }) => {
        mockPayPal.calls.createOrder++;
        return { id: 'PAYPAL-ORDER-DIGITAL' };
      },
      capturePayPalOrder: async (providerOrderId) => {
        mockPayPal.calls.captureOrder++;
        return {
          id: providerOrderId,
          status: 'COMPLETED',
          captureId: 'CAPTURE-DIGITAL-123',
          amount: 25.0,
          currency: 'USD',
        };
      },
    };

    app = createApp({
      paymentsRouter: createPaymentsRouter(mockPayPal),
      libraryRouter: createLibraryRouter(storage),
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

    category = await Category.create({ name: 'Tecnología', slug: 'tecnologia' });

    digitalBook = await Book.create({
      title: 'Aprende Node.js',
      author: 'John Doe',
      categoryId: category._id,
      price: 25.0,
      currency: 'USD',
      productType: 'DIGITAL',
      fileKey: 'files/digital-test.pdf',
      coverUrl: 'http://example.com/cover.png',
      isActive: true,
    });

    physicalBook = await Book.create({
      title: 'Manual de Papel',
      author: 'Jane Doe',
      categoryId: category._id,
      price: 30.0,
      currency: 'USD',
      productType: 'PHYSICAL',
      stock: 5,
      isActive: true,
    });
  });

  test('Sin compra: GET /api/library/:bookId/link responde 404', async () => {
    const res = await request(app)
      .get(`/api/library/${digitalBook._id}/link`)
      .set('Cookie', userACookie);

    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: 'No tienes acceso a este libro' });
  });

  test('Después de una captura válida: el libro DIGITAL aparece en GET /api/library', async () => {
    // 1. Crear pedido digital
    const order = await Order.create({
      userId: userAId,
      items: [
        {
          bookId: digitalBook._id,
          titleSnapshot: digitalBook.title,
          productType: 'DIGITAL',
          unitPrice: 25.0,
          qty: 1,
          lineTotal: 25.0,
        },
      ],
      subtotal: 25.0,
      total: 25.0,
      currency: 'USD',
      status: 'PENDING_PAYMENT',
      paymentStatus: 'CREATED',
    });

    // 2. Iniciar y capturar pago
    await request(app)
      .post('/api/payments/paypal/order')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({ orderId: order._id.toString() });

    const captureRes = await request(app)
      .post('/api/payments/paypal/capture')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({
        orderId: order._id.toString(),
        providerOrderId: 'PAYPAL-ORDER-DIGITAL',
      });

    assert.equal(captureRes.status, 200);

    // 3. Consultar la biblioteca del usuario
    const libraryRes = await request(app)
      .get('/api/library')
      .set('Cookie', userACookie);

    assert.equal(libraryRes.status, 200);
    assert.equal(libraryRes.body.length, 1);
    assert.equal(libraryRes.body[0].title, 'Aprende Node.js');
    assert.equal(libraryRes.body[0].author, 'John Doe');
    assert.equal(libraryRes.body[0].coverUrl, 'http://example.com/cover.png');
    assert.equal(libraryRes.body[0].fileKey, undefined);
  });

  test('Un libro PHYSICAL no genera LibraryEntry', async () => {
    // Mock ajustado al total del libro físico (30.0)
    mockPayPal.capturePayPalOrder = async (providerOrderId) => ({
      id: providerOrderId,
      status: 'COMPLETED',
      captureId: 'CAPTURE-PHYS-123',
      amount: 30.0,
      currency: 'USD',
    });

    const order = await Order.create({
      userId: userAId,
      items: [
        {
          bookId: physicalBook._id,
          titleSnapshot: physicalBook.title,
          productType: 'PHYSICAL',
          unitPrice: 30.0,
          qty: 1,
          lineTotal: 30.0,
        },
      ],
      subtotal: 30.0,
      total: 30.0,
      currency: 'USD',
      status: 'PENDING_PAYMENT',
      paymentStatus: 'CREATED',
    });

    await request(app)
      .post('/api/payments/paypal/order')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({ orderId: order._id.toString() });

    await request(app)
      .post('/api/payments/paypal/capture')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({
        orderId: order._id.toString(),
        providerOrderId: 'PAYPAL-ORDER-DIGITAL',
      });

    const entries = await LibraryEntry.find({ userId: userAId });
    assert.equal(entries.length, 0);

    const libraryRes = await request(app)
      .get('/api/library')
      .set('Cookie', userACookie);
    assert.equal(libraryRes.body.length, 0);
  });

  test('Captura repetida no duplica LibraryEntry', async () => {
    const order = await Order.create({
      userId: userAId,
      items: [
        {
          bookId: digitalBook._id,
          titleSnapshot: digitalBook.title,
          productType: 'DIGITAL',
          unitPrice: 25.0,
          qty: 1,
          lineTotal: 25.0,
        },
      ],
      subtotal: 25.0,
      total: 25.0,
      currency: 'USD',
      status: 'PENDING_PAYMENT',
      paymentStatus: 'CREATED',
    });

    await request(app)
      .post('/api/payments/paypal/order')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({ orderId: order._id.toString() });

    // Primera captura
    await request(app)
      .post('/api/payments/paypal/capture')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({
        orderId: order._id.toString(),
        providerOrderId: 'PAYPAL-ORDER-DIGITAL',
      });

    // Segunda captura
    await request(app)
      .post('/api/payments/paypal/capture')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', userACookie)
      .send({
        orderId: order._id.toString(),
        providerOrderId: 'PAYPAL-ORDER-DIGITAL',
      });

    const count = await LibraryEntry.countDocuments({
      userId: userAId,
      bookId: digitalBook._id,
    });
    assert.equal(count, 1);
  });

  test('Link válido: GET /file con el token devuelve 200 y contenido', async () => {
    // Conceder acceso
    const order = await Order.create({
      userId: userAId,
      items: [
        {
          bookId: digitalBook._id,
          titleSnapshot: digitalBook.title,
          productType: 'DIGITAL',
          unitPrice: 25.0,
          qty: 1,
          lineTotal: 25.0,
        },
      ],
      subtotal: 25.0,
      total: 25.0,
      currency: 'USD',
      status: 'PAID',
      paymentStatus: 'CAPTURED',
    });

    await LibraryEntry.create({
      userId: userAId,
      bookId: digitalBook._id,
      orderId: order._id,
    });

    // 1. Obtener el link firmado
    const linkRes = await request(app)
      .get(`/api/library/${digitalBook._id}/link`)
      .set('Cookie', userACookie);

    assert.equal(linkRes.status, 200);
    assert.ok(linkRes.body.downloadUrl);

    // 2. Descargar el archivo usando la URL sin cookie (ruta pública autenticada por token)
    const fileRes = await request(app).get(linkRes.body.downloadUrl);

    assert.equal(fileRes.status, 200);
    const contentDisposition =
      fileRes.headers['content-disposition'] || fileRes.header['content-disposition'];
    assert.ok(contentDisposition, 'La cabecera Content-Disposition debe estar presente');
    assert.ok(contentDisposition.includes('attachment'));
    const contenido = Buffer.isBuffer(fileRes.body)
      ? fileRes.body.toString('utf8')
      : fileRes.text || '';
    assert.ok(contenido.includes('Contenido secreto del libro digital'));
  });

  test('Token expirado: 401', async () => {
    const expiredToken = jwt.sign(
      { sub: String(userAId), bookId: String(digitalBook._id) },
      process.env.JWT_SECRET,
      { expiresIn: '-1s' }
    );

    const res = await request(app).get(
      `/api/library/${digitalBook._id}/file?token=${expiredToken}`
    );

    assert.equal(res.status, 401);
  });

  test('Token de otro libro: 401', async () => {
    const anotherBookId = new mongoose.Types.ObjectId();
    const token = jwt.sign(
      { sub: String(userAId), bookId: String(anotherBookId) },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );

    const res = await request(app).get(
      `/api/library/${digitalBook._id}/file?token=${token}`
    );

    assert.equal(res.status, 401);
  });

  test('Token manipulado (firma inválida): 401', async () => {
    const token = jwt.sign(
      { sub: String(userAId), bookId: String(digitalBook._id) },
      'CLAVE_SECRETA_FALSA',
      { expiresIn: '5m' }
    );

    const res = await request(app).get(
      `/api/library/${digitalBook._id}/file?token=${token}`
    );

    assert.equal(res.status, 401);
  });

  test('Usuario B no puede usar el link de usuario A: 401 o 404', async () => {
    // Usuario B no ha comprado el libro; intentar pedir el link
    const linkRes = await request(app)
      .get(`/api/library/${digitalBook._id}/link`)
      .set('Cookie', userBCookie);

    assert.equal(linkRes.status, 404);
  });

  test('Ninguna respuesta de /api/library incluye fileKey', async () => {
    const order = await Order.create({
      userId: userAId,
      items: [
        {
          bookId: digitalBook._id,
          titleSnapshot: digitalBook.title,
          productType: 'DIGITAL',
          unitPrice: 25.0,
          qty: 1,
          lineTotal: 25.0,
        },
      ],
      subtotal: 25.0,
      total: 25.0,
      currency: 'USD',
      status: 'PAID',
      paymentStatus: 'CAPTURED',
    });

    await LibraryEntry.create({
      userId: userAId,
      bookId: digitalBook._id,
      orderId: order._id,
    });

    const res = await request(app)
      .get('/api/library')
      .set('Cookie', userACookie);

    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].fileKey, undefined);
    assert.equal(JSON.stringify(res.body).includes('files/digital-test.pdf'), false);
  });
});
