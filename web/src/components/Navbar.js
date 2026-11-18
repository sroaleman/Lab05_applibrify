'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useState } from 'react';

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
    router.push('/');
  };

  return (
    <nav className="bg-card border-b border-border-paper sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          {/* Logo editorial con icono de libro */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-3 group">
              <span className="p-2 bg-paper border border-border-paper rounded-md group-hover:border-leather transition-colors">
                <svg
                  className="w-6 h-6 text-leather"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </span>
              <div className="flex flex-col">
                <span className="font-serif text-2xl font-bold tracking-tight text-coffee group-hover:text-leather transition-colors">
                  Librify
                </span>
                <span className="text-[10px] tracking-widest uppercase text-brown -mt-1 font-sans">
                  Librería & Biblioteca
                </span>
              </div>
            </Link>
          </div>

          {/* Navegación */}
          <div className="flex items-center space-x-4 sm:space-x-6">
            <Link
              href="/"
              className="text-brown hover:text-leather text-sm font-medium transition-colors"
            >
              Inicio
            </Link>

            {!loading && (
              <>
                {user ? (
                  <div className="flex items-center space-x-4 sm:space-x-6">
                    <Link
                      href="/carrito"
                      className="text-brown hover:text-leather text-sm font-medium transition-colors flex items-center space-x-1"
                    >
                      <span>Carrito</span>
                    </Link>

                    <Link
                      href="/pedidos"
                      className="text-brown hover:text-leather text-sm font-medium transition-colors"
                    >
                      Pedidos
                    </Link>

                    <Link
                      href="/biblioteca"
                      className="text-brown hover:text-leather text-sm font-medium transition-colors"
                    >
                      Biblioteca
                    </Link>

                    <span className="text-sm text-brown hidden md:inline">
                      Hola, <strong className="text-coffee">{user.name}</strong>
                    </span>

                    <button
                      onClick={handleLogout}
                      disabled={loggingOut}
                      className="text-sm font-medium text-leather-hover hover:text-coffee border border-border-paper hover:border-brown bg-paper px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
                    >
                      {loggingOut ? 'Saliendo...' : 'Salir'}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-3">
                    <Link
                      href="/ingresar"
                      className="text-sm font-medium text-brown hover:text-leather transition-colors px-2 py-1"
                    >
                      Ingresar
                    </Link>
                    <Link
                      href="/registro"
                      className="text-sm font-medium bg-leather text-paper px-4 py-2 rounded-md hover:bg-leather-hover transition-colors shadow-sm"
                    >
                      Registro
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
