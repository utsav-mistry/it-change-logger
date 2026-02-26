const mongoose = require('mongoose');

const companySettingsSchema = new mongoose.Schema({
    companyName: { type: String, required: true, trim: true },
    logoBase64: { type: String, default: '' },
    logoMimeType: { type: String, default: 'image/png' },
    isInitialized: { type: Boolean, default: true },
    setupCompletedAt: { type: Date, default: Date.now },
    setupCompletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

module.exports = mongoose.model('CompanySettings', companySettingsSchema);
