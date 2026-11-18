import { Suspense } from 'react';
import PagoRetornoClient from './PagoRetornoClient';

export default function PagoRetornoPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-leather border-t-transparent"></div>
          <p className="mt-3 text-sm text-brown font-serif italic">Cargando datos del pago...</p>
        </div>
      }
    >
      <PagoRetornoClient />
    </Suspense>
  );
}
