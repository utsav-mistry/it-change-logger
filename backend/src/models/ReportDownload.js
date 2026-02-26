const mongoose = require('mongoose');

const reportDownloadSchema = new mongoose.Schema({
    reportType: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly', 'custom'], required: true },
    module: { type: String, enum: ['incidents', 'worklog'], default: 'incidents' },
    dateFrom: { type: Date, required: true },
    dateTo: { type: Date, required: true },
    generatedAt: { type: Date, default: Date.now },
    downloadedAt: { type: Date, default: Date.now },
    downloadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    exportFormat: { type: String, enum: ['PDF', 'CSV'], required: true },
    filters: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: false });

reportDownloadSchema.index({ downloadedBy: 1, downloadedAt: -1 });
reportDownloadSchema.index({ downloadedAt: -1 });
reportDownloadSchema.index({ reportType: 1 });

module.exports = mongoose.model('ReportDownload', reportDownloadSchema);
