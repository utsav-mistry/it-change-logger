const Incident = require('../models/Incident');
const ReportDownload = require('../models/ReportDownload');
const CompanySettings = require('../models/CompanySettings');
const { objectsToCSV } = require('../utils/csv');
const PDFDocument = require('pdfkit');
const logger = require('../utils/logger');

// ── Date range helpers ─────────────────────────────────────────────────────────
function getPeriodRange(period, from, to) {
    const now = new Date();
    if (from && to) {
        return { dateFrom: new Date(from), dateTo: new Date(to), label: `${from} to ${to}`, type: 'custom' };
    }
    let dateFrom;
    let label;
    const type = period;
    if (period === 'daily') {
        dateFrom = new Date(now);
        dateFrom.setUTCHours(0, 0, 0, 0);
        dateFrom.setDate(dateFrom.getDate() - 1);
        label = `Last 24 hours`;
    } else if (period === 'weekly') {
        dateFrom = new Date(now);
        dateFrom.setDate(now.getDate() - 7);
        label = `Last 7 days`;
    } else if (period === 'monthly') {
        dateFrom = new Date(now);
        dateFrom.setMonth(now.getMonth() - 1);
        label = `Last 30 days`;
    } else if (period === 'yearly') {
        dateFrom = new Date(now);
        dateFrom.setFullYear(now.getFullYear() - 1);
        label = `Last 12 months`;
    } else {
        dateFrom = new Date(now);
        dateFrom.setMonth(now.getMonth() - 1);
        label = `Last 30 days`;
    }
    return { dateFrom, dateTo: now, label, type };
}

