const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 200,
    },
    author: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0.01,
    },
    currency: {
      type: String,
      default: () => process.env.CURRENCY_CODE || 'USD',
    },
    productType: {
      type: String,
      required: true,
      enum: ['DIGITAL', 'PHYSICAL'],
    },
    coverUrl: {
      type: String,
      trim: true,
      default: '',
    },
    fileKey: {
      type: String,
      trim: true,
      validate: {
        validator: function (val) {
          if (this.productType === 'DIGITAL') {
            return typeof val === 'string' && val.trim().length > 0;
          }
          return true;
        },
        message: 'fileKey es obligatorio cuando productType es DIGITAL',
      },
    },
    stock: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'stock debe ser un número entero',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

bookSchema.pre('save', function (next) {
  if (this.productType === 'PHYSICAL') {
    this.fileKey = undefined;
  }
  next();
});

bookSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v;
    delete ret.fileKey;
    return ret;
  },
});

module.exports = mongoose.model('Book', bookSchema);

