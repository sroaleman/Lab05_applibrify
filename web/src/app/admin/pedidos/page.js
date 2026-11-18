'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [endpointNotice, setEndpointNotice] = useState(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    setEndpointNotice(null);

    try {
      // Intento de llamar a GET /api/orders
      const data = await apiFetch('/api/orders');
      setOrders(Array.isArray(data) ? data : data.orders || []);
    } catch (err) {
      if (err.status === 404 || err.status === 405) {
        setEndpointNotice(
          'El endpoint general administrativo "GET /api/orders" aún no está implementado en la API del backend. Mostrando únicamente la ordenación disponible.'
        );
      } else {
        setError(err.message || 'Error al consultar órdenes');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-coffee">Órdenes y Pedidos (Admin)</h1>
        <p className="text-xs text-brown mt-1">Supervisión de transacciones y estados de pago</p>
      </div>

      {endpointNotice && (
        <div className="p-4 bg-amber-50 border-l-4 border-amber-600 text-amber-900 text-xs rounded shadow-sm">
          <strong>Aviso de API:</strong> {endpointNotice}
        </div>
      )}

      {error && (
        <div className="p-4 bg-card border-l-4 border-leather text-coffee text-sm rounded shadow-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 bg-card rounded-2xl border border-border-paper">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-leather border-t-transparent"></div>
          <p className="mt-3 text-sm text-brown font-serif italic">Cargando registros de pedidos...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border-paper p-12 text-center shadow-sm">
          <p className="font-serif text-lg text-coffee">No hay pedidos disponibles para mostrar.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border-paper shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-coffee">
              <thead className="bg-paper border-b border-border-paper uppercase tracking-wider text-[10px] text-brown font-semibold">
                <tr>
                  <th className="p-4">ID Pedido</th>
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Cliente / Usuario</th>
                  <th className="p-4">Tipo Entrega</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4">Total</th>
                  <th className="p-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-paper">
                {orders.map((o) => {
                  const hasPhysical = o.shippingAddress !== null;
                  return (
                    <tr key={o._id} className="hover:bg-paper/50">
                      <td className="p-4 font-mono font-bold">
                        #{o._id.slice(-6).toUpperCase()}
                      </td>
                      <td className="p-4">
                        {new Date(o.createdAt).toLocaleDateString('es-CO')}
                      </td>
                      <td className="p-4">
                        {o.shippingAddress?.recipient || o.userId?.name || o.userId?.email || 'Cliente'}
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            hasPhysical
                              ? 'bg-badge-physical-bg text-badge-physical-text'
                              : 'bg-badge-digital-bg text-badge-digital-text'
                          }`}
                        >
                          {hasPhysical ? 'Física' : 'Digital'}
                        </span>
                      </td>
                      <td className="p-4 font-semibold">{o.status}</td>
                      <td className="p-4 font-bold font-sans">
                        ${o.total?.toFixed(2)} {o.currency}
                      </td>
                      <td className="p-4 text-right">
                        <Link
                          href={`/pedidos/${o._id}`}
                          className="px-2.5 py-1 bg-paper border border-border-paper hover:border-leather text-[11px] font-semibold rounded inline-block"
                        >
                          Ver
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
