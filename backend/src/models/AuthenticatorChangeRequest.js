const mongoose = require('mongoose');

const authenticatorChangeRequestSchema = new mongoose.Schema({
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: '' },
    newTotpSecret: { type: String, default: null },
    newTotpQr: { type: String, default: null },
    qrViewedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 48 * 60 * 60 * 1000) },
}, { timestamps: true });

authenticatorChangeRequestSchema.index({ requestedBy: 1, status: 1 });
authenticatorChangeRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('AuthenticatorChangeRequest', authenticatorChangeRequestSchema);
