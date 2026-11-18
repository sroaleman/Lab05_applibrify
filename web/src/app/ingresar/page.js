'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();
  const { checkUser } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await apiFetch('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      await checkUser();
      router.push('/');
    } catch (err) {
      setError(err.message || 'Correo o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="bg-card p-8 rounded-2xl border border-border-paper shadow-md">
        <div className="text-center mb-6">
          <span className="font-serif text-3xl font-bold text-coffee block">Librify</span>
          <h1 className="font-serif text-xl text-brown mt-1">Iniciar Sesión</h1>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-paper border-l-4 border-leather text-coffee text-sm rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-brown mb-1.5">
              Correo electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="lector@librify.com"
              className="w-full px-3.5 py-2.5 bg-paper border border-border-paper rounded-lg text-sm text-coffee placeholder-brown/50 focus:outline-none focus:ring-2 focus:ring-leather focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-brown mb-1.5">
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 bg-paper border border-border-paper rounded-lg text-sm text-coffee placeholder-brown/50 focus:outline-none focus:ring-2 focus:ring-leather focus:border-transparent transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-leather text-paper font-medium rounded-lg hover:bg-leather-hover disabled:opacity-50 transition-colors text-sm shadow-sm flex items-center justify-center pt-3"
          >
            {loading ? (
              <>
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-paper border-t-transparent mr-2"></div>
                <span>Ingresando...</span>
              </>
            ) : (
              <span>Entrar</span>
            )}
          </button>
        </form>

        <div className="mt-8 pt-4 border-t border-border-paper text-center">
          <p className="text-sm text-brown">
            ¿Aún no tienes cuenta?{' '}
            <Link href="/registro" className="font-medium text-leather hover:text-leather-hover underline">
              Regístrate aquí
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
