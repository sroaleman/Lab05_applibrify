'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function BookDetailPage() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    async function fetchBook() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch(`/api/books/${id}`);
        setBook(data);
      } catch (err) {
        setError(err.message || 'Error al cargar el libro');
      } finally {
        setLoading(false);
      }
    }
    if (id) {
      fetchBook();
    }
  }, [id]);

  const handleAddToCart = async () => {
    setAdding(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await apiFetch(`/api/cart/items/${id}`, {
        method: 'PUT',
        body: { qty: 1 },
      });
      setSuccessMessage('¡Libro agregado al carrito exitosamente!');
    } catch (err) {
      setError(err.message || 'No se pudo agregar al carrito');
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-leather border-t-transparent"></div>
        <p className="mt-3 text-sm text-brown font-serif italic">Abriendo tomo...</p>
      </div>
    );
  }

  if (error && !book) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-card rounded-xl border border-border-paper text-center shadow-sm">
        <h2 className="font-serif text-xl font-bold text-coffee mb-2">Obra no disponible</h2>
        <p className="text-brown text-sm mb-6">{error}</p>
        <Link
          href="/"
          className="inline-block px-6 py-2.5 bg-leather text-paper rounded-md text-sm font-medium hover:bg-leather-hover transition-colors"
        >
          Volver al catálogo
        </Link>
      </div>
    );
  }

  const isDigital = book?.productType === 'DIGITAL';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-6">
        <Link
          href="/"
          className="text-xs font-medium text-brown hover:text-leather inline-flex items-center transition-colors"
        >
          ← Volver al catálogo principal
        </Link>
      </div>

      <div className="bg-card rounded-2xl border border-border-paper shadow-md overflow-hidden p-6 sm:p-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Portada grande a la izquierda */}
          <div className="md:col-span-5 h-80 sm:h-96 md:h-full min-h-[360px] bg-gradient-to-br from-[#EFE3D0] via-[#E8D9C2] to-[#D5C2A5] rounded-xl flex items-center justify-center p-8 text-center border border-border-paper relative overflow-hidden shadow-inner">
            <div className="absolute inset-y-0 left-0 w-5 bg-coffee/20 border-r border-coffee/30 shadow-inner"></div>
            <div className="space-y-3 z-10 max-w-xs">
              <span className="text-[11px] uppercase tracking-widest font-serif text-leather font-bold block">
                {isDigital ? 'Edición Digital' : 'Edición Impresa'}
              </span>
              <h2 className="font-serif font-bold text-coffee text-2xl sm:text-3xl leading-snug">
                {book.title}
              </h2>
              <div className="w-12 h-0.5 bg-gold/60 mx-auto"></div>
              <p className="text-sm font-serif italic text-brown">{book.author}</p>
            </div>
          </div>

          {/* Información y acciones a la derecha */}
          <div className="md:col-span-7 flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center space-x-3 mb-3">
                <span
                  className={`text-xs font-semibold px-3 py-0.5 rounded-full ${
                    isDigital
                      ? 'bg-badge-digital-bg text-badge-digital-text border border-badge-digital-text/20'
                      : 'bg-badge-physical-bg text-badge-physical-text border border-badge-physical-text/20'
                  }`}
                >
                  {isDigital ? 'Libro Digital' : 'Libro Físico'}
                </span>
                <span className="text-xs text-brown font-serif italic">
                  Categoría: {book.categoryId?.name || 'General'}
                </span>
              </div>

              <h1 className="font-serif text-3xl sm:text-4xl font-bold text-coffee leading-tight">
                {book.title}
              </h1>
              <p className="text-base text-brown mt-2 font-serif">
                Por <strong className="text-coffee font-sans font-semibold">{book.author}</strong>
              </p>

              <div className="my-6 p-5 bg-paper rounded-xl border border-border-paper">
                <span className="text-[11px] uppercase tracking-wider text-brown block mb-1">
                  Precio unitario
                </span>
                <span className="font-serif text-4xl font-bold text-coffee">
                  ${book.price?.toFixed(2)}{' '}
                  <span className="text-base font-normal text-brown font-sans">{book.currency}</span>
                </span>
                {!isDigital && (
                  <span className="text-xs text-brown block mt-2 font-sans">
                    Copias disponibles en almacén: <strong>{book.stock}</strong>
                  </span>
                )}
              </div>

              <div className="prose prose-sm text-brown leading-relaxed">
                <h3 className="font-serif text-base font-bold text-coffee mb-2">Sinopsis</h3>
                <p className="whitespace-pre-line text-sm text-coffee/90">
                  {book.description || 'No hay descripción detallada disponible para esta obra.'}
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-border-paper">
              {/* Mensajes */}
              {successMessage && (
                <div className="mb-4 p-3 bg-[#EAF2E8] border border-[#3E5B3A]/30 text-[#3E5B3A] text-sm rounded-lg">
                  {successMessage}
                </div>
              )}
              {error && (
                <div className="mb-4 p-3 bg-card border-l-4 border-leather text-coffee text-sm rounded-lg">
                  {error}
                </div>
              )}

              {/* Botón de acción */}
              {!authLoading && (
                <>
                  {user ? (
                    <button
                      onClick={handleAddToCart}
                      disabled={adding || (!isDigital && book.stock < 1)}
                      className="w-full py-3.5 px-6 bg-leather hover:bg-leather-hover text-paper font-medium text-base rounded-lg transition-colors flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50"
                    >
                      {adding ? (
                        <>
                          <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-paper border-t-transparent mr-2"></div>
                          <span>Guardando en el carrito...</span>
                        </>
                      ) : !isDigital && book.stock < 1 ? (
                        <span>Ejemplar agotado</span>
                      ) : (
                        <span>Agregar al carrito</span>
                      )}
                    </button>
                  ) : (
                    <div className="p-5 bg-paper border border-border-paper rounded-xl text-center space-y-3">
                      <p className="text-sm text-brown font-serif italic">
                        Inicia sesión para añadir este título a tu carrito y completar tu compra.
                      </p>
                      <Link
                        href="/ingresar"
                        className="inline-block px-6 py-2.5 bg-leather text-paper rounded-lg text-sm font-medium hover:bg-leather-hover transition-colors shadow-sm"
                      >
                        Iniciar Sesión
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
