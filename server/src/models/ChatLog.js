const mongoose = require('mongoose');

const chatLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  message: {
    type: String,
    required: true,
    maxlength: 500,
  },
  response: {
    type: String,
    required: true,
  },
  sentiment: {
    type: String,
    enum: ['positive', 'neutral', 'frustrated'],
    default: 'neutral',
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// TTL index — auto-delete chat logs after 90 days
chatLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Index for sentiment aggregation queries
chatLogSchema.index({ sentiment: 1, timestamp: -1 });

module.exports = mongoose.model('ChatLog', chatLogSchema);
