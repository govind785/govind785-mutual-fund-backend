const mongoose = require('mongoose');
const navHistorySchema = new mongoose.Schema({
  schemeCode: {
    type: Number,
    required: true
  },
  nav: {
    type: Number,
    required: true,
    min: 0
  },
  date: {
    type: String,
    required: true,
    match: /^\d{2}-\d{2}-\d{4}$/ // DD-MM-YYYY format
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for efficient queries
navHistorySchema.index({ schemeCode: 1, date: -1 });

const NavHistory = mongoose.model('NavHistory', navHistorySchema, 'fund_nav_history');

// Export all models
module.exports = NavHistory;