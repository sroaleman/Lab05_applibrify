const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema(
  {
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true,
    },
    delta: {
      type: Number,
      required: true,
      validate: {
        validator: function (v) {
          return Number.isInteger(v) && v !== 0;
        },
        message: 'delta debe ser un número entero distinto de 0',
      },
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 200,
    },
    type: {
      type: String,
      required: true,
      enum: ['ADJUSTMENT', 'SALE', 'RETURN'],
      default: 'ADJUSTMENT',
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

stockMovementSchema.index({ bookId: 1, createdAt: -1 });

stockMovementSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('StockMovement', stockMovementSchema);

