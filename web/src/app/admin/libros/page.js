'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

export default function AdminBooksPage() {
  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Formulario nuevo libro / edición
  const [showForm, setShowForm] = useState(false);
  const [editingBookId, setEditingBookId] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    description: '',
    categoryId: '',
    price: '',
    currency: 'USD',
    productType: 'PHYSICAL',
    stock: 0,
    fileKey: '',
  });

  // Modal ajuste de stock
  const [stockModalBook, setStockModalBook] = useState(null);
  const [stockDelta, setStockDelta] = useState('');
  const [stockReason, setStockReason] = useState('');
  const [adjustingStock, setAdjustingStock] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [booksData, catsData] = await Promise.all([
        apiFetch('/api/books?limit=50'),
        apiFetch('/api/categories'),
      ]);
      setBooks(booksData.items || []);
      setCategories(catsData || []);
      if (!formData.categoryId && catsData && catsData.length > 0) {
        setFormData((prev) => ({ ...prev, categoryId: catsData[0]._id }));
      }
    } catch (err) {
      setError(err.message || 'Error al cargar libros o categorías');
    } finally {
      setLoading(false);
    }
  }, [formData.categoryId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setFormData({
      title: '',
      author: '',
      description: '',
      categoryId: categories[0]?._id || '',
      price: '',
      currency: 'USD',
      productType: 'PHYSICAL',
      stock: 0,
      fileKey: '',
    });
    setEditingBookId(null);
    setShowForm(false);
  };

  const handleEditClick = (book) => {
    setEditingBookId(book._id);
    setFormData({
      title: book.title || '',
      author: book.author || '',
      description: book.description || '',
      categoryId: book.categoryId?._id || book.categoryId || categories[0]?._id || '',
      price: book.price ? String(book.price) : '',
      currency: book.currency || 'USD',
      productType: book.productType || 'PHYSICAL',
      stock: book.stock ?? 0,
      fileKey: '',
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveBook = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const payload = {
      title: formData.title.trim(),
      author: formData.author.trim(),
      description: formData.description.trim(),
      categoryId: formData.categoryId,
      price: Number(formData.price),
      currency: formData.currency,
      productType: formData.productType,
      stock: Number(formData.stock) || 0,
    };

    if (formData.productType === 'DIGITAL' && formData.fileKey.trim()) {
      payload.fileKey = formData.fileKey.trim();
    }

    try {
      if (editingBookId) {
        await apiFetch(`/api/books/${editingBookId}`, {
          method: 'PATCH',
          body: payload,
        });
        setSuccess('Libro actualizado exitosamente');
      } else {
        await apiFetch('/api/books', {
          method: 'POST',
          body: payload,
        });
        setSuccess('Libro creado exitosamente');
      }
      resetForm();
      loadData();
    } catch (err) {
      setError(err.message || 'Error al guardar el libro');
    }
  };

  const handleDeleteBook = async (bookId) => {
    if (!confirm('¿Estás seguro de desactivar este libro? Se ocultará del catálogo público.')) return;
    setError(null);
    try {
      await apiFetch(`/api/books/${bookId}`, { method: 'DELETE' });
      setSuccess('Libro desactivado correctamente');
      loadData();
    } catch (err) {
      setError(err.message || 'Error al desactivar el libro');
    }
  };

  const handleStockSubmit = async (e) => {
    e.preventDefault();
    const delta = parseInt(stockDelta, 10);
    if (!delta || delta === 0) {
      setError('El delta debe ser un número entero distinto de 0');
      return;
    }
    if (stockReason.trim().length < 3) {
      setError('El motivo debe tener al menos 3 caracteres');
      return;
    }

    setAdjustingStock(true);
    setError(null);
    try {
      await apiFetch(`/api/books/${stockModalBook._id}/stock`, {
        method: 'PATCH',
        body: {
          delta,
          reason: stockReason.trim(),
        },
      });
      setSuccess(`Stock actualizado exitosamente para "${stockModalBook.title}"`);
      setStockModalBook(null);
      setStockDelta('');
      setStockReason('');
      loadData();
    } catch (err) {
      setError(err.message || 'Error al ajustar stock');
    } finally {
      setAdjustingStock(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-coffee">Catálogo de Libros (Admin)</h1>
          <p className="text-xs text-brown mt-1">
            * Nota: El catálogo público lista solo libros activos. Los cambios de inventario y desactivación se reflejan en tiempo real.
          </p>
        </div>

        <button
          onClick={() => {
            if (showForm) resetForm();
            else setShowForm(true);
          }}
          className="px-4 py-2 bg-leather hover:bg-leather-hover text-paper text-xs font-semibold rounded-lg shadow-sm transition-colors"
        >
          {showForm ? 'Cerrar Formulario' : '+ Nuevo Libro'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-card border-l-4 border-leather text-coffee text-sm rounded shadow-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-[#EAF2E8] border border-[#3E5B3A]/30 text-[#3E5B3A] text-sm rounded-lg shadow-sm">
          {success}
        </div>
      )}

      {/* Formulario de Creación / Edición */}
      {showForm && (
        <div className="bg-card p-6 sm:p-8 rounded-2xl border border-border-paper shadow-sm space-y-4">
          <h2 className="font-serif font-bold text-xl text-coffee pb-2 border-b border-border-paper">
            {editingBookId ? 'Editar Libro' : 'Crear Nuevo Libro'}
          </h2>

          <form onSubmit={handleSaveBook} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-brown mb-1">
                Título *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Título de la obra"
                className="w-full px-3 py-2 bg-paper border border-border-paper rounded-lg text-xs text-coffee focus:outline-none focus:ring-2 focus:ring-leather"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-brown mb-1">
                Autor *
              </label>
              <input
                type="text"
                required
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                placeholder="Nombre del autor"
                className="w-full px-3 py-2 bg-paper border border-border-paper rounded-lg text-xs text-coffee focus:outline-none focus:ring-2 focus:ring-leather"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-brown mb-1">
                Categoría *
              </label>
              <select
                required
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="w-full px-3 py-2 bg-paper border border-border-paper rounded-lg text-xs text-coffee focus:outline-none focus:ring-2 focus:ring-leather"
              >
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-brown mb-1">
                Tipo de Producto *
              </label>
              <select
                value={formData.productType}
                onChange={(e) => setFormData({ ...formData, productType: e.target.value })}
                className="w-full px-3 py-2 bg-paper border border-border-paper rounded-lg text-xs text-coffee focus:outline-none focus:ring-2 focus:ring-leather"
              >
                <option value="PHYSICAL">Libro Físico (PHYSICAL)</option>
                <option value="DIGITAL">Libro Digital (DIGITAL)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-brown mb-1">
                Precio (USD) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="29.99"
                className="w-full px-3 py-2 bg-paper border border-border-paper rounded-lg text-xs text-coffee focus:outline-none focus:ring-2 focus:ring-leather"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-brown mb-1">
                Stock Inicial
              </label>
              <input
                type="number"
                min="0"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                className="w-full px-3 py-2 bg-paper border border-border-paper rounded-lg text-xs text-coffee focus:outline-none focus:ring-2 focus:ring-leather"
              />
            </div>

            {formData.productType === 'DIGITAL' && (
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-brown mb-1">
                  FileKey (Ruta del archivo digital en almacenamiento) *
                </label>
                <input
                  type="text"
                  required={!editingBookId}
                  value={formData.fileKey}
                  onChange={(e) => setFormData({ ...formData, fileKey: e.target.value })}
                  placeholder="files/nombre-libro.pdf"
                  className="w-full px-3 py-2 bg-paper border border-border-paper rounded-lg text-xs text-coffee focus:outline-none focus:ring-2 focus:ring-leather"
                />
              </div>
            )}

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-brown mb-1">
                Descripción / Sinopsis
              </label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción del contenido..."
                className="w-full px-3 py-2 bg-paper border border-border-paper rounded-lg text-xs text-coffee focus:outline-none focus:ring-2 focus:ring-leather"
              />
            </div>

            <div className="md:col-span-2 flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-border-paper text-coffee text-xs font-semibold rounded-lg hover:border-leather"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-leather hover:bg-leather-hover text-paper text-xs font-semibold rounded-lg shadow-sm"
              >
                {editingBookId ? 'Guardar Cambios' : 'Crear Libro'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal / Panel de Ajuste de Stock */}
      {stockModalBook && (
        <div className="fixed inset-0 bg-coffee/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card p-6 sm:p-8 rounded-2xl border border-border-paper shadow-xl max-w-md w-full space-y-4">
            <h3 className="font-serif font-bold text-xl text-coffee">
              Ajustar Inventario
            </h3>
            <p className="text-xs text-brown">
              Libro: <strong className="text-coffee">{stockModalBook.title}</strong>
              <br />
              Stock actual: <strong className="text-leather">{stockModalBook.stock} unidades</strong>
            </p>

            <form onSubmit={handleStockSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-brown mb-1">
                  Delta (ej. +5 para agregar, -2 para restar) *
                </label>
                <input
                  type="number"
                  required
                  value={stockDelta}
                  onChange={(e) => setStockDelta(e.target.value)}
                  placeholder="-1 o +5"
                  className="w-full px-3 py-2 bg-paper border border-border-paper rounded-lg text-xs text-coffee focus:outline-none focus:ring-2 focus:ring-leather"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-brown mb-1">
                  Motivo del Ajuste (mínimo 3 caracteres) *
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={stockReason}
                  onChange={(e) => setStockReason(e.target.value)}
                  placeholder="Llegada de proveedor, merma, daño..."
                  className="w-full px-3 py-2 bg-paper border border-border-paper rounded-lg text-xs text-coffee focus:outline-none focus:ring-2 focus:ring-leather"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setStockModalBook(null)}
                  className="px-4 py-2 border border-border-paper text-coffee text-xs font-semibold rounded-lg hover:border-leather"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={adjustingStock}
                  className="px-5 py-2 bg-leather hover:bg-leather-hover text-paper text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50"
                >
                  {adjustingStock ? 'Guardando...' : 'Aplicar Ajuste'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tabla de Libros */}
      {loading ? (
        <div className="text-center py-20 bg-card rounded-2xl border border-border-paper">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-leather border-t-transparent"></div>
          <p className="mt-3 text-sm text-brown font-serif italic">Cargando inventario de libros...</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border-paper shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-coffee">
              <thead className="bg-paper border-b border-border-paper uppercase tracking-wider text-[10px] text-brown font-semibold">
                <tr>
                  <th className="p-4">Título & Autor</th>
                  <th className="p-4">Categoría</th>
                  <th className="p-4">Tipo</th>
                  <th className="p-4">Precio</th>
                  <th className="p-4">Stock</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-paper">
                {books.map((b) => (
                  <tr key={b._id} className="hover:bg-paper/50 transition-colors">
                    <td className="p-4">
                      <div className="font-serif font-bold text-coffee text-sm">{b.title}</div>
                      <div className="text-xs text-brown italic">{b.author}</div>
                    </td>
                    <td className="p-4">{b.categoryId?.name || 'General'}</td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          b.productType === 'DIGITAL'
                            ? 'bg-badge-digital-bg text-badge-digital-text'
                            : 'bg-badge-physical-bg text-badge-physical-text'
                        }`}
                      >
                        {b.productType}
                      </span>
                    </td>
                    <td className="p-4 font-bold font-sans">
                      ${b.price?.toFixed(2)} {b.currency}
                    </td>
                    <td className="p-4 font-sans font-bold text-leather">
                      {b.stock}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => setStockModalBook(b)}
                        className="px-2.5 py-1 bg-paper border border-border-paper hover:border-leather text-[11px] font-semibold rounded"
                        title="Ajustar Stock"
                      >
                        ± Stock
                      </button>

                      <Link
                        href={`/admin/libros/${b._id}/movimientos`}
                        className="px-2.5 py-1 bg-paper border border-border-paper hover:border-leather text-[11px] font-semibold rounded inline-block"
                      >
                        Movimientos
                      </Link>

                      <button
                        onClick={() => handleEditClick(b)}
                        className="px-2.5 py-1 bg-paper border border-border-paper hover:border-leather text-[11px] font-semibold rounded"
                      >
                        Editar
                      </button>

                      <button
                        onClick={() => handleDeleteBook(b._id)}
                        className="px-2.5 py-1 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 text-[11px] font-semibold rounded"
                      >
                        Desactivar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
