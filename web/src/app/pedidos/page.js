'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/ingresar');
    }
  }, [user, authLoading, router]);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch('/api/orders/me');
      setOrders(data || []);
    } catch (err) {
      setError(err.message || 'Error al cargar tus pedidos');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadOrders();
    }
  }, [user, loadOrders]);

  if (authLoading || (loading && !orders.length)) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-leather border-t-transparent"></div>
        <p className="mt-3 text-sm text-brown font-serif italic">Consultando historial de compras...</p>
      </div>
    );
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-badge-physical-bg text-badge-physical-text border border-badge-physical-text/20">
            Pagado
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
            Completado
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
            Cancelado
          </span>
        );
      case 'PENDING_PAYMENT':
      default:
        return (
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
            Pendiente de Pago
          </span>
        );
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold text-coffee">Mis Pedidos</h1>
        <p className="text-sm text-brown mt-1">Historial completo de tus compras</p>
      </div>

      {error && (
        <div className="p-4 bg-card border-l-4 border-leather text-coffee text-sm rounded shadow-sm">
          {error}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border-paper p-12 text-center shadow-sm space-y-4">
          <p className="font-serif text-xl text-coffee">No tienes pedidos registrados.</p>
          <p className="text-sm text-brown">Tus compras y órdenes aparecerán listadas aquí.</p>
          <div>
            <Link
              href="/"
              className="inline-block px-6 py-2.5 bg-leather text-paper text-xs font-semibold rounded-lg hover:bg-leather-hover transition-colors shadow-sm"
            >
              Explorar Catálogo
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order._id}
              className="bg-card p-6 rounded-2xl border border-border-paper shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition-shadow"
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-3">
                  <span className="font-serif font-bold text-coffee text-base">
                    Pedido #{order._id.slice(-6).toUpperCase()}
                  </span>
                  {getStatusBadge(order.status)}
                </div>
                <p className="text-xs text-brown">
                  Fecha: {new Date(order.createdAt).toLocaleDateString('es-CO', { dateStyle: 'medium' })}
                </p>
                <p className="text-xs text-brown">
                  {order.items?.length || 0} {(order.items?.length === 1) ? 'título' : 'títulos'}:{' '}
                  <span className="italic text-coffee">
                    {order.items?.map((i) => i.titleSnapshot).join(', ')}
                  </span>
                </p>
              </div>

              <div className="flex items-center space-x-6 w-full md:w-auto justify-between md:justify-end pt-3 md:pt-0 border-t md:border-t-0 border-border-paper">
                <div>
                  <span className="text-[10px] uppercase text-brown block">Total</span>
                  <span className="font-serif text-xl font-bold text-coffee font-sans">
                    ${order.total?.toFixed(2)} {order.currency}
                  </span>
                </div>

                <Link
                  href={`/pedidos/${order._id}`}
                  className="px-4 py-2 bg-paper border border-border-paper text-coffee hover:border-leather text-xs font-semibold rounded-lg transition-colors"
                >
                  Ver Detalle →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
