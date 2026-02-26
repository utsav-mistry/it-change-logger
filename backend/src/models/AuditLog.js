const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    incident: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', required: true },
    incidentId: { type: Number, required: true },
    field: { type: String, required: true },
    oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    changedAt: { type: Date, default: Date.now },
    action: { type: String, enum: ['create', 'update', 'archive', 'state_change'], default: 'update' },
}, { timestamps: false });

auditLogSchema.index({ incident: 1, changedAt: -1 });
auditLogSchema.index({ incidentId: 1 });
auditLogSchema.index({ changedBy: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
