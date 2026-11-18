'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

const VALID_TRANSITIONS = {
  PREPARING: ['SHIPPED', 'INCIDENT'],
  SHIPPED: ['IN_TRANSIT', 'INCIDENT'],
  IN_TRANSIT: ['DELIVERED', 'INCIDENT'],
  INCIDENT: ['PREPARING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED'],
  DELIVERED: [],
};

const STATUS_LABELS = {
  PREPARING: 'En preparación',
  SHIPPED: 'Enviado',
  IN_TRANSIT: 'En tránsito',
  DELIVERED: 'Entregado',
  INCIDENT: 'Incidencia',
};

const STATUS_COLORS = {
  PREPARING: 'bg-amber-100 text-amber-900 border-amber-300',
  SHIPPED: 'bg-blue-100 text-blue-900 border-blue-300',
  IN_TRANSIT: 'bg-indigo-100 text-indigo-900 border-indigo-300',
  DELIVERED: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  INCIDENT: 'bg-red-100 text-red-900 border-red-300',
};

export default function AdminShipmentsPage() {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal para crear envío
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [orderIdInput, setOrderIdInput] = useState('');
  const [carrierInput, setCarrierInput] = useState('Coordinadora');
  const [trackingInput, setTrackingInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Modal para actualizar envío
  const [editingShipment, setEditingShipment] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [updateCarrier, setUpdateCarrier] = useState('');
  const [updateTracking, setUpdateTracking] = useState('');
  const [updateNote, setUpdateNote] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState(null);

  const loadShipments = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch('/api/shipments');
      setShipments(data || []);
    } catch (err) {
      setError(err.message || 'Error al cargar envíos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShipments();
  }, []);

  const handleCreateShipment = async (e) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      const body = {
        orderId: orderIdInput.trim(),
      };
      if (carrierInput.trim()) body.carrier = carrierInput.trim();
      if (trackingInput.trim()) body.trackingNumber = trackingInput.trim();

      await apiFetch('/api/shipments', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      setShowCreateModal(false);
      setOrderIdInput('');
      setTrackingInput('');
      await loadShipments();
    } catch (err) {
      setCreateError(err.message || 'Error al registrar envío');
    } finally {
      setCreating(false);
    }
  };

  const openUpdateModal = (shipment) => {
    setEditingShipment(shipment);
    setNewStatus('');
    setUpdateCarrier(shipment.carrier || '');
    setUpdateTracking(shipment.trackingNumber || '');
    setUpdateNote('');
    setUpdateError(null);
  };

  const handleUpdateShipment = async (e) => {
    e.preventDefault();
    if (!editingShipment) return;

    setUpdating(true);
    setUpdateError(null);

    try {
      const body = {};
      if (newStatus && newStatus !== editingShipment.status) {
        body.status = newStatus;
      }
      if (updateCarrier.trim() && updateCarrier.trim() !== editingShipment.carrier) {
        body.carrier = updateCarrier.trim();
      }
      if (updateTracking.trim() && updateTracking.trim() !== editingShipment.trackingNumber) {
        body.trackingNumber = updateTracking.trim();
      }
      if (updateNote.trim()) {
        body.note = updateNote.trim();
      }

      if (Object.keys(body).length === 0) {
        setUpdateError('No se indicaron cambios para actualizar');
        setUpdating(false);
        return;
      }

      await apiFetch(`/api/shipments/${editingShipment._id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });

      setEditingShipment(null);
      await loadShipments();
    } catch (err) {
      setUpdateError(err.message || 'Error al actualizar envío');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-coffee">Gestión de Envíos</h1>
          <p className="text-secondary text-sm">
            Control de paquetes, empresas de transporte y transiciones de estado de entrega.
          </p>
        </div>
        <button
          onClick={() => {
            setShowCreateModal(true);
            setCreateError(null);
          }}
          className="btn-primary self-start sm:self-auto"
        >
          + Nuevo Envío
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-800 rounded-md border border-red-200 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-secondary">Cargando envíos...</div>
      ) : shipments.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-secondary mb-4">No hay envíos registrados en el sistema.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary inline-block text-sm"
          >
            Registrar primer envío
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {shipments.map((s) => {
            const allowedTransitions = VALID_TRANSITIONS[s.status] || [];
            const isTerminal = allowedTransitions.length === 0;

            return (
              <div key={s._id} className="card space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-secondary">Envío ID:</span>
                    <span className="ml-2 font-mono text-xs font-semibold text-coffee">{s._id}</span>
                    <div className="text-xs text-secondary mt-0.5">
                      Pedido asociado:{' '}
                      <span className="font-mono text-coffee font-medium">{s.orderId}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${
                        STATUS_COLORS[s.status] || 'bg-card text-secondary border-border'
                      }`}
                    >
                      {STATUS_LABELS[s.status] || s.status}
                    </span>
                    <button
                      onClick={() => openUpdateModal(s)}
                      disabled={isTerminal}
                      className={`text-xs px-3 py-1 rounded border transition ${
                        isTerminal
                          ? 'opacity-40 cursor-not-allowed bg-cream border-border text-secondary'
                          : 'border-leather text-leather hover:bg-leather hover:text-white'
                      }`}
                    >
                      {isTerminal ? 'Completado' : 'Gestionar / Actualizar'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-secondary block">Transportadora</span>
                    <span className="font-medium text-coffee">{s.carrier || 'No asignada'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-secondary block">Número de Guía</span>
                    <span className="font-mono font-medium text-coffee">
                      {s.trackingNumber || 'Sin guía'}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-secondary block">Fecha de Creación</span>
                    <span className="text-secondary">
                      {s.createdAt ? new Date(s.createdAt).toLocaleString() : '—'}
                    </span>
                  </div>
                </div>

                {s.events && s.events.length > 0 && (
                  <div className="pt-2 border-t border-border">
                    <span className="text-xs font-semibold text-secondary block mb-2">
                      Historial de Eventos ({s.events.length})
                    </span>
                    <div className="space-y-1.5 pl-2 border-l-2 border-leather/30 text-xs">
                      {s.events.map((evt, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between text-secondary">
                          <span>
                            <strong className="text-coffee">
                              {STATUS_LABELS[evt.status] || evt.status}
                            </strong>
                            {evt.note && <span className="ml-2 italic text-coffee/80">— {evt.note}</span>}
                          </span>
                          <span className="text-[11px] text-secondary/80">
                            {evt.at ? new Date(evt.at).toLocaleString() : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Crear Envío */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-lg border border-border p-6 max-w-md w-full shadow-xl">
            <h2 className="font-serif text-xl font-bold text-coffee mb-2">Registrar Nuevo Envío</h2>
            <p className="text-xs text-secondary mb-4">
              El pedido debe estar en estado <strong className="text-coffee">PAID</strong> y contener libros físicos.
            </p>

            {createError && (
              <div className="mb-4 p-3 bg-red-50 text-red-800 text-xs rounded border border-red-200">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateShipment} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">
                  ID del Pedido (ObjectId 24 hex) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. 673c..."
                  value={orderIdInput}
                  onChange={(e) => setOrderIdInput(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-border bg-cream font-mono text-xs focus:outline-none focus:border-leather"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-secondary mb-1">
                  Transportadora
                </label>
                <input
                  type="text"
                  placeholder="Coordinadora, Servientrega, DHL..."
                  value={carrierInput}
                  onChange={(e) => setCarrierInput(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-border bg-cream focus:outline-none focus:border-leather"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-secondary mb-1">
                  Número de Guía (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Se generará automáticamente si se deja vacío"
                  value={trackingInput}
                  onChange={(e) => setTrackingInput(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-border bg-cream font-mono text-xs focus:outline-none focus:border-leather"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                  className="btn-secondary text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-primary text-sm"
                >
                  {creating ? 'Registrando...' : 'Crear Envío'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Actualizar Envío */}
      {editingShipment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-lg border border-border p-6 max-w-lg w-full shadow-xl">
            <h2 className="font-serif text-xl font-bold text-coffee mb-1">
              Actualizar Envío
            </h2>
            <div className="text-xs text-secondary mb-4">
              Guía actual:{' '}
              <span className="font-mono text-coffee font-semibold">
                {editingShipment.trackingNumber}
              </span>{' '}
              | Estado actual:{' '}
              <span className="font-semibold text-coffee">
                {STATUS_LABELS[editingShipment.status] || editingShipment.status}
              </span>
            </div>

            {updateError && (
              <div className="mb-4 p-3 bg-red-50 text-red-800 text-xs rounded border border-red-200">
                {updateError}
              </div>
            )}

            <form onSubmit={handleUpdateShipment} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-secondary mb-2">
                  Transición de Estado
                </label>
                {(() => {
                  const allowed = VALID_TRANSITIONS[editingShipment.status] || [];
                  if (allowed.length === 0) {
                    return (
                      <p className="text-xs text-secondary italic">
                        El envío está en estado final (DELIVERED) y no permite más transiciones.
                      </p>
                    );
                  }
                  return (
                    <div className="grid grid-cols-2 gap-2">
                      {['PREPARING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'INCIDENT'].map((st) => {
                        const isCurrent = editingShipment.status === st;
                        const isAllowed = allowed.includes(st);
                        const isSelected = newStatus === st;

                        return (
                          <button
                            type="button"
                            key={st}
                            disabled={!isAllowed}
                            onClick={() => setNewStatus(isSelected ? '' : st)}
                            className={`px-3 py-2 rounded text-xs text-left border transition font-medium flex items-center justify-between ${
                              isCurrent
                                ? 'border-dashed border-secondary bg-cream text-secondary opacity-60 cursor-default'
                                : isSelected
                                ? 'border-leather bg-leather text-white shadow'
                                : isAllowed
                                ? 'border-border bg-cream hover:border-leather text-coffee'
                                : 'opacity-30 border-border bg-cream/50 text-secondary cursor-not-allowed'
                            }`}
                          >
                            <span>{STATUS_LABELS[st] || st}</span>
                            {isCurrent && <span className="text-[10px] uppercase">(Actual)</span>}
                            {isSelected && <span className="text-[10px]">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-secondary mb-1">
                    Transportadora
                  </label>
                  <input
                    type="text"
                    value={updateCarrier}
                    onChange={(e) => setUpdateCarrier(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-border bg-cream text-xs focus:outline-none focus:border-leather"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-secondary mb-1">
                    Número de Guía
                  </label>
                  <input
                    type="text"
                    value={updateTracking}
                    onChange={(e) => setUpdateTracking(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-border bg-cream font-mono text-xs focus:outline-none focus:border-leather"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-secondary mb-1">
                  Nota del Evento (opcional)
                </label>
                <textarea
                  rows={2}
                  value={updateNote}
                  onChange={(e) => setUpdateNote(e.target.value)}
                  placeholder="Detalles sobre el cambio de estado o incidente..."
                  className="w-full px-3 py-2 rounded border border-border bg-cream text-xs focus:outline-none focus:border-leather"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditingShipment(null)}
                  disabled={updating}
                  className="btn-secondary text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="btn-primary text-sm"
                >
                  {updating ? 'Guardando...' : 'Aplicar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
