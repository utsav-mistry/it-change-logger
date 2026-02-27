const Incident = require('../models/Incident');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const Notification = require('../models/Notification');

// Mutable fields (only these can change after creation)
const MUTABLE_FIELDS = ['observation', 'steps', 'resolution', 'resolutionTime', 'resolutionTimezone',
    'handledByType', 'handledByUser', 'handledByName', 'state', 'isArchived'];

// Create incident
exports.createIncident = async (req, res) => {
    try {
        const {
            raisedAt, raisedAtTimezone, raisedBy, priority, channel, channelOther,
            product, issue, handledByType, handledByUser, handledByName, state
        } = req.body;

        if (!raisedAt || !raisedBy || !priority || !channel || !product || !issue) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const incident = new Incident({
            raisedAt: new Date(raisedAt),
            raisedAtTimezone: raisedAtTimezone || 'UTC',
            raisedBy: raisedBy.trim(),
            priority,
            channel,
            channelOther: channel === 'Other' ? (channelOther || '') : '',
            product: product.trim(),
            issue,
            createdInToolBy: req.user.userId,
            handledByType: handledByType || 'self',
            handledByUser: handledByType === 'self' ? req.user.userId : (handledByType === 'other' ? (handledByUser || null) : null),
            handledByName: handledByType === 'other' ? (handledByName || '') : '',
            state: state || 'Open',
        });
        await incident.save();

        // Audit log for creation
        await AuditLog.create({
            incident: incident._id,
            incidentId: incident.incidentId,
            field: 'created',
            oldValue: null,
            newValue: 'Incident created',
            changedBy: req.user.userId,
            action: 'create',
        });

        // Re-fetch with populated user refs so the response has displayName etc.
        const populated = await Incident.findById(incident._id)
            .populate('createdInToolBy', 'username displayName')
            .populate('handledByUser', 'username displayName');

        res.status(201).json({ message: 'Incident created', incident: populated });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// Get one incident
exports.getIncident = async (req, res) => {
    try {
        const incident = await Incident.findOne({ incidentId: parseInt(req.params.incidentId) })
            .populate('createdInToolBy', 'username displayName')
            .populate('handledByUser', 'username displayName')
            .populate('archivedBy', 'username displayName');

        if (!incident) return res.status(404).json({ message: 'Incident not found' });
        res.json(incident);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};

// List / search incidents
exports.listIncidents = async (req, res) => {
    try {
        const {
            page = 1, limit = 20,
            search, incidentId, priority, channel, state, handledBy, raisedBy,
            createdInToolBy, product, raisedAtFrom, raisedAtTo, resolutionFrom, resolutionTo,
            sortBy = 'incidentId', sortOrder = 'desc',
        } = req.query;

        const query = {};

        // Full-text search
        if (search) {
            query.$text = { $search: search };
        }

        // Filters
        if (incidentId) query.incidentId = parseInt(incidentId);
        if (priority) query.priority = priority;
        if (channel) query.channel = channel;
        if (state) query.state = state;
        if (handledBy) {
            query.$or = [
                { handledByName: { $regex: handledBy, $options: 'i' } },
            ];
        }
        if (raisedBy) query.raisedBy = { $regex: raisedBy, $options: 'i' };
        if (createdInToolBy) query.createdInToolBy = createdInToolBy;
        if (product) query.product = { $regex: product, $options: 'i' };
        if (raisedAtFrom || raisedAtTo) {
            query.raisedAt = {};
            if (raisedAtFrom) query.raisedAt.$gte = new Date(raisedAtFrom);
            if (raisedAtTo) query.raisedAt.$lte = new Date(raisedAtTo);
        }
        if (resolutionFrom || resolutionTo) {
            query.resolutionTime = {};
            if (resolutionFrom) query.resolutionTime.$gte = new Date(resolutionFrom);
            if (resolutionTo) query.resolutionTime.$lte = new Date(resolutionTo);
        }

        const sortDir = sortOrder === 'asc' ? 1 : -1;
        const sortObj = { [sortBy]: sortDir };

        const total = await Incident.countDocuments(query);
        const incidents = await Incident.find(query)
            .populate('createdInToolBy', 'username displayName')
            .populate('handledByUser', 'username displayName')
            .sort(sortObj)
            .skip((parseInt(page) - 1) * parseInt(limit))
            .limit(parseInt(limit));

        res.json({
            incidents,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// Update incident (only mutable fields)
exports.updateIncident = async (req, res) => {
    try {
        const incident = await Incident.findOne({ incidentId: parseInt(req.params.incidentId) });
        if (!incident) return res.status(404).json({ message: 'Incident not found' });

        const updates = req.body;
        // Prevent editing of incident details when the incident is in 'Resolved' (closed) state
        const closedDetailFields = ['observation', 'steps', 'resolution', 'resolutionTime', 'handledByType', 'handledByUser', 'handledByName'];
        if (incident.state === 'Resolved') {
            for (const f of closedDetailFields) {
                if (updates[f] !== undefined && JSON.stringify(updates[f]) !== JSON.stringify(incident[f])) {
                    return res.status(400).json({ message: 'Incident is resolved — details cannot be edited. Reopen the incident to modify details.' });
                }
            }
        }
        const auditEntries = [];

        for (const field of MUTABLE_FIELDS) {
            if (updates[field] !== undefined && JSON.stringify(updates[field]) !== JSON.stringify(incident[field])) {
                auditEntries.push({
                    incident: incident._id,
                    incidentId: incident.incidentId,
                    field,
                    oldValue: incident[field],
                    newValue: updates[field],
                    changedBy: req.user.userId,
                    action: field === 'state' ? 'state_change' : (field === 'isArchived' ? 'archive' : 'update'),
                });
                incident[field] = updates[field];
            }
        }

        // Handle archive
        if (updates.isArchived === true && !incident.isArchived) {
            incident.isArchived = true;
            incident.archivedAt = new Date();
            incident.archivedBy = req.user.userId;
            incident.state = 'Archived';
        }

        // Handle resolution
        if (updates.resolutionTime) {
            incident.resolutionTime = new Date(updates.resolutionTime);
        }
        if (updates.handledByUser) {
            incident.handledByUser = updates.handledByUser;
        }

        await incident.save();

        if (auditEntries.length > 0) {
            await AuditLog.insertMany(auditEntries);
        }

        // Notification on resolution
        if (updates.state === 'Resolved') {
            const admins = await User.find({ role: { $in: ['Admin', 'IT Admin'] }, isActive: true });
            for (const admin of admins) {
                if (admin._id.toString() !== req.user.userId) {
                    await Notification.create({
                        recipient: admin._id,
                        type: 'incident_resolved',
                        title: 'Incident Resolved',
                        message: `Incident #${incident.incidentId} has been resolved.`,
                        data: { incidentId: incident.incidentId },
                    });
                }
            }
        }

        // Re-fetch with populated user refs so the response has displayName etc.
        const populated = await Incident.findById(incident._id)
            .populate('createdInToolBy', 'username displayName')
            .populate('handledByUser', 'username displayName')
            .populate('archivedBy', 'username displayName');

        res.json({ message: 'Incident updated', incident: populated });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// Get audit log for an incident
exports.getAuditLog = async (req, res) => {
    try {
        const incident = await Incident.findOne({ incidentId: parseInt(req.params.incidentId) });
        if (!incident) return res.status(404).json({ message: 'Incident not found' });

        const logs = await AuditLog.find({ incident: incident._id })
            .populate('changedBy', 'username displayName')
            .sort({ changedAt: -1 });

        res.json(logs);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Get timeline (state changes + key actions)
exports.getTimeline = async (req, res) => {
    try {
        const incident = await Incident.findOne({ incidentId: parseInt(req.params.incidentId) });
        if (!incident) return res.status(404).json({ message: 'Incident not found' });

        const logs = await AuditLog.find({
            incident: incident._id,
            action: { $in: ['create', 'state_change', 'archive'] }
        })
            .populate('changedBy', 'username displayName')
            .sort({ changedAt: 1 });

        res.json(logs);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};
