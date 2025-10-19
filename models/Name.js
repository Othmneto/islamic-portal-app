const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// UPDATED SCHEMA TO INCLUDE THE 'advanced' FIELD
const NameSchema = new Schema({
  id: {
    type: Number,
    required: true,
    unique: true,
    index: true,
  },
  name: { type: Schema.Types.Mixed, required: true },
  transliteration: { type: Schema.Types.Mixed, required: true },
  root: { type: Schema.Types.Mixed },
  category: { type: Schema.Types.Mixed },
  reference: { type: Schema.Types.Mixed },

  // Existing flexible fields
  explanations: { type: Schema.Types.Mixed },
  invocation: { type: Schema.Types.Mixed },
  use_case: { type: Schema.Types.Mixed },
  mufassir_keys: { type: Schema.Types.Mixed },
  importance_level: { type: String },

  // --- NEWLY ADDED FIELD ---
  advanced: { type: Schema.Types.Mixed }
});

const Name = mongoose.model('name', NameSchema);

module.exports = Name;