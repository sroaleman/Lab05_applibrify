'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function OrderDetailPage() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/ingresar');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    async function fetchOrder() {
      if (!user || !id) return;
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch(`/api/orders/${id}`);
        setOrder(data);
      } catch (err) {
        setError(err.message || 'Error al cargar el pedido');
      } finally {
        setLoading(false);
      }
    }
    fetchOrder();
  }, [user, id]);

  if (authLoading || loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-leather border-t-transparent"></div>
        <p className="mt-3 text-sm text-brown font-serif italic">Cargando detalles del pedido...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-card rounded-xl border border-border-paper text-center shadow-sm">
        <h2 className="font-serif text-xl font-bold text-coffee mb-2">Pedido no encontrado</h2>
        <p className="text-brown text-sm mb-6">{error || 'No se encontró la orden solicitada.'}</p>
        <Link
          href="/pedidos"
          className="inline-block px-6 py-2.5 bg-leather text-paper rounded-lg text-sm font-medium hover:bg-leather-hover transition-colors"
        >
          Volver a Mis Pedidos
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/pedidos"
            className="text-xs font-medium text-brown hover:text-leather inline-flex items-center transition-colors mb-2"
          >
            ← Volver a Mis Pedidos
          </Link>
          <h1 className="font-serif text-3xl font-bold text-coffee">
            Pedido #{order._id.slice(-6).toUpperCase()}
          </h1>
          <p className="text-xs text-brown">
            Registrado el {new Date(order.createdAt).toLocaleDateString('es-CO', { dateStyle: 'long' })}
          </p>
        </div>

        <div className="text-right">
          <span className="text-[10px] uppercase tracking-wider text-brown block">Estado</span>
          <span className="font-serif font-bold text-base text-coffee">{order.status}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Lista de ítems */}
        <div className="md:col-span-8 bg-card rounded-2xl border border-border-paper shadow-sm overflow-hidden p-6 space-y-4">
          <h2 className="font-serif font-bold text-lg text-coffee border-b border-border-paper pb-3">
            Obras en el Pedido
          </h2>

          <div className="divide-y divide-border-paper">
            {order.items?.map((item, idx) => (
              <div key={idx} className="py-3 flex justify-between items-center">
                <div className="space-y-0.5">
                  <span className="font-serif font-bold text-coffee text-sm block">
                    {item.titleSnapshot}
                  </span>
                  <div className="flex items-center space-x-2 text-xs text-brown">
                    <span>{item.productType === 'DIGITAL' ? 'Digital' : 'Físico'}</span>
                    <span>•</span>
                    <span>Cantidad: {item.qty}</span>
                    <span>•</span>
                    <span>c/u: ${item.unitPrice?.toFixed(2)}</span>
                  </div>
                </div>

                <span className="font-serif font-bold text-coffee text-sm font-sans">
                  ${item.lineTotal?.toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-border-paper flex justify-between items-baseline">
            <span className="font-serif font-bold text-base text-coffee">Total Pagado</span>
            <span className="font-serif text-2xl font-bold text-coffee font-sans">
              ${order.total?.toFixed(2)} {order.currency}
            </span>
          </div>
        </div>

        {/* Información lateral: Envío o Digital */}
        <div className="md:col-span-4 space-y-6">
          {order.shippingAddress ? (
            <div className="bg-card rounded-2xl border border-border-paper p-6 shadow-sm space-y-3">
              <h2 className="font-serif font-bold text-base text-coffee border-b border-border-paper pb-2">
                Dirección de Envío
              </h2>
              <div className="text-xs text-brown space-y-1">
                <p className="font-semibold text-coffee">{order.shippingAddress.recipient}</p>
                <p>{order.shippingAddress.line1} {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}</p>
                <p>{order.shippingAddress.city}, {order.shippingAddress.region} ({order.shippingAddress.postalCode})</p>
                <p>{order.shippingAddress.country}</p>
                <p>Tel: {order.shippingAddress.phone}</p>
              </div>

              {/* Si cuenta con envío registrado */}
              {order.shipment && (
                <div className="pt-3 border-t border-border-paper space-y-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-brown block">
                    Seguimiento del Envío
                  </span>
                  <div className="p-3 bg-paper rounded-lg border border-border-paper text-xs space-y-1">
                    <p><strong>Transportadora:</strong> {order.shipment.carrier}</p>
                    <p><strong>Guía:</strong> <span className="font-mono">{order.shipment.trackingNumber}</span></p>
                    <p><strong>Estado:</strong> <span className="font-semibold text-leather">{order.shipment.status}</span></p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-card rounded-2xl border border-border-paper p-6 shadow-sm space-y-2">
              <h2 className="font-serif font-bold text-base text-coffee">Entrega Digital</h2>
              <p className="text-xs text-brown">
                Este pedido contiene exclusivamente obras digitales. Puedes acceder y descargar tus archivos en cualquier momento desde tu biblioteca.
              </p>
              <div className="pt-2">
                <Link
                  href="/biblioteca"
                  className="inline-block text-xs font-semibold text-leather hover:text-leather-hover underline"
                >
                  Ir a Mi Biblioteca →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
