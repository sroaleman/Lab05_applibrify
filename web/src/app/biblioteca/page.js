'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function LibraryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/ingresar');
    }
  }, [user, authLoading, router]);

  const loadLibrary = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch('/api/library');
      setBooks(data || []);
    } catch (err) {
      setError(err.message || 'Error al cargar tu biblioteca');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadLibrary();
    }
  }, [user, loadLibrary]);

  const handleDownload = async (bookId) => {
    setDownloadingId(bookId);
    setError(null);
    try {
      const { downloadUrl } = await apiFetch(`/api/library/${bookId}/link`);
      // Abrir la URL firmada devuelta directamente en el navegador sin guardar el token en localStorage
      window.open(downloadUrl, '_blank');
    } catch (err) {
      setError(err.message || 'No se pudo generar el enlace de descarga');
    } finally {
      setDownloadingId(null);
    }
  };

  if (authLoading || (loading && !books.length)) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-leather border-t-transparent"></div>
        <p className="mt-3 text-sm text-brown font-serif italic">Abriendo tu biblioteca personal...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold text-coffee">Mi Biblioteca Digital</h1>
        <p className="text-sm text-brown mt-1">Tus obras y publicaciones digitales listas para lectura</p>
      </div>

      {error && (
        <div className="p-4 bg-card border-l-4 border-leather text-coffee text-sm rounded shadow-sm">
          {error}
        </div>
      )}

      {books.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border-paper p-12 text-center shadow-sm space-y-4">
          <p className="font-serif text-xl text-coffee">Aún no tienes libros en tu biblioteca digital.</p>
          <p className="text-sm text-brown">
            Cuando adquieras obras en formato digital, aparecerán aquí para su descarga inmediata.
          </p>
          <div>
            <Link
              href="/"
              className="inline-block px-6 py-2.5 bg-leather text-paper text-xs font-semibold rounded-lg hover:bg-leather-hover transition-colors shadow-sm"
            >
              Explorar Catálogo Digital
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {books.map((book) => (
            <div
              key={book.bookId}
              className="bg-card rounded-2xl border border-border-paper shadow-sm overflow-hidden flex flex-col justify-between p-6 space-y-4 hover:shadow-md transition-shadow"
            >
              <div className="space-y-3">
                <div className="h-44 bg-gradient-to-br from-[#EFE3D0] via-[#E8D9C2] to-[#D5C2A5] rounded-xl flex items-center justify-center p-4 text-center border border-border-paper relative overflow-hidden">
                  <div className="absolute inset-y-0 left-0 w-3 bg-coffee/15 border-r border-coffee/20 shadow-inner"></div>
                  <span className="font-serif font-bold text-coffee text-sm line-clamp-3">
                    {book.title}
                  </span>
                </div>

                <div>
                  <h2 className="font-serif font-bold text-coffee text-lg leading-snug line-clamp-2">
                    {book.title}
                  </h2>
                  <p className="text-xs text-brown italic font-serif mt-1">{book.author}</p>
                  <p className="text-[10px] text-brown/70 mt-2 font-sans">
                    Adquirido el {new Date(book.grantedAt).toLocaleDateString('es-CO')}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-border-paper">
                <button
                  onClick={() => handleDownload(book.bookId)}
                  disabled={downloadingId === book.bookId}
                  className="w-full py-2.5 px-4 bg-leather hover:bg-leather-hover text-paper text-xs font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {downloadingId === book.bookId ? (
                    <>
                      <div className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-paper border-t-transparent mr-2"></div>
                      <span>Generando enlace seguro...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      <span>Descargar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
