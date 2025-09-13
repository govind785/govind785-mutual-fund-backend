const mongoose = require('mongoose');
const portfolioSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  schemeCode: {
    type: Number,
    required: true
  },
  units: {
    type: Number,
    required: true,
    min: 0.001
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index to prevent duplicate entries
portfolioSchema.index({ userId: 1, schemeCode: 1 }, { unique: true });

const Portfolio = mongoose.model('Portfolio', portfolioSchema);
module.exports = Portfolio;
