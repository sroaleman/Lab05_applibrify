'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Formulario de creación / edición
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch('/api/categories');
      setCategories(data || []);
    } catch (err) {
      setError(err.message || 'Error al cargar categorías');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleEditClick = (c) => {
    setEditingId(c._id);
    setName(c.name);
    setSlug(c.slug);
    setError(null);
    setSuccess(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName('');
    setSlug('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload = {
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
    };

    try {
      if (editingId) {
        await apiFetch(`/api/categories/${editingId}`, {
          method: 'PATCH',
          body: payload,
        });
        setSuccess('Categoría actualizada exitosamente');
      } else {
        await apiFetch('/api/categories', {
          method: 'POST',
          body: payload,
        });
        setSuccess('Categoría creada exitosamente');
      }
      handleCancelEdit();
      loadCategories();
    } catch (err) {
      setError(err.message || 'Error al guardar la categoría');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Deseas eliminar esta categoría?')) return;
    setError(null);
    setSuccess(null);
    try {
      await apiFetch(`/api/categories/${id}`, { method: 'DELETE' });
      setSuccess('Categoría eliminada');
      loadCategories();
    } catch (err) {
      // 409: "La categoría tiene libros"
      setError(err.message || 'No se pudo eliminar la categoría');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold text-coffee">Gestión de Categorías</h1>
        <p className="text-xs text-brown mt-1">Crea y clasifica los géneros y colecciones de Librify</p>
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
        {/* Formulario */}
        <div className="md:col-span-5 bg-card p-6 rounded-2xl border border-border-paper shadow-sm space-y-4">
          <h2 className="font-serif font-bold text-lg text-coffee pb-2 border-b border-border-paper">
            {editingId ? 'Editar Categoría' : 'Nueva Categoría'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-brown mb-1">
                Nombre *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!editingId) {
                    setSlug(
                      e.target.value
                        .toLowerCase()
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '')
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/(^-|-$)+/g, '')
                    );
                  }
                }}
                placeholder="Ficción, Historia..."
                className="w-full px-3 py-2 bg-paper border border-border-paper rounded-lg text-xs text-coffee focus:outline-none focus:ring-2 focus:ring-leather"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-brown mb-1">
                Slug (identificador web, kebab-case) *
              </label>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="ficcion-historica"
                className="w-full px-3 py-2 bg-paper border border-border-paper rounded-lg text-xs text-coffee focus:outline-none focus:ring-2 focus:ring-leather font-mono"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-4 py-2 border border-border-paper text-coffee text-xs font-semibold rounded-lg hover:border-leather"
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-leather hover:bg-leather-hover text-paper text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50"
              >
                {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </form>
        </div>

        {/* Listado */}
        <div className="md:col-span-7 bg-card rounded-2xl border border-border-paper shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border-paper bg-paper">
            <h2 className="font-serif font-bold text-base text-coffee">Categorías Registradas</h2>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-leather border-t-transparent"></div>
            </div>
          ) : (
            <div className="divide-y divide-border-paper">
              {categories.map((c) => (
                <div key={c._id} className="p-4 flex items-center justify-between hover:bg-paper/30">
                  <div>
                    <span className="font-serif font-bold text-coffee text-sm block">{c.name}</span>
                    <span className="text-xs text-brown font-mono">slug: {c.slug}</span>
                  </div>

                  <div className="space-x-2">
                    <button
                      onClick={() => handleEditClick(c)}
                      className="px-2.5 py-1 bg-paper border border-border-paper hover:border-leather text-xs font-semibold rounded"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(c._id)}
                      className="px-2.5 py-1 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 text-xs font-semibold rounded"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
