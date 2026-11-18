'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function CartPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [cart, setCart] = useState({ items: [], total: 0 });
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  // Redirigir a /ingresar si no hay sesión
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/ingresar');
    }
  }, [user, authLoading, router]);

  const loadCartAndAddresses = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const cartData = await apiFetch('/api/cart');
      setCart(cartData || { items: [], total: 0 });

      const hasPhysical = (cartData.items || []).some((i) => i.productType === 'PHYSICAL');
      if (hasPhysical) {
        const addrData = await apiFetch('/api/addresses');
        setAddresses(addrData || []);
        const defaultAddr = (addrData || []).find((a) => a.isDefault);
        if (defaultAddr) {
          setSelectedAddressId(defaultAddr._id);
        } else if (addrData && addrData.length > 0) {
          setSelectedAddressId(addrData[0]._id);
        }
      }
    } catch (err) {
      setError(err.message || 'Error al cargar el carrito');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadCartAndAddresses();
    }
  }, [user, loadCartAndAddresses]);

  const handleUpdateQty = async (bookId, currentQty, delta) => {
    const newQty = currentQty + delta;
    if (newQty < 0) return;
    setError(null);
    try {
      const updated = await apiFetch(`/api/cart/items/${bookId}`, {
        method: 'PUT',
        body: { qty: newQty },
      });
      setCart(updated);
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la cantidad');
    }
  };

  const handleRemove = async (bookId) => {
    setError(null);
    try {
      const updated = await apiFetch(`/api/cart/items/${bookId}`, {
        method: 'DELETE',
      });
      setCart(updated);
    } catch (err) {
      setError(err.message || 'No se pudo quitar el producto');
    }
  };

  const handleCheckout = async () => {
    const hasPhysical = cart.items.some((i) => i.productType === 'PHYSICAL');
    if (hasPhysical && !selectedAddressId) {
      setError('Por favor selecciona o añade una dirección de envío');
      return;
    }

    setProcessing(true);
    setError(null);
    try {
      // a) Crear el pedido en el backend
      const orderPayload = hasPhysical ? { addressId: selectedAddressId } : {};
      const order = await apiFetch('/api/orders', {
        method: 'POST',
        body: orderPayload,
      });

      // b) Iniciar orden en PayPal
      const paymentOrder = await apiFetch('/api/payments/paypal/order', {
        method: 'POST',
        body: { orderId: order._id },
      });

      // c) Redirigir a PayPal Sandbox
      const approvalBase =
        process.env.NEXT_PUBLIC_PAYPAL_APPROVAL_BASE ||
        'https://www.sandbox.paypal.com/checkoutnow';
      window.location.href = `${approvalBase}?token=${encodeURIComponent(
        paymentOrder.providerOrderId
      )}`;
    } catch (err) {
      setError(err.message || 'Error al procesar el pago con PayPal');
      setProcessing(false);
    }
  };

  if (authLoading || (loading && !cart.items.length)) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-leather border-t-transparent"></div>
        <p className="mt-3 text-sm text-brown font-serif italic">Cargando carrito de compras...</p>
      </div>
    );
  }

  const hasPhysical = cart.items.some((i) => i.productType === 'PHYSICAL');

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold text-coffee">Mi Carrito de Compras</h1>
        <p className="text-sm text-brown mt-1">Revisa tus artículos antes de proceder al pago</p>
      </div>

      {error && (
        <div className="p-4 bg-card border-l-4 border-leather text-coffee text-sm rounded shadow-sm">
          {error}
        </div>
      )}

      {cart.items.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border-paper p-12 text-center shadow-sm space-y-4">
          <svg
            className="w-16 h-16 text-brown/40 mx-auto"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
            />
          </svg>
          <p className="font-serif text-xl text-coffee">Tu carrito está actualmente vacío.</p>
          <p className="text-sm text-brown">Explora nuestras obras y colecciones disponibles.</p>
          <div>
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-leather hover:bg-leather-hover text-paper text-sm font-medium rounded-lg transition-colors shadow-sm"
            >
              Ir al Catálogo de Libros
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Lista de productos */}
          <div className="lg:col-span-8 bg-card rounded-2xl border border-border-paper shadow-sm overflow-hidden divide-y divide-border-paper">
            {cart.items.map((item) => {
              const isDigital = item.productType === 'DIGITAL';
              return (
                <div key={item.bookId} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          isDigital
                            ? 'bg-badge-digital-bg text-badge-digital-text'
                            : 'bg-badge-physical-bg text-badge-physical-text'
                        }`}
                      >
                        {isDigital ? 'Digital' : 'Físico'}
                      </span>
                    </div>
                    <Link
                      href={`/libros/${item.bookId}`}
                      className="font-serif font-bold text-coffee text-base hover:text-leather transition-colors block"
                    >
                      {item.title}
                    </Link>
                    <p className="text-xs text-brown">
                      Precio unitario: ${item.price?.toFixed(2)} {item.currency}
                    </p>
                  </div>

                  <div className="flex items-center space-x-6 justify-between sm:justify-end">
                    {/* Controles de cantidad */}
                    <div className="flex items-center border border-border-paper rounded-lg bg-paper">
                      <button
                        onClick={() => handleUpdateQty(item.bookId, item.qty, -1)}
                        className="px-2.5 py-1 text-coffee hover:text-leather text-base font-bold disabled:opacity-40"
                        title="Disminuir"
                      >
                        −
                      </button>
                      <span className="px-3 py-1 text-sm font-semibold text-coffee font-sans">
                        {item.qty}
                      </span>
                      <button
                        onClick={() => handleUpdateQty(item.bookId, item.qty, 1)}
                        className="px-2.5 py-1 text-coffee hover:text-leather text-base font-bold"
                        title="Aumentar"
                      >
                        +
                      </button>
                    </div>

                    <div className="text-right min-w-[80px]">
                      <span className="text-sm font-bold text-coffee block font-sans">
                        ${item.subtotal?.toFixed(2)}
                      </span>
                      <button
                        onClick={() => handleRemove(item.bookId)}
                        className="text-xs text-leather hover:text-leather-hover underline"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Resumen y Dirección */}
          <div className="lg:col-span-4 space-y-6">
            {/* Si hay productos físicos, elegir dirección de envío */}
            {hasPhysical && (
              <div className="bg-card rounded-2xl border border-border-paper p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-serif font-bold text-base text-coffee">Dirección de Envío</h2>
                  <Link
                    href="/direcciones"
                    className="text-xs text-leather hover:text-leather-hover underline font-medium"
                  >
                    Gestionar
                  </Link>
                </div>

                {addresses.length === 0 ? (
                  <div className="p-3 bg-paper border border-border-paper rounded-lg text-xs text-brown space-y-2">
                    <p>No tienes direcciones registradas para el envío físico.</p>
                    <Link
                      href="/direcciones"
                      className="inline-block font-semibold text-leather hover:text-leather-hover underline"
                    >
                      + Agregar una dirección
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <select
                      value={selectedAddressId}
                      onChange={(e) => setSelectedAddressId(e.target.value)}
                      className="w-full px-3 py-2 bg-paper border border-border-paper rounded-lg text-xs text-coffee focus:outline-none focus:ring-2 focus:ring-leather"
                    >
                      {addresses.map((a) => (
                        <option key={a._id} value={a._id}>
                          {a.recipient} - {a.line1}, {a.city} {a.isDefault ? '(Principal)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Resumen de totales del servidor */}
            <div className="bg-card rounded-2xl border border-border-paper p-6 shadow-sm space-y-4">
              <h2 className="font-serif font-bold text-lg text-coffee border-b border-border-paper pb-3">
                Resumen del Pedido
              </h2>

              <div className="flex justify-between items-center text-sm text-brown">
                <span>Artículos</span>
                <span>{cart.items.reduce((acc, i) => acc + i.qty, 0)} unidades</span>
              </div>

              <div className="pt-3 border-t border-border-paper flex justify-between items-baseline">
                <span className="font-serif font-bold text-lg text-coffee">Total</span>
                <span className="font-serif text-2xl font-extrabold text-coffee font-sans">
                  ${cart.total?.toFixed(2)}
                </span>
              </div>

              <p className="text-[11px] text-brown font-serif italic text-center">
                Total calculado directamente por el servidor.
              </p>

              <button
                onClick={handleCheckout}
                disabled={processing || (hasPhysical && !selectedAddressId)}
                className="w-full py-3.5 px-4 bg-leather hover:bg-leather-hover text-paper font-medium text-sm rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {processing ? (
                  <>
                    <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-paper border-t-transparent mr-2"></div>
                    <span>Conectando con PayPal...</span>
                  </>
                ) : (
                  <span>Pagar con PayPal</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
