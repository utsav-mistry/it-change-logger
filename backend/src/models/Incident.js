const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const incidentSchema = new mongoose.Schema({
    // Auto-increment ID
    incidentId: { type: Number, unique: true },

    // Immutable creation fields
    raisedAt: { type: Date, required: true },
    raisedAtTimezone: { type: String, required: true, default: 'UTC' },
    raisedBy: { type: String, required: true, trim: true },
    priority: { type: String, enum: ['Critical', 'High', 'Medium', 'Low'], required: true },
    channel: { type: String, enum: ['Teams', 'Mail', 'Ticket', 'Other'], required: true },
    channelOther: { type: String, default: '' },
    product: { type: String, required: true, trim: true },
    issue: { type: String, required: true },
    createdInToolBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Mutable fields (only these can change after creation)
    observation: { type: String, default: '' },
    steps: { type: String, default: '' },
    resolution: { type: String, default: '' },
    resolutionTime: { type: Date, default: null },
    resolutionTimezone: { type: String, default: 'UTC' },

    handledByType: { type: String, enum: ['self', 'selfResolved', 'other'], default: 'self' },
    handledByUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    handledByName: { type: String, default: '' },

    state: {
        type: String,
        enum: ['Open', 'In Progress', 'On Hold', 'Resolved', 'Archived'],
        default: 'Open'
    },
    isArchived: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
    archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Future-proofing: record type
    recordType: { type: String, enum: ['incident', 'change_request'], default: 'incident' },
}, { timestamps: true });

// Auto-increment incidentId
incidentSchema.pre('save', async function (next) {
    if (this.isNew) {
        const last = await mongoose.model('Incident').findOne({}, {}, { sort: { incidentId: -1 } });
        this.incidentId = last ? last.incidentId + 1 : 1001;
    }
    next();
});

// Indexes for performance (unique incidentId already indexed automatically)
// incidentSchema.index({ incidentId: 1 });
incidentSchema.index({ raisedAt: -1 });
incidentSchema.index({ state: 1 });
incidentSchema.index({ priority: 1 });
incidentSchema.index({ channel: 1 });
incidentSchema.index({ createdInToolBy: 1 });
incidentSchema.index({ handledByUser: 1 });
incidentSchema.index({ product: 1 });
incidentSchema.index({ raisedBy: 1 });
incidentSchema.index({ isArchived: 1 });
incidentSchema.index({ resolutionTime: -1 });

// Text index for full-text search
incidentSchema.index({
    issue: 'text',
    product: 'text',
    resolution: 'text',
    observation: 'text',
    steps: 'text',
    raisedBy: 'text',
});

incidentSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Incident', incidentSchema);
