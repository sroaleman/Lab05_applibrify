'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function AddressesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Formulario
  const [formData, setFormData] = useState({
    recipient: '',
    line1: '',
    line2: '',
    city: '',
    region: '',
    postalCode: '',
    country: 'Colombia',
    phone: '',
    label: '',
    isDefault: false,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/ingresar');
    }
  }, [user, authLoading, router]);

  const loadAddresses = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch('/api/addresses');
      setAddresses(data || []);
    } catch (err) {
      setError(err.message || 'Error al cargar direcciones');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadAddresses();
    }
  }, [user, loadAddresses]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch('/api/addresses', {
        method: 'POST',
        body: formData,
      });
      setSuccess('Dirección guardada exitosamente');
      setFormData({
        recipient: '',
        line1: '',
        line2: '',
        city: '',
        region: '',
        postalCode: '',
        country: 'Colombia',
        phone: '',
        label: '',
        isDefault: false,
      });
      loadAddresses();
    } catch (err) {
      setError(err.message || 'No se pudo guardar la dirección');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Deseas eliminar esta dirección?')) return;
    try {
      await apiFetch(`/api/addresses/${id}`, { method: 'DELETE' });
      loadAddresses();
    } catch (err) {
      setError(err.message || 'Error al eliminar la dirección');
    }
  };

  if (authLoading || (loading && !addresses.length)) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-leather border-t-transparent"></div>
        <p className="mt-3 text-sm text-brown font-serif italic">Cargando libreta de direcciones...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-coffee">Mis Direcciones</h1>
          <p className="text-sm text-brown mt-1">Direcciones para envío de libros físicos</p>
        </div>
        <Link
          href="/carrito"
          className="text-xs font-medium text-leather hover:text-leather-hover underline"
        >
          ← Volver al carrito
        </Link>
      </div>

      {error && (
        <div className="p-4 bg-card border-l-4 border-leather text-coffee text-sm rounded shadow-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-[#EAF2E8] border border-[#3E5B3A]/30 text-[#3E5B3A] text-sm rounded-lg shadow-sm">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Lista de direcciones existentes */}
        <div className="md:col-span-7 space-y-4">
          <h2 className="font-serif font-bold text-xl text-coffee pb-2 border-b border-border-paper">
            Direcciones Registradas
          </h2>

          {addresses.length === 0 ? (
            <div className="p-8 bg-card rounded-xl border border-border-paper text-center">
              <p className="text-sm text-brown font-serif italic">Aún no has registrado direcciones.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {addresses.map((a) => (
                <div
                  key={a._id}
                  className="bg-card p-5 rounded-xl border border-border-paper shadow-sm space-y-2 relative"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-serif font-bold text-coffee text-base">
                      {a.label || a.recipient}
                    </span>
                    {a.isDefault && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider bg-badge-physical-bg text-badge-physical-text px-2 py-0.5 rounded-full border border-badge-physical-text/20">
                        Principal
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-coffee">{a.recipient}</p>
                  <p className="text-xs text-brown">
                    {a.line1} {a.line2 ? `, ${a.line2}` : ''}
                  </p>
                  <p className="text-xs text-brown">
                    {a.city}, {a.region} ({a.postalCode}) — {a.country}
                  </p>
                  <p className="text-xs text-brown">Tel: {a.phone}</p>
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => handleDelete(a._id)}
                      className="text-xs text-leather hover:text-leather-hover underline"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Formulario de nueva dirección */}
        <div className="md:col-span-5 bg-card p-6 rounded-2xl border border-border-paper shadow-sm space-y-4">
          <h2 className="font-serif font-bold text-lg text-coffee pb-2 border-b border-border-paper">
            Nueva Dirección
          </h2>

          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-brown mb-1">
                Etiqueta (opcional)
              </label>
              <input
                type="text"
                name="label"
                value={formData.label}
                onChange={handleChange}
                placeholder="Casa, Oficina..."
                className="w-full px-3 py-2 bg-paper border border-border-paper rounded-lg text-xs text-coffee focus:outline-none focus:ring-2 focus:ring-leather"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-brown mb-1">
                Destinatario *
              </label>
              <input
                type="text"
                required
                name="recipient"
                value={formData.recipient}
                onChange={handleChange}
                placeholder="Nombre completo de quien recibe"
                className="w-full px-3 py-2 bg-paper border border-border-paper rounded-lg text-xs text-coffee focus:outline-none focus:ring-2 focus:ring-leather"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-brown mb-1">
                Dirección Línea 1 *
              </label>
              <input
                type="text"
                required
                name="line1"
                value={formData.line1}
                onChange={handleChange}
                placeholder="Calle, número, conjunto..."
                className="w-full px-3 py-2 bg-paper border border-border-paper rounded-lg text-xs text-coffee focus:outline-none focus:ring-2 focus:ring-leather"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-brown mb-1">
                Dirección Línea 2 (opcional)
              </label>
              <input
                type="text"
                name="line2"
                value={formData.line2}
                onChange={handleChange}
                placeholder="Apto, interior, referencia..."
                className="w-full px-3 py-2 bg-paper border border-border-paper rounded-lg text-xs text-coffee focus:outline-none focus:ring-2 focus:ring-leather"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-brown mb-1">
                  Ciudad *
                </label>
                <input
                  type="text"
                  required
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Bogotá"
                  className="w-full px-3 py-2 bg-paper border border-border-paper rounded-lg text-xs text-coffee focus:outline-none focus:ring-2 focus:ring-leather"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-brown mb-1">
                  Departamento / Región *
                </label>
                <input
                  type="text"
                  required
                  name="region"
                  value={formData.region}
                  onChange={handleChange}
                  placeholder="Cundinamarca"
                  className="w-full px-3 py-2 bg-paper border border-border-paper rounded-lg text-xs text-coffee focus:outline-none focus:ring-2 focus:ring-leather"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-brown mb-1">
                  Código Postal *
                </label>
                <input
                  type="text"
                  required
                  name="postalCode"
                  value={formData.postalCode}
                  onChange={handleChange}
                  placeholder="110111"
                  className="w-full px-3 py-2 bg-paper border border-border-paper rounded-lg text-xs text-coffee focus:outline-none focus:ring-2 focus:ring-leather"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-brown mb-1">
                  País *
                </label>
                <input
                  type="text"
                  required
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  placeholder="Colombia"
                  className="w-full px-3 py-2 bg-paper border border-border-paper rounded-lg text-xs text-coffee focus:outline-none focus:ring-2 focus:ring-leather"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-brown mb-1">
                Teléfono de contacto *
              </label>
              <input
                type="text"
                required
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+57 300 123 4567"
                className="w-full px-3 py-2 bg-paper border border-border-paper rounded-lg text-xs text-coffee focus:outline-none focus:ring-2 focus:ring-leather"
              />
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="isDefault"
                name="isDefault"
                checked={formData.isDefault}
                onChange={handleChange}
                className="rounded border-border-paper text-leather focus:ring-leather"
              />
              <label htmlFor="isDefault" className="text-xs text-coffee cursor-pointer font-medium">
                Establecer como dirección principal
              </label>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="w-full py-2.5 px-4 bg-leather hover:bg-leather-hover text-paper text-xs font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              {creating ? 'Guardando...' : 'Guardar Dirección'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
