'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function AdminGuard({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/ingresar');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-leather border-t-transparent"></div>
        <p className="mt-3 text-sm text-brown font-serif italic">Verificando credenciales de acceso...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Si el usuario es cliente, mostrar Acceso denegado sin redirigir
  if (user.role !== 'administrador') {
    return (
      <div className="max-w-xl mx-auto my-16 px-4">
        <div className="bg-card p-8 rounded-2xl border border-border-paper shadow-md text-center space-y-4">
          <div className="w-12 h-12 bg-red-50 text-red-700 border border-red-200 rounded-full flex items-center justify-center mx-auto text-xl font-bold font-serif">
            !
          </div>
          <h1 className="font-serif text-2xl font-bold text-coffee">Acceso denegado</h1>
          <p className="text-sm text-brown leading-relaxed">
            Esta sección es exclusiva para el personal con rol de <strong>administrador</strong>.
            Tu cuenta actual tiene privilegios de <em>{user.role}</em>.
          </p>
          <div className="pt-4">
            <Link
              href="/"
              className="inline-block px-6 py-2.5 bg-leather text-paper text-xs font-semibold rounded-lg hover:bg-leather-hover transition-colors"
            >
              Volver al Catálogo Principal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
