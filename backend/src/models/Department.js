const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, trim: true },
    head: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

// unique constraint on name already creates an index
// keep head index for lookups
departmentSchema.index({ head: 1 });

module.exports = mongoose.model('Department', departmentSchema);
