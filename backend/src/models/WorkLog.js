const mongoose = require('mongoose');

const workLogSchema = new mongoose.Schema({
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD server date, used for uniqueness
    submittedAt: { type: Date, default: null },
    submittedAtTimezone: { type: String, default: 'UTC' },
    content: { type: String, default: '' }, // HTML from rich editor
    isSubmitted: { type: Boolean, default: false },
    ipAddress: { type: String, default: '' },
}, { timestamps: true });

// One log per user per calendar day
workLogSchema.index({ employee: 1, date: 1 }, { unique: true });
workLogSchema.index({ date: 1 });
workLogSchema.index({ employee: 1, isSubmitted: 1 });

module.exports = mongoose.model('WorkLog', workLogSchema);
