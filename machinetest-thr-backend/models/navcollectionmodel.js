const mongoose = require('mongoose');
const latestNavSchema = new mongoose.Schema({
  schemeCode: {
    type: Number,
    required: true,
    unique: true
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
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const LatestNav = mongoose.model('LatestNav', latestNavSchema, 'fund_latest_nav');
module.exports = LatestNav;