// ── Build full report data ─────────────────────────────────────────────────────
async function buildReportData(dateFrom, dateTo) {
    const query = { raisedAt: { $gte: dateFrom, $lte: dateTo } };

    const [incidents, byPriorityAgg, byStateAgg, byChannelAgg, byHourAgg, byHandlerAgg, resolutionAgg] =
        await Promise.all([
            Incident.find(query)
                .populate('createdInToolBy', 'displayName username')
                .populate('handledByUser', 'displayName username')
                .lean(),
            Incident.aggregate([{ $match: query }, { $group: { _id: '$priority', count: { $sum: 1 } } }]),
            Incident.aggregate([{ $match: query }, { $group: { _id: '$state', count: { $sum: 1 } } }]),
            Incident.aggregate([{ $match: query }, { $group: { _id: '$channel', count: { $sum: 1 } } }]),
            Incident.aggregate([
                { $match: query },
                { $group: { _id: { $hour: '$raisedAt' }, count: { $sum: 1 } } },
                { $sort: { '_id': 1 } },
            ]),
            Incident.aggregate([
                { $match: { ...query, state: 'Resolved', resolutionTime: { $ne: null } } },
                {
                    $project: {
                        handledByType: 1, handledByName: 1, createdInToolBy: 1,
                        resolutionMs: { $subtract: ['$resolutionTime', '$raisedAt'] },
                    }
                },
                { $group: { _id: null, avgMs: { $avg: '$resolutionMs' }, count: { $sum: 1 } } },
            ]),
            Incident.aggregate([
                { $match: { ...query } },
                {
                    $group: {
                        _id: {
                            $cond: [
                                { $eq: ['$handledByType', 'self'] }, 'createdInToolBy',
                                { $cond: [{ $eq: ['$handledByType', 'selfResolved'] }, '$raisedBy', '$handledByName'] }
                            ]
                        },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } },
                { $limit: 20 },
            ]),
        ]);

    const total = incidents.length;
    const resolved = incidents.filter(i => i.state === 'Resolved').length;
    const unresolved = total - resolved;

    // By handler (manual grouping for clarity)
    const handlerMap = {};
    for (const inc of incidents) {
        let handlerName;
        if (inc.handledByType === 'self') {
            handlerName = inc.createdInToolBy?.displayName || 'Unknown';
        } else if (inc.handledByType === 'selfResolved') {
            handlerName = `${inc.raisedBy} (Self)`;
        } else {
            handlerName = inc.handledByName || 'Unknown';
        }
        handlerMap[handlerName] = (handlerMap[handlerName] || 0) + 1;
    }

    const avgResolutionHours = resolutionAgg.length > 0
        ? +(resolutionAgg[0].avgMs / 1000 / 3600).toFixed(2)
        : 0;

    // Time-of-day: fill all 24 hours
    const hourDistribution = Array.from({ length: 24 }, (_, h) => {
        const found = byHourAgg.find(x => x._id === h);
        return { hour: `${String(h).padStart(2, '0')}:00`, count: found ? found.count : 0 };
    });

    return {
        total, resolved, unresolved, avgResolutionHours,
        byPriority: byPriorityAgg.reduce((a, i) => ({ ...a, [i._id]: i.count }), {}),
        byState: byStateAgg.reduce((a, i) => ({ ...a, [i._id]: i.count }), {}),
        byChannel: byChannelAgg.reduce((a, i) => ({ ...a, [i._id]: i.count }), {}),
        byHandler: Object.entries(handlerMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        hourDistribution,
        incidents,
    };
}

// ── In-app report data API ─────────────────────────────────────────────────────
exports.getReportData = async (req, res) => {
    try {
        const { period = 'monthly', from, to } = req.query;
        const { dateFrom, dateTo, label, type } = getPeriodRange(period, from, to);
        const data = await buildReportData(dateFrom, dateTo);
        res.json({ ...data, period: type, label, dateFrom, dateTo, generatedAt: new Date() });
    } catch (err) {
        logger.error(`Report data error: ${err.message}`);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── CSV export + audit ─────────────────────────────────────────────────────────
exports.generateCSV = async (req, res) => {
    try {
        const { period = 'monthly', from, to } = req.query;
        const { dateFrom, dateTo, type } = getPeriodRange(period, from, to);
        const data = await buildReportData(dateFrom, dateTo);

        const rows = data.incidents.map(inc => ({
            'Incident ID': inc.incidentId,
            'Raised At (UTC)': inc.raisedAt ? new Date(inc.raisedAt).toISOString() : '',
            'Raised By': inc.raisedBy,
            'Priority': inc.priority,
            'Channel': inc.channel,
            'Product': inc.product,
            'State': inc.state,
            'Handler': inc.handledByType === 'self' ? (inc.createdInToolBy?.displayName || '') :
                inc.handledByType === 'selfResolved' ? `${inc.raisedBy} (Self)` : (inc.handledByName || ''),
            'Created By': inc.createdInToolBy?.displayName || '',
            'Resolution Time (UTC)': inc.resolutionTime ? new Date(inc.resolutionTime).toISOString() : '',
            'Issue': (inc.issue || '').replace(/<[^>]+>/g, '').slice(0, 200),
            'Resolution': (inc.resolution || '').replace(/<[^>]+>/g, '').slice(0, 200),
        }));

        const csv = objectsToCSV(rows);

        await ReportDownload.create({
            reportType: type,
            module: 'incidents',
            dateFrom,
            dateTo,
            downloadedBy: req.user.userId,
            exportFormat: 'CSV',
            filters: { period, from, to },
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="incidents-${type}-${Date.now()}.csv"`);
        res.send(csv);
    } catch (err) {
        logger.error(`CSV report error: ${err.message}`);
        res.status(500).json({ message: 'Failed to generate report', error: err.message });
    }
};

// ── PDF export + audit ─────────────────────────────────────────────────────────
exports.generatePDF = async (req, res) => {
    try {
        const { period = 'monthly', from, to } = req.query;
        const { dateFrom, dateTo, label, type } = getPeriodRange(period, from, to);
        const data = await buildReportData(dateFrom, dateTo);

        const settings = await CompanySettings.findOne();
        const companyName = settings?.companyName || 'IT Logger';
        const generatedAt = new Date().toUTCString();

        await ReportDownload.create({
            reportType: type,
            module: 'incidents',
            dateFrom,
            dateTo,
            downloadedBy: req.user.userId,
            exportFormat: 'PDF',
            filters: { period, from, to },
        });

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="incident-report-${type}-${Date.now()}.pdf"`);
        doc.pipe(res);

        const drawHRule = (y, color = '#cccccc') => {
            doc.moveTo(50, y).lineTo(545, y).stroke(color);
        };

        // ── Page header ────────────────────────────────────────────────────────────
        doc.rect(50, 40, 495, 60).fill('#1a1a2e').fillColor('#ffffff');
        doc.fontSize(16).font('Helvetica-Bold').fillColor('#ffffff')
            .text(companyName, 60, 52, { width: 475 });
        doc.fontSize(11).font('Helvetica').fillColor('#aaaacc')
            .text('IT Incident Report', 60, 72, { width: 475 });
        doc.fillColor('#000000').moveDown(0.5);

        // Meta info
        doc.y = 115;
        doc.fontSize(9).font('Helvetica').fillColor('#444444');
        doc.text(`Report Period: ${label}`, 50);
        doc.text(`Date Range:    ${dateFrom.toUTCString()} to ${dateTo.toUTCString()}`, 50);
        doc.text(`Generated At:  ${generatedAt}`, 50);
        drawHRule(doc.y + 6);
        doc.y += 14;

        // ── Summary table ──────────────────────────────────────────────────────────
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text('Summary', 50);
        doc.y += 6;
        const summaryRows = [
            ['Total Incidents', String(data.total)],
            ['Resolved', String(data.resolved)],
            ['Unresolved', String(data.unresolved)],
            ['Avg Resolution Time', `${data.avgResolutionHours} hrs`],
        ];
        const colW = [200, 100];
        for (const [i, row] of summaryRows.entries()) {
            const bg = i % 2 === 0 ? '#f5f5f5' : '#ffffff';
            doc.rect(50, doc.y, 300, 18).fill(bg);
            doc.fillColor('#333333').fontSize(9).font('Helvetica')
                .text(row[0], 55, doc.y + 4, { width: 195 });
            doc.font('Helvetica-Bold').text(row[1], 255, doc.y - 13, { width: 95 });
            doc.y += 18;
        }
        drawHRule(doc.y + 4);
        doc.y += 14;

        // ── By Priority ────────────────────────────────────────────────────────────
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text('Incidents by Priority', 50);
        doc.y += 6;
        const priorities = ['Critical', 'High', 'Medium', 'Low'];
        for (const [i, p] of priorities.entries()) {
            const cnt = data.byPriority[p] || 0;
            const bg = i % 2 === 0 ? '#f5f5f5' : '#ffffff';
            doc.rect(50, doc.y, 300, 18).fill(bg);
            doc.fillColor('#333333').fontSize(9).font('Helvetica')
                .text(p, 55, doc.y + 4, { width: 195 });
            doc.font('Helvetica-Bold').text(String(cnt), 255, doc.y - 13, { width: 95 });
            // Bar
            const barW = data.total > 0 ? Math.round((cnt / data.total) * 150) : 0;
            doc.rect(370, doc.y - 13, barW, 12).fill('#4444aa');
            doc.fillColor('#333333').fontSize(8).font('Helvetica')
                .text(`${data.total > 0 ? ((cnt / data.total) * 100).toFixed(1) : 0}%`, 375 + barW, doc.y - 13);
            doc.y += 18;
        }
        drawHRule(doc.y + 4);
        doc.y += 14;

        // ── By State ────────────────────────────────────────────────────────────────
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text('Incidents by State', 50);
        doc.y += 6;
        const states = ['Open', 'In Progress', 'On Hold', 'Resolved', 'Archived'];
        for (const [i, s] of states.entries()) {
            const cnt = data.byState[s] || 0;
            const bg = i % 2 === 0 ? '#f5f5f5' : '#ffffff';
            doc.rect(50, doc.y, 300, 18).fill(bg);
            doc.fillColor('#333333').fontSize(9).font('Helvetica')
                .text(s, 55, doc.y + 4, { width: 195 });
            doc.font('Helvetica-Bold').text(String(cnt), 255, doc.y - 13, { width: 95 });
            doc.y += 18;
        }
        drawHRule(doc.y + 4);
        doc.y += 14;

        // ── By Channel ─────────────────────────────────────────────────────────────
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text('Incidents by Channel', 50);
        doc.y += 6;
        for (const [i, [ch, cnt]] of Object.entries(data.byChannel).entries()) {
            const bg = i % 2 === 0 ? '#f5f5f5' : '#ffffff';
            doc.rect(50, doc.y, 300, 18).fill(bg);
            doc.fillColor('#333333').fontSize(9).font('Helvetica')
                .text(ch, 55, doc.y + 4, { width: 195 });
            doc.font('Helvetica-Bold').text(String(cnt), 255, doc.y - 13, { width: 95 });
            doc.y += 18;
        }
        drawHRule(doc.y + 4);
        doc.y += 14;

        // ── By Handler ─────────────────────────────────────────────────────────────
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text('Incidents by Handler (Top 10)', 50);
        doc.y += 6;
        for (const [i, { name, count: cnt }] of data.byHandler.slice(0, 10).entries()) {
            const bg = i % 2 === 0 ? '#f5f5f5' : '#ffffff';
            doc.rect(50, doc.y, 300, 18).fill(bg);
            doc.fillColor('#333333').fontSize(9).font('Helvetica')
                .text(name, 55, doc.y + 4, { width: 195 });
            doc.font('Helvetica-Bold').text(String(cnt), 255, doc.y - 13, { width: 95 });
            doc.y += 18;
        }
        drawHRule(doc.y + 4);
        doc.y += 14;

        // ── Time of Day Distribution (text table) ───────────────────────────────────
        if (doc.y > 650) doc.addPage();
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text('Time-of-Day Distribution (UTC Hour)', 50);
        doc.y += 6;
        const hourGroups = [];
        for (let i = 0; i < 24; i += 6) {
            hourGroups.push(data.hourDistribution.slice(i, i + 6));
        }
        for (const [gi, group] of hourGroups.entries()) {
            const bg = gi % 2 === 0 ? '#f5f5f5' : '#ffffff';
            doc.rect(50, doc.y, 495, 18).fill(bg);
            let x = 55;
            for (const item of group) {
                doc.fillColor('#333333').fontSize(8).font('Helvetica')
                    .text(`${item.hour}: ${item.count}`, x, doc.y + 4, { width: 78 });
                x += 82;
            }
            doc.y += 18;
        }
        drawHRule(doc.y + 4);
        doc.y += 14;

        // ── Incident list ───────────────────────────────────────────────────────────
        if (doc.y > 650) doc.addPage();
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text('Incident List', 50);
        doc.y += 6;

        // Table header
        doc.rect(50, doc.y, 495, 16).fill('#333333');
        const cols = [
            { label: 'ID', x: 55, w: 40 },
            { label: 'Priority', x: 100, w: 55 },
            { label: 'State', x: 160, w: 70 },
            { label: 'Product', x: 235, w: 100 },
            { label: 'Raised By', x: 340, w: 100 },
            { label: 'Raised At', x: 445, w: 95 },
        ];
        for (const col of cols) {
            doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold')
                .text(col.label, col.x, doc.y + 3, { width: col.w });
        }
        doc.y += 16;

        for (const [i, inc] of data.incidents.entries()) {
            if (doc.y > 750) { doc.addPage(); }
            const bg = i % 2 === 0 ? '#f9f9f9' : '#ffffff';
            doc.rect(50, doc.y, 495, 15).fill(bg);
            const row = [
                { text: `#${inc.incidentId}`, x: 55, w: 40 },
                { text: inc.priority, x: 100, w: 55 },
                { text: inc.state, x: 160, w: 70 },
                { text: (inc.product || '').slice(0, 18), x: 235, w: 100 },
                { text: (inc.raisedBy || '').slice(0, 18), x: 340, w: 100 },
                { text: inc.raisedAt ? new Date(inc.raisedAt).toISOString().slice(0, 10) : '', x: 445, w: 95 },
            ];
            for (const cell of row) {
                doc.fillColor('#222222').fontSize(8).font('Helvetica')
                    .text(cell.text, cell.x, doc.y + 3, { width: cell.w });
            }
            doc.y += 15;
        }

        // Footer
        doc.fontSize(8).fillColor('#888888').font('Helvetica')
            .text('Generated by IT Change / Incident Logger', 50, doc.page.height - 40, {
                width: 495, align: 'center',
            });

        doc.end();
    } catch (err) {
        logger.error(`PDF report error: ${err.message}`);
        res.status(500).json({ message: 'Failed to generate PDF', error: err.message });
    }
};

// ── Dashboard stats for main dashboard page ────────────────────────────────────
exports.getDashboardStats = async (req, res) => {
    try {
        const { period = '30' } = req.query;
        const from = new Date();
        from.setDate(from.getDate() - parseInt(period));
        const query = { raisedAt: { $gte: from } };

        const [total, byPriority, byState, byChannel, overTime, resolutionTrend] = await Promise.all([
            Incident.countDocuments(query),
            Incident.aggregate([{ $match: query }, { $group: { _id: '$priority', count: { $sum: 1 } } }]),
            Incident.aggregate([{ $match: query }, { $group: { _id: '$state', count: { $sum: 1 } } }]),
            Incident.aggregate([{ $match: query }, { $group: { _id: '$channel', count: { $sum: 1 } } }]),
            Incident.aggregate([
                { $match: query },
                { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$raisedAt' } }, count: { $sum: 1 } } },
                { $sort: { '_id': 1 } },
            ]),
            Incident.aggregate([
                { $match: { ...query, resolutionTime: { $ne: null }, state: 'Resolved' } },
                { $project: { week: { $isoWeek: '$raisedAt' }, year: { $isoWeekYear: '$raisedAt' }, resolutionMs: { $subtract: ['$resolutionTime', '$raisedAt'] } } },
                { $group: { _id: { week: '$week', year: '$year' }, avgMs: { $avg: '$resolutionMs' } } },
                { $sort: { '_id.year': 1, '_id.week': 1 } },
            ]),
        ]);

        const byStateObj = byState.reduce((a, i) => ({ ...a, [i._id]: i.count }), {});

        res.json({
            total,
            resolved: byStateObj['Resolved'] || 0,
            byPriority: byPriority.reduce((a, i) => ({ ...a, [i._id]: i.count }), {}),
            byState: byStateObj,
            byChannel: byChannel.reduce((a, i) => ({ ...a, [i._id]: i.count }), {}),
            overTime: overTime.map(o => ({ date: o._id, count: o.count })),
            resolutionTrend: resolutionTrend.map(r => ({
                label: `W${r._id.week}-${r._id.year}`,
                avgHours: +(r.avgMs / 1000 / 3600).toFixed(2),
            })),
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── Report download audit log ──────────────────────────────────────────────────
exports.getDownloadAudit = async (req, res) => {
    try {
        const { page = 1, limit = 30, module, format, from, to } = req.query;
        const query = {};
        if (module) query.module = module;
        if (format) query.exportFormat = format;
        if (from || to) {
            query.downloadedAt = {};
            if (from) query.downloadedAt.$gte = new Date(from);
            if (to) query.downloadedAt.$lte = new Date(to);
        }
        const total = await ReportDownload.countDocuments(query);
        const records = await ReportDownload.find(query)
            .populate('downloadedBy', 'username displayName')
            .sort({ downloadedAt: -1 })
            .skip((parseInt(page) - 1) * parseInt(limit))
            .limit(parseInt(limit));

        res.json({ records, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};
