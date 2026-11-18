'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

export default function HomePage() {
  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cargar categorías disponibles
  useEffect(() => {
    async function loadCategories() {
      try {
        const data = await apiFetch('/api/categories');
        setCategories(data || []);
      } catch (err) {
        // Error no bloqueante para el catálogo
      }
    }
    loadCategories();
  }, []);

  // Cargar libros con filtros
  const fetchBooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) {
        params.set('q', searchQuery.trim());
      }
      if (selectedCategory) {
        params.set('category', selectedCategory);
      }

      const queryStr = params.toString();
      const endpoint = queryStr ? `/api/books?${queryStr}` : '/api/books';
      const data = await apiFetch(endpoint);
      setBooks(data.items || []);
    } catch (err) {
      setError(err.message || 'Error al cargar libros');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategory]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchBooks();
  };

  const scrollToCatalog = () => {
    const el = document.getElementById('catalogo-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-12 pb-16">
      {/* 2. Banner de inicio estilo biblioteca / editorial */}
      <section className="bg-coffee text-paper py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-b-4 border-gold shadow-md relative overflow-hidden">
        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-6">
          <div className="inline-block px-3 py-1 border border-gold/40 rounded-full text-xs font-serif uppercase tracking-widest text-gold mb-2">
            Editorial & Colección Literaria
          </div>
          <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-paper leading-tight">
            Tu biblioteca digital y física
          </h1>
          <p className="text-base sm:text-lg text-paper/80 max-w-2xl mx-auto font-sans font-light leading-relaxed">
            Descubre clásicos y obras contemporáneas. Elige entre la calidez del papel impreso
            o la inmediatez de la lectura digital.
          </p>
          <div className="pt-4">
            <button
              onClick={scrollToCatalog}
              className="inline-flex items-center px-8 py-3.5 bg-leather hover:bg-leather-hover text-paper font-medium text-sm tracking-wide rounded-md shadow-md transition-all duration-200 border border-gold/30 hover:border-gold"
            >
              <span>Explorar catálogo</span>
              <svg
                className="w-4 h-4 ml-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* Contenedor central */}
      <div id="catalogo-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* 4. Barra de Filtros en blanco cálido y bordes redondeados */}
        <div className="bg-card p-6 rounded-xl border border-border-paper shadow-sm">
          <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por título o autor..."
                className="w-full pl-4 pr-10 py-3 bg-paper border border-border-paper rounded-lg text-sm text-coffee placeholder-brown/60 focus:outline-none focus:ring-2 focus:ring-leather focus:border-transparent transition-all"
              />
              <span className="absolute right-3 top-3 text-brown/60">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </span>
            </div>

            <div className="w-full md:w-72">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-3 bg-paper border border-border-paper rounded-lg text-sm text-coffee focus:outline-none focus:ring-2 focus:ring-leather focus:border-transparent transition-all cursor-pointer"
              >
                <option value="">Todas las categorías</option>
                {categories.map((cat) => (
                  <option key={cat._id} value={cat.slug || cat._id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="px-8 py-3 bg-leather hover:bg-leather-hover text-paper font-medium rounded-lg text-sm transition-colors shadow-sm"
            >
              Buscar
            </button>
          </form>
        </div>

        {/* Mensaje de error */}
        {error && (
          <div className="p-4 bg-card border-l-4 border-leather text-coffee text-sm rounded shadow-sm">
            {error}
          </div>
        )}

        {/* 3. Sección "Novedades" / Catálogo */}
        <div>
          <div className="flex items-center justify-between mb-6 pb-3 border-b border-border-paper">
            <div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-coffee tracking-tight">
                Novedades y Catálogo
              </h2>
              <p className="text-sm text-brown mt-1">Explora nuestras obras seleccionadas</p>
            </div>
            <span className="text-xs font-serif italic text-brown hidden sm:inline">
              Mostrando {books.length} {books.length === 1 ? 'libro' : 'libros'}
            </span>
          </div>

          {loading ? (
            <div className="text-center py-20 bg-card rounded-xl border border-border-paper">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-leather border-t-transparent"></div>
              <p className="mt-3 text-sm text-brown font-serif italic">Cargando biblioteca...</p>
            </div>
          ) : books.length === 0 ? (
            <div className="text-center py-20 bg-card rounded-xl border border-border-paper">
              <p className="text-brown font-serif text-lg">
                No se encontraron obras disponibles con los criterios seleccionados.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('');
                }}
                className="mt-4 text-sm font-medium text-leather underline hover:text-leather-hover"
              >
                Limpiar filtros
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {books.map((book) => {
                const isDigital = book.productType === 'DIGITAL';
                return (
                  <div
                    key={book._id}
                    className="bg-card rounded-xl border border-border-paper shadow-sm flex flex-col overflow-hidden transform hover:-translate-y-1 hover:shadow-md transition-all duration-200 group"
                  >
                    {/* Portada estilo lomo / encuadernación */}
                    <div className="h-56 bg-gradient-to-br from-[#EFE3D0] via-[#E8D9C2] to-[#D5C2A5] flex items-center justify-center p-6 text-center border-b border-border-paper relative overflow-hidden">
                      <div className="absolute inset-y-0 left-0 w-3 bg-coffee/15 border-r border-coffee/20 shadow-inner"></div>
                      <span className="font-serif font-bold text-coffee text-base line-clamp-3 px-2 group-hover:scale-105 transition-transform duration-200">
                        {book.title}
                      </span>
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div>
                        {/* Etiqueta Digital / Físico con paleta exacta */}
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                              isDigital
                                ? 'bg-badge-digital-bg text-badge-digital-text border border-badge-digital-text/20'
                                : 'bg-badge-physical-bg text-badge-physical-text border border-badge-physical-text/20'
                            }`}
                          >
                            {isDigital ? 'Digital' : 'Físico'}
                          </span>
                          <span className="text-xs text-brown truncate max-w-[120px]">
                            {book.categoryId?.name || ''}
                          </span>
                        </div>

                        <h3 className="font-serif font-bold text-coffee text-lg leading-snug line-clamp-2 group-hover:text-leather transition-colors">
                          {book.title}
                        </h3>
                        <p className="text-sm text-brown mt-1 line-clamp-1 italic font-serif">
                          {book.author}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-border-paper flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-brown block">
                            Precio
                          </span>
                          <span className="text-lg font-bold text-coffee font-sans">
                            ${book.price?.toFixed(2)}{' '}
                            <span className="text-xs font-normal text-brown">{book.currency}</span>
                          </span>
                        </div>

                        <Link
                          href={`/libros/${book._id}`}
                          className="inline-flex items-center text-xs font-semibold text-leather hover:text-leather-hover transition-colors"
                        >
                          <span>Ver detalle</span>
                          <span className="ml-1 text-sm font-bold">→</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
