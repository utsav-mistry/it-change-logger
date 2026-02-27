const WorkLog = require('../models/WorkLog');
const ReportDownload = require('../models/ReportDownload');
const User = require('../models/User');
const { objectsToCSV } = require('../utils/csv');
const PDFDocument = require('pdfkit');
const logger = require('../utils/logger');

// Get today's server date as YYYY-MM-DD in UTC
function todayUTC() {
    return new Date().toISOString().slice(0, 10);
}

// Get today's work log for the logged-in user (does NOT auto-create a draft)
exports.getMyToday = async (req, res) => {
    try {
        const date = todayUTC();
        const log = await WorkLog.findOne({ employee: req.user.userId, date });
        // Return null cleanly — do NOT auto-create a draft here.
        // Drafts are only created when the user explicitly clicks "Save Draft".
        if (!log) return res.status(204).end();
        res.json(log);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Save draft (not submitted yet) — creates the draft if it doesn't exist yet
exports.saveDraft = async (req, res) => {
    try {
        const date = todayUTC();
        let log = await WorkLog.findOne({ employee: req.user.userId, date });

        if (!log) {
            // First save — create the draft now (not on page load)
            log = new WorkLog({ employee: req.user.userId, date, content: '', isSubmitted: false });
        }

        if (log.isSubmitted) return res.status(400).json({ message: 'Already submitted. Cannot edit.' });

        log.content = req.body.content || '';
        await log.save();
        res.json({ message: 'Draft saved', log });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Submit today's log (locks it)
exports.submitLog = async (req, res) => {
    try {
        const date = todayUTC();
        let log = await WorkLog.findOne({ employee: req.user.userId, date });

        // If user writes and submits directly without saving a draft first, create the record now
        if (!log) {
            log = new WorkLog({ employee: req.user.userId, date, content: '', isSubmitted: false });
        }

        if (log.isSubmitted) return res.status(400).json({ message: 'Already submitted for today' });
        if (!req.body.content || req.body.content.replace(/<[^>]+>/g, '').trim().length === 0) {
            return res.status(400).json({ message: 'Work log content cannot be empty before submission' });
        }

        log.isSubmitted = true;
        log.submittedAt = new Date();
        log.submittedAtTimezone = req.body.timezone || 'UTC';
        log.content = req.body.content;
        log.ipAddress = req.ip || req.headers['x-forwarded-for'] || '';
        await log.save();

        res.json({ message: 'Work log submitted', log });
    } catch (err) {
        logger.error(`WorkLog submit error: ${err.message}`);
        res.status(500).json({ message: 'Server error' });
    }
};


// Get my historical logs (paginated)
exports.getMyHistory = async (req, res) => {
    try {
        const { page = 1, limit = 20, from, to } = req.query;
        const query = { employee: req.user.userId };
        if (from || to) {
            query.date = {};
            if (from) query.date.$gte = from;
            if (to) query.date.$lte = to;
        }
        const total = await WorkLog.countDocuments(query);
        const logs = await WorkLog.find(query)
            .sort({ date: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        res.json({ logs, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Admin: list all work logs — SUBMITTED only. Drafts are private to the employee.
exports.adminListLogs = async (req, res) => {
    try {
        const { page = 1, limit = 30, userId, department, date, from, to } = req.query;
        // Hard filter: admins NEVER see drafts
        const query = { isSubmitted: true };

        if (userId) query.employee = userId;
        if (date) query.date = date;
        else if (from || to) {
            query.date = {};
            if (from) query.date.$gte = from;
            if (to) query.date.$lte = to;
        }

        // Filter by department — intersect with userId if also set
        if (department) {
            const deptUsers = await User.find({ department, isActive: true }).select('_id');
            const deptIds = deptUsers.map(u => u._id.toString());
            if (userId) {
                // Only return logs if userId is actually in the selected department
                if (!deptIds.includes(userId)) {
                    return res.json({ logs: [], total: 0, page: 1, totalPages: 0 });
                }
                // userId already set — no change needed
            } else {
                query.employee = { $in: deptUsers.map(u => u._id) };
            }
        }

        const total = await WorkLog.countDocuments(query);
        const logs = await WorkLog.find(query)
            .populate({
                path: 'employee',
                select: 'username displayName department role isDepartmentHead',
                populate: {
                    path: 'department',
                    select: 'name head',
                    populate: { path: 'head', select: 'displayName' }
                },
            })
            .sort({ date: -1, submittedAt: -1 })
            .skip((parseInt(page) - 1) * parseInt(limit))
            .limit(parseInt(limit));

        res.json({ logs, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Admin: export work logs as CSV
exports.exportCSV = async (req, res) => {
    try {
        const { from, to, userId, department } = req.query;
        if (!from || !to) return res.status(400).json({ message: 'from and to date are required' });

        const query = { date: { $gte: from, $lte: to }, isSubmitted: true };
        if (userId) query.employee = userId;
        if (department) {
            const deptUsers = await User.find({ department, isActive: true }).select('_id');
            query.employee = { $in: deptUsers.map(u => u._id) };
        }

        const logs = await WorkLog.find(query)
            .populate('employee', 'username displayName')
            .sort({ date: -1 });

        const rows = logs.map(l => ({
            'Employee': l.employee?.displayName || '',
            'Username': l.employee?.username || '',
            'Date': l.date,
            'Submitted At': l.submittedAt ? l.submittedAt.toISOString() : '',
            'Content': (l.content || '').replace(/<[^>]+>/g, '').trim(),
        }));

        const csv = objectsToCSV(rows);

        // Audit record
        await ReportDownload.create({
            reportType: 'custom',
            module: 'worklog',
            dateFrom: new Date(from),
            dateTo: new Date(to),
            downloadedBy: req.user.userId,
            exportFormat: 'CSV',
            filters: { userId, department },
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="worklogs-${from}-${to}.csv"`);
        res.send(csv);
    } catch (err) {
        res.status(500).json({ message: 'Export failed', error: err.message });
    }
};

// Admin: export work logs as PDF
exports.exportPDF = async (req, res) => {
    try {
        const { from, to, userId, department } = req.query;
        if (!from || !to) return res.status(400).json({ message: 'from and to date are required' });

        const query = { date: { $gte: from, $lte: to }, isSubmitted: true };
        if (userId) query.employee = userId;

        const logs = await WorkLog.find(query)
            .populate('employee', 'username displayName')
            .sort({ date: -1 });

        // Audit record
        await ReportDownload.create({
            reportType: 'custom',
            module: 'worklog',
            dateFrom: new Date(from),
            dateTo: new Date(to),
            downloadedBy: req.user.userId,
            exportFormat: 'PDF',
            filters: { userId, department },
        });

        const settings = await require('../models/CompanySettings').findOne();
        const companyName = settings?.companyName || 'IT Logger';

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="worklogs-${from}-${to}.pdf"`);
        doc.pipe(res);

        // Header
        doc.fontSize(16).font('Helvetica-Bold').text(companyName, { align: 'center' });
        doc.fontSize(13).font('Helvetica').text('Daily Work Logs Report', { align: 'center' });
        doc.fontSize(10).fillColor('#666').text(`Period: ${from} to ${to}  |  Generated: ${new Date().toUTCString()}`, { align: 'center' });
        doc.fillColor('#000').moveDown(1.5);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc').moveDown(1);

        // Summary
        doc.fontSize(11).font('Helvetica-Bold').text(`Total Entries: ${logs.length}`);
        const uniqueUsers = [...new Set(logs.map(l => l.employee?.username))];
        doc.font('Helvetica').text(`Staff Members: ${uniqueUsers.length}`).moveDown(1);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc').moveDown(1);

        // Entries
        for (const log of logs) {
            doc.fontSize(11).font('Helvetica-Bold')
                .text(`${log.date}  —  ${log.employee?.displayName || 'Unknown'} (@${log.employee?.username || ''})`);
            doc.fontSize(9).font('Helvetica').fillColor('#555')
                .text(`Submitted: ${log.submittedAt ? log.submittedAt.toUTCString() : 'N/A'}`);
            doc.fillColor('#000').fontSize(10).font('Helvetica')
                .text((log.content || '').replace(/<[^>]+>/g, '').trim() || '(empty)', {
                    width: 495, indent: 10,
                });
            doc.moveDown(0.8);
            doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#eeeeee').moveDown(0.8);

            if (doc.y > 740) { doc.addPage(); }
        }

        doc.end();
    } catch (err) {
        res.status(500).json({ message: 'PDF export failed', error: err.message });
    }
};

// Delete a work log (only allowed for drafts). Admins can delete any draft; submitted logs cannot be deleted.
exports.deleteLog = async (req, res) => {
    try {
        const id = req.params.id;
        const log = await WorkLog.findById(id);
        if (!log) return res.status(404).json({ message: 'Work log not found' });

        // Prevent deletion of submitted logs
        if (log.isSubmitted) return res.status(403).json({ message: 'Cannot delete submitted work logs' });

        // Allow owner to delete their own drafts, or admins to delete any draft
        if (log.employee.toString() !== req.user.userId && !(req.user.role === 'Admin' || req.user.role === 'IT Admin')) {
            return res.status(403).json({ message: 'Not authorized to delete this work log' });
        }

        await WorkLog.findByIdAndDelete(id);
        res.json({ message: 'Work log deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};
