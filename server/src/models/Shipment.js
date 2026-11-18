const mongoose = require('mongoose');

const shipmentEventSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
      enum: ['PREPARING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'INCIDENT'],
    },
    note: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
    at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const shipmentSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true,
      index: true,
    },
    carrier: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 60,
      default: 'PENDING',
    },
    trackingNumber: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 60,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['PREPARING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'INCIDENT'],
      default: 'PREPARING',
    },
    events: {
      type: [shipmentEventSchema],
      default: [],
    },
  },
  { timestamps: true }
);

shipmentSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Shipment', shipmentSchema);
