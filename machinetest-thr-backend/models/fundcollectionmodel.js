const mongoose = require('mongoose');
const fundSchema = new mongoose.Schema({
  schemeCode: {
    type: Number,
    required: true,
    unique: true
  },
  schemeName: {
    type: String,
    required: true,
    trim: true
  },
  fundHouse: {
    type: String,
    required: true,
    trim: true
  }
});

// Index for search functionality
fundSchema.index({ schemeName: 'text', fundHouse: 'text' });

const Fund = mongoose.model('Fund', fundSchema);
module.exports = Fund;