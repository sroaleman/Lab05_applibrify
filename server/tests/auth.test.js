const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');
const User = require('../src/models/User');
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

describe('Bloque 1 - Autenticación y Middlewares', () => {
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

  test('Registro exitoso con rol cliente', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send({
        name: 'Juan Perez',
        email: 'juan@example.com',
        password: 'password123',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.email, 'juan@example.com');
    assert.equal(res.body.role, 'cliente');
    assert.equal(res.body.passwordHash, undefined);
  });

  test('Envío de role "administrador" ignorado; el usuario queda como cliente', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send({
        name: 'Admin Falso',
        email: 'adminfalso@example.com',
        password: 'password123',
        role: 'administrador',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.role, 'cliente');
  });

  test('Email repetido responde 409', async () => {
    await request(app)
      .post('/api/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send({
        name: 'Usuario Uno',
        email: 'repetido@example.com',
        password: 'password123',
      });

    const res = await request(app)
      .post('/api/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send({
        name: 'Usuario Dos',
        email: 'repetido@example.com',
        password: 'password123',
      });

    assert.equal(res.status, 409);
    assert.deepEqual(res.body, { error: 'No se pudo completar el registro' });
  });

  test('Login correcto devuelve cookie httpOnly "token"', async () => {
    await request(app)
      .post('/api/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send({
        name: 'Login User',
        email: 'login@example.com',
        password: 'password123',
      });

    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({
        email: 'login@example.com',
        password: 'password123',
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.email, 'login@example.com');

    const cookies = res.headers['set-cookie'];
    assert.ok(Array.isArray(cookies) && cookies.length > 0);
    const tokenCookie = cookies.find((c) => c.startsWith('token='));
    assert.ok(tokenCookie);
    assert.match(tokenCookie, /HttpOnly/i);
  });

  test('Login incorrecto responde 401 con "Email o contraseña incorrectos"', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({
        email: 'noexiste@example.com',
        password: 'wrongpassword',
      });

    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: 'Email o contraseña incorrectos' });
  });

  test('/me sin cookie responde 401', async () => {
    const res = await request(app).get('/api/auth/me');

    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: 'Unauthorized' });
  });

  test('/me con cookie devuelve el usuario sin passwordHash', async () => {
    await request(app)
      .post('/api/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send({
        name: 'Me User',
        email: 'me@example.com',
        password: 'password123',
      });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({
        email: 'me@example.com',
        password: 'password123',
      });

    const setCookies = loginRes.headers['set-cookie'];
    const cookieHeader = (setCookies || []).map((c) => c.split(';')[0]).join('; ');

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookieHeader);

    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.email, 'me@example.com');
    assert.equal(meRes.body.name, 'Me User');
    assert.equal(meRes.body.passwordHash, undefined);
  });

  test('Origin distinto de http://localhost:3000 responde 403', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Origin', 'http://attacker.com')
      .send({
        name: 'Evil User',
        email: 'evil@example.com',
        password: 'password123',
      });

    assert.equal(res.status, 403);
    assert.deepEqual(res.body, { error: 'Forbidden' });
  });

  test('JSON mal formado responde 400 con "Solicitud inválida"', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set('Content-Type', 'application/json')
      .send('{"email": invalid_json');

    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { error: 'Solicitud inválida' });
  });
});

