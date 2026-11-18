'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

export default function PagoRetornoClient() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const token = searchParams.get('token');

  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'cancelled' | 'error'
  const [captureData, setCaptureData] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Protección estricta contra doble llamada / doble clic
  const capturedRef = useRef(false);

  useEffect(() => {
    // Si no hay token de PayPal o el usuario canceló
    if (!token) {
      setStatus('cancelled');
      return;
    }

    if (!orderId) {
      setStatus('error');
      setErrorMessage('Identificador de pedido faltante en el retorno de PayPal.');
      return;
    }

    if (capturedRef.current) return;
    capturedRef.current = true;

    async function processCapture() {
      try {
        const result = await apiFetch('/api/payments/paypal/capture', {
          method: 'POST',
          body: {
            orderId,
            providerOrderId: token,
          },
        });
        setCaptureData(result);
        setStatus('success');
      } catch (err) {
        setStatus('error');
        setErrorMessage(err.message || 'No se pudo capturar el pago con PayPal.');
      }
    }

    processCapture();
  }, [orderId, token]);

  if (status === 'loading') {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-leather border-t-transparent"></div>
        <h1 className="font-serif text-2xl font-bold text-coffee">Confirmando pago con PayPal...</h1>
        <p className="text-sm text-brown font-serif italic">
          Por favor no cierres ni recargues esta ventana mientras verificamos la transacción.
        </p>
      </div>
    );
  }

  if (status === 'cancelled') {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <div className="bg-card p-8 rounded-2xl border border-border-paper shadow-md text-center space-y-4">
          <div className="w-12 h-12 bg-paper text-brown border border-border-paper rounded-full flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <h1 className="font-serif text-2xl font-bold text-coffee">Pago cancelado</h1>
          <p className="text-sm text-brown">
            Pago cancelado; tu pedido sigue pendiente en tu cuenta.
          </p>
          <div className="pt-4 flex justify-center space-x-4">
            <Link
              href="/carrito"
              className="px-5 py-2.5 bg-paper border border-border-paper text-coffee text-xs font-semibold rounded-lg hover:border-leather transition-colors"
            >
              Volver al Carrito
            </Link>
            <Link
              href="/pedidos"
              className="px-5 py-2.5 bg-leather text-paper text-xs font-semibold rounded-lg hover:bg-leather-hover transition-colors"
            >
              Ver mis Pedidos
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <div className="bg-card p-8 rounded-2xl border border-border-paper shadow-md text-center space-y-4">
          <div className="w-12 h-12 bg-red-50 text-red-700 border border-red-200 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
            ✕
          </div>
          <h1 className="font-serif text-2xl font-bold text-coffee">Error en la confirmación</h1>
          <p className="text-sm text-red-700">{errorMessage}</p>
          <div className="pt-4 flex justify-center space-x-4">
            <Link
              href="/carrito"
              className="px-5 py-2.5 bg-paper border border-border-paper text-coffee text-xs font-semibold rounded-lg hover:border-leather transition-colors"
            >
              Revisar Carrito
            </Link>
            <Link
              href="/pedidos"
              className="px-5 py-2.5 bg-leather text-paper text-xs font-semibold rounded-lg hover:bg-leather-hover transition-colors"
            >
              Ir a Mis Pedidos
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-16">
      <div className="bg-card p-8 rounded-2xl border border-border-paper shadow-md text-center space-y-5">
        <div className="w-14 h-14 bg-[#EAF2E8] text-[#3E5B3A] border border-[#3E5B3A]/30 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
          ✓
        </div>

        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-bold text-coffee">¡Pago Confirmado!</h1>
          <p className="text-sm text-brown font-serif italic">Tu transacción se completó con éxito.</p>
        </div>

        <div className="p-4 bg-paper rounded-xl border border-border-paper text-xs text-coffee text-left space-y-2">
          <div className="flex justify-between">
            <span className="text-brown">ID de Captura PayPal:</span>
            <strong className="font-mono">{captureData?.captureId || 'Verificado'}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-brown">Estado de Orden:</span>
            <span className="font-semibold text-[#3E5B3A]">PAGADO</span>
          </div>
        </div>

        <p className="text-xs text-brown">
          Si adquiriste libros digitales, ya se encuentran disponibles en tu biblioteca personal para su descarga.
        </p>

        <div className="pt-4 flex justify-center space-x-4">
          <Link
            href="/biblioteca"
            className="px-5 py-2.5 bg-leather text-paper text-xs font-semibold rounded-lg hover:bg-leather-hover transition-colors shadow-sm"
          >
            Ir a Mi Biblioteca
          </Link>
          <Link
            href="/pedidos"
            className="px-5 py-2.5 bg-paper border border-border-paper text-coffee text-xs font-semibold rounded-lg hover:border-leather transition-colors"
          >
            Ver Detalle del Pedido
          </Link>
        </div>
      </div>
    </div>
  );
}
