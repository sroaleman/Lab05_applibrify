const crypto = require('crypto');
const Shipment = require('../models/Shipment');
const Order = require('../models/Order');
const LibraryEntry = require('../models/LibraryEntry');

// Transiciones lineales permitidas
const VALID_TRANSITIONS = {
  PREPARING: ['SHIPPED', 'INCIDENT'],
  SHIPPED: ['IN_TRANSIT', 'INCIDENT'],
  IN_TRANSIT: ['DELIVERED', 'INCIDENT'],
  INCIDENT: ['PREPARING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED'],
  DELIVERED: [], // Estado terminal
};

/**
 * Crea un envío para un pedido en estado PAID con al menos un ítem físico.
 */
async function createShipmentForOrder(orderId, initialData = {}) {
  const order = await Order.findById(orderId);
  if (!order) {
    const err = new Error('Pedido no encontrado');
    err.status = 404;
    throw err;
  }

  if (order.status !== 'PAID') {
    const err = new Error('El pedido no está pagado');
    err.status = 409;
    throw err;
  }

  const hasPhysical = order.items.some((item) => item.productType === 'PHYSICAL');
  if (!hasPhysical) {
    const err = new Error('El pedido no tiene libros físicos');
    err.status = 400;
    throw err;
  }

  const existingShipment = await Shipment.findOne({ orderId: order._id });
  if (existingShipment) {
    const err = new Error('El pedido ya cuenta con un envío registrado');
    err.status = 409;
    throw err;
  }

  const carrier = initialData.carrier || 'Coordinadora';
  const trackingNumber =
    initialData.trackingNumber || `TRK-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

  const initialEvent = {
    status: 'PREPARING',
    note: initialData.note || 'Envío creado y en preparación de paquete',
    at: new Date(),
  };

  const shipment = await Shipment.create({
    orderId: order._id,
    carrier,
    trackingNumber,
    status: 'PREPARING',
    events: [initialEvent],
  });

  return shipment;
}

/**
 * Actualiza el estado o datos de seguimiento de un envío con validación de transiciones.
 */
async function updateShipment(shipmentId, updateData) {
  const shipment = await Shipment.findById(shipmentId);
  if (!shipment) {
    const err = new Error('Envío no encontrado');
    err.status = 404;
    throw err;
  }

  // Si se actualiza el trackingNumber, validar unicidad
  if (updateData.trackingNumber && updateData.trackingNumber !== shipment.trackingNumber) {
    const duplicate = await Shipment.findOne({
      trackingNumber: updateData.trackingNumber,
      _id: { $ne: shipment._id },
    });
    if (duplicate) {
      const err = new Error('El número de guía ya está en uso en otro envío');
      err.status = 409;
      throw err;
    }
    shipment.trackingNumber = updateData.trackingNumber;
  }

  if (updateData.carrier) {
    shipment.carrier = updateData.carrier;
  }

  if (updateData.status && updateData.status !== shipment.status) {
    const allowed = VALID_TRANSITIONS[shipment.status] || [];
    if (!allowed.includes(updateData.status)) {
      const err = new Error(
        `Transición de estado no permitida de ${shipment.status} a ${updateData.status}`
      );
      err.status = 400;
      throw err;
    }

    shipment.status = updateData.status;

    shipment.events.push({
      status: updateData.status,
      note: updateData.note || '',
      at: new Date(),
    });

    // Si pasa a DELIVERED, verificar si se completa la orden
    if (updateData.status === 'DELIVERED') {
      const order = await Order.findById(shipment.orderId);
      if (order) {
        const digitalItems = order.items.filter((i) => i.productType === 'DIGITAL');

        let allDigitalGranted = true;
        if (digitalItems.length > 0) {
          const grantedEntries = await LibraryEntry.find({
            userId: order.userId,
            orderId: order._id,
          });
          allDigitalGranted = grantedEntries.length >= digitalItems.length;
        }

        if (allDigitalGranted) {
          order.status = 'COMPLETED';
          await order.save();
        }
      }
    }
  } else if (updateData.note) {
    // Si solo añade nota sin cambio de estado
    shipment.events.push({
      status: shipment.status,
      note: updateData.note,
      at: new Date(),
    });
  }

  await shipment.save();
  return shipment;
}

module.exports = {
  createShipmentForOrder,
  updateShipment,
};
