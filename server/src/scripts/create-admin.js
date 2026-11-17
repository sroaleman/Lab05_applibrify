const readline = require('readline');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');

function promptPassword(promptText) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const stdin = process.stdin;
    const isTTY = stdin.isTTY;

    if (isTTY) {
      stdin.setRawMode(true);
      process.stdout.write(promptText);
      let password = '';

      const onData = (char) => {
        const c = char.toString('utf8');
        if (c === '\n' || c === '\r' || c === '\u0004') {
          stdin.setRawMode(false);
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          rl.close();
          resolve(password);
        } else if (c === '\u0003') {
          // Ctrl+C
          process.exit(1);
        } else if (c === '\b' || c === '\x7f') {
          password = password.slice(0, -1);
        } else {
          password += c;
        }
      };

      stdin.on('data', onData);
    } else {
      rl.question(promptText, (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

async function createOrPromoteAdmin({ email, password, name = 'Administrador' }) {
  if (!email || !password) {
    throw new Error('Email y contraseña son obligatorios.');
  }

  const normalizedEmail = email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await User.findOne({ email: normalizedEmail });

  if (existing) {
    existing.role = 'administrador';
    existing.passwordHash = passwordHash;
    await existing.save();
    return { user: existing, action: 'promoted' };
  }

  const user = await User.create({
    name,
    email: normalizedEmail,
    passwordHash,
    role: 'administrador',
  });

  return { user, action: 'created' };
}

async function main() {
  const path = require('path');
  const dotenv = require('dotenv');
  dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

  const emailArg = process.argv[2];
  if (!emailArg) {
    console.error('Uso: node src/scripts/create-admin.js <email>');
    process.exit(1);
  }

  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    password = await promptPassword('Contraseña del administrador: ');
  }

  if (!password || password.length < 8) {
    console.error('La contraseña debe tener al menos 8 caracteres.');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI no está definida.');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    const result = await createOrPromoteAdmin({ email: emailArg, password });
    if (result.action === 'promoted') {
      console.log(`Usuario ${result.user.email} promovido a administrador exitosamente.`);
    } else {
      console.log(`Administrador ${result.user.email} creado exitosamente.`);
    }
  } catch (err) {
    console.error('Error al procesar el administrador:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { createOrPromoteAdmin };

