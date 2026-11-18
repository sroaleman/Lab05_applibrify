const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      required: true,
      enum: ['PAYPAL'],
      default: 'PAYPAL',
    },
    providerOrderId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    captureId: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['CREATED', 'APPROVED', 'CAPTURED', 'FAILED'],
      default: 'CREATED',
    },
  },
  { timestamps: true }
);

paymentSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Payment', paymentSchema);
