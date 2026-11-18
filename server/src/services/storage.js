const fs = require('fs');
const path = require('path');

/**
 * Servicio de almacenamiento de archivos.
 * Para desarrollo y pruebas locales, almacena y lee archivos desde server/storage-private/.
 *
 * NOTA DE ARQUITECTURA: En entornos de producción (AWS S3, Google Cloud Storage, Cloudflare R2, etc.),
 * esta implementación se reemplaza por clientes de almacenamiento de objetos en la nube,
 * manteniendo la interfaz getFileStream(fileKey).
 */
function createLocalStorageService(baseDirectory) {
  const rootDir = baseDirectory || path.join(__dirname, '..', '..', 'storage-private');

  // Asegurar que exista la carpeta base privada
  if (!fs.existsSync(rootDir)) {
    fs.mkdirSync(rootDir, { recursive: true });
  }

  function getFilePath(fileKey) {
    const safeKey = path.normalize(fileKey).replace(/^(\.\.(\/|\\|$))+/, '');
    return path.join(rootDir, safeKey);
  }

  function getFileStream(fileKey) {
    const fullPath = getFilePath(fileKey);

    if (!fs.existsSync(fullPath)) {
      const err = new Error('Archivo no encontrado');
      err.code = 'FILE_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    return fs.createReadStream(fullPath);
  }

  function saveFile(fileKey, bufferOrStream) {
    const fullPath = getFilePath(fileKey);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, bufferOrStream);
  }

  return {
    getFileStream,
    saveFile,
    getFilePath,
  };
}

const defaultStorage = createLocalStorageService();

module.exports = {
  createLocalStorageService,
  storageService: defaultStorage,
};
