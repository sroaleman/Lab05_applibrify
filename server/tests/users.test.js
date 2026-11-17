const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
const { createApp } = require('../src/app');
const { createOrPromoteAdmin } = require('../src/scripts/create-admin');

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

describe('Bloque 2 - Roles y Administración de Usuarios', () => {
  let app;

  before(async () => {
    await mongoose.connect(testUri);
  });

  after(async () => {
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    app = createApp();
    await User.deleteMany({});
  });

  test('Cliente recibe 403 en GET /api/users', async () => {
    const clientEmail = 'cliente@example.com';
    const clientPass = 'cliente123';
    const passwordHash = await bcrypt.hash(clientPass, 12);
    await User.create({
      name: 'Cliente Prueba',
      email: clientEmail,
      passwordHash,
      role: 'cliente',
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email: clientEmail, password: clientPass });

    const cookieHeader = loginRes.headers['set-cookie']
      .map((c) => c.split(';')[0])
      .join('; ');

    const res = await request(app)
      .get('/api/users')
      .set('Cookie', cookieHeader);

    assert.equal(res.status, 403);
    assert.deepEqual(res.body, { error: 'Forbidden' });
  });

  test('Administrador lista usuarios sin passwordHash', async () => {
    const adminEmail = 'admin@example.com';
    const adminPass = 'admin1234';
    const adminPassHash = await bcrypt.hash(adminPass, 12);
    await User.create({
      name: 'Admin Boss',
      email: adminEmail,
      passwordHash: adminPassHash,
      role: 'administrador',
    });

    const clientPassHash = await bcrypt.hash('client1234', 12);
    await User.create({
      name: 'Client User',
      email: 'regular@example.com',
      passwordHash: clientPassHash,
      role: 'cliente',
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email: adminEmail, password: adminPass });

    const cookieHeader = loginRes.headers['set-cookie']
      .map((c) => c.split(';')[0])
      .join('; ');

    const res = await request(app)
      .get('/api/users')
      .set('Cookie', cookieHeader);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.equal(res.body.length, 2);

    for (const u of res.body) {
      assert.equal(u.passwordHash, undefined);
      assert.ok(u.email);
      assert.ok(u.role);
    }
  });

  test('Cambio de rol válido', async () => {
    const adminEmail = 'admin@example.com';
    const adminPass = 'admin1234';
    const adminPassHash = await bcrypt.hash(adminPass, 12);
    await User.create({
      name: 'Admin Boss',
      email: adminEmail,
      passwordHash: adminPassHash,
      role: 'administrador',
    });

    const targetPassHash = await bcrypt.hash('target1234', 12);
    const targetUser = await User.create({
      name: 'Target User',
      email: 'target@example.com',
      passwordHash: targetPassHash,
      role: 'cliente',
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email: adminEmail, password: adminPass });

    const cookieHeader = loginRes.headers['set-cookie']
      .map((c) => c.split(';')[0])
      .join('; ');

    const res = await request(app)
      .patch(`/api/users/${targetUser._id}/role`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookieHeader)
      .send({ role: 'administrador' });

    assert.equal(res.status, 200);
    assert.equal(res.body.role, 'administrador');
    assert.equal(res.body.passwordHash, undefined);

    const updated = await User.findById(targetUser._id);
    assert.equal(updated.role, 'administrador');
  });

  test('Administrador no puede quitarse su propio rol', async () => {
    const adminEmail = 'selfadmin@example.com';
    const adminPass = 'admin1234';
    const adminPassHash = await bcrypt.hash(adminPass, 12);
    const admin = await User.create({
      name: 'Self Admin',
      email: adminEmail,
      passwordHash: adminPassHash,
      role: 'administrador',
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email: adminEmail, password: adminPass });

    const cookieHeader = loginRes.headers['set-cookie']
      .map((c) => c.split(';')[0])
      .join('; ');

    const res = await request(app)
      .patch(`/api/users/${admin._id}/role`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookieHeader)
      .send({ role: 'cliente' });

    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { error: 'No puedes quitarte tu propio rol' });

    const notChanged = await User.findById(admin._id);
    assert.equal(notChanged.role, 'administrador');
  });

  test('El script create-admin no duplica emails', async () => {
    // 1. Crear nuevo usuario administrador
    const res1 = await createOrPromoteAdmin({
      email: 'uniqueadmin@example.com',
      password: 'initialpassword123',
      name: 'Admin Original',
    });
    assert.equal(res1.action, 'created');
    assert.equal(res1.user.role, 'administrador');

    // 2. Ejecutar nuevamente con el mismo email pero diferente contraseña
    const res2 = await createOrPromoteAdmin({
      email: 'uniqueadmin@example.com',
      password: 'newpassword456',
    });
    assert.equal(res2.action, 'promoted');
    assert.equal(res2.user.role, 'administrador');

    // Verificar que solo exista un documento en la base de datos
    const count = await User.countDocuments({ email: 'uniqueadmin@example.com' });
    assert.equal(count, 1);

    const updatedUser = await User.findOne({ email: 'uniqueadmin@example.com' }).select('+passwordHash');
    const matchesNewPass = await bcrypt.compare('newpassword456', updatedUser.passwordHash);
    assert.ok(matchesNewPass);
  });
});
