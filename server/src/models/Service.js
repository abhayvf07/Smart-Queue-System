const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Service name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    prefix: {
      type: String,
      required: [true, 'Service prefix is required (e.g., A, B, C)'],
      uppercase: true,
      trim: true,
      maxlength: 3,
      unique: true,
    },
    capacityPerHour: {
      type: Number,
      default: 20,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Service', serviceSchema);
