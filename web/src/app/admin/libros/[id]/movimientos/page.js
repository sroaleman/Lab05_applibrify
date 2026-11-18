'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

export default function BookMovementsPage() {
  const { id } = useParams();
  const [book, setBook] = useState(null);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchMovements() {
      setLoading(true);
      setError(null);
      try {
        const [bookData, movData] = await Promise.all([
          apiFetch(`/api/books/${id}`).catch(() => null),
          apiFetch(`/api/books/${id}/movements`),
        ]);
        setBook(bookData);
        setMovements(movData || []);
      } catch (err) {
        setError(err.message || 'Error al consultar movimientos de inventario');
      } finally {
        setLoading(false);
      }
    }
    if (id) {
      fetchMovements();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="text-center py-20 bg-card rounded-2xl border border-border-paper">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-leather border-t-transparent"></div>
        <p className="mt-3 text-sm text-brown font-serif italic">Cargando kardex de movimientos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/libros"
            className="text-xs font-medium text-leather hover:text-leather-hover underline inline-flex items-center mb-2"
          >
            ← Volver al listado de libros
          </Link>
          <h1 className="font-serif text-3xl font-bold text-coffee">
            Kardex de Movimientos: {book?.title || 'Libro'}
          </h1>
          <p className="text-xs text-brown">
            Stock actual: <strong className="text-leather">{book?.stock ?? 'N/D'} unidades</strong>
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-card border-l-4 border-leather text-coffee text-sm rounded shadow-sm">
          {error}
        </div>
      )}

      {movements.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border-paper p-12 text-center shadow-sm">
          <p className="font-serif text-lg text-coffee">No hay movimientos registrados para este libro.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border-paper shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-coffee">
              <thead className="bg-paper border-b border-border-paper uppercase tracking-wider text-[10px] text-brown font-semibold">
                <tr>
                  <th className="p-4">Fecha y Hora</th>
                  <th className="p-4">Delta (Cantidad)</th>
                  <th className="p-4">Tipo</th>
                  <th className="p-4">Motivo / Razón</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-paper">
                {movements.map((m) => (
                  <tr key={m._id} className="hover:bg-paper/50 transition-colors">
                    <td className="p-4 text-xs font-mono">
                      {new Date(m.createdAt).toLocaleString('es-CO')}
                    </td>
                    <td className="p-4 font-sans font-bold">
                      <span
                        className={`px-2 py-0.5 rounded ${
                          m.delta > 0
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {m.delta > 0 ? `+${m.delta}` : m.delta}
                      </span>
                    </td>
                    <td className="p-4 font-semibold text-brown">{m.type}</td>
                    <td className="p-4 text-xs">{m.reason}</td>
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
