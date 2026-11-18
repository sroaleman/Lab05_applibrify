const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Book = require('../models/Book');
const { listLibrary, getDownloadUrl } = require('../services/library');
const { storageService } = require('../services/storage');
const { auth } = require('../middlewares/auth');

function createLibraryRouter(storage = storageService) {
  const router = express.Router();

  // GET /api/library/:bookId/file?token=...
  // Ruta pública sin auth por cookie: la autorización se realiza EXCLUSIVAMENTE
  // a través de la firma y vigencia del JWT temporal en query param ?token=...
  router.get('/:bookId/file', async (req, res, next) => {
    try {
      const { bookId } = req.params;
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.status(401).json({ error: 'Token inválido o ausente' });
      }

      let payload;
      try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
      } catch (jwtErr) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
      }

      // Validar coincidencia de bookId
      if (String(payload.bookId) !== String(bookId)) {
        return res.status(401).json({ error: 'Token no corresponde al libro solicitado' });
      }

      if (!mongoose.Types.ObjectId.isValid(bookId)) {
        return res.status(400).json({ error: 'Solicitud inválida' });
      }

      const book = await Book.findById(bookId);
      if (!book || !book.fileKey) {
        return res.status(404).json({ error: 'Archivo no disponible' });
      }

      const filename = `${book.title || 'libro'}.pdf`;
      res.attachment(filename);

      const fileStream = storage.getFileStream(book.fileKey);

      fileStream.on('error', (streamErr) => {
        if (!res.headersSent) {
          res.status(404).json({ error: 'Archivo no encontrado' });
        }
      });

      return fileStream.pipe(res);
    } catch (err) {
      return next(err);
    }
  });

  // Endpoints protegidos por sesión de usuario (auth)
  router.get('/', auth, async (req, res, next) => {
    try {
      const books = await listLibrary(req.user._id);
      return res.status(200).json(books);
    } catch (err) {
      return next(err);
    }
  });

  router.get('/:bookId/link', auth, async (req, res, next) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.bookId)) {
        return res.status(400).json({ error: 'Solicitud inválida' });
      }

      try {
        const downloadUrl = await getDownloadUrl(req.user._id, req.params.bookId);
        return res.status(200).json({ downloadUrl });
      } catch (err) {
        if (err.status) {
          return res.status(err.status).json({ error: err.message });
        }
        throw err;
      }
    } catch (err) {
      return next(err);
    }
  });

  return router;
}

const defaultLibraryRouter = createLibraryRouter();

module.exports = defaultLibraryRouter;
module.exports.createLibraryRouter = createLibraryRouter;
