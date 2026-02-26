const Notification = require('../models/Notification');

// Get notifications for logged in user
exports.getNotifications = async (req, res) => {
    try {
        const { page = 1, limit = 20, unreadOnly } = req.query;
        const query = { recipient: req.user.userId };
        if (unreadOnly === 'true') query.isRead = false;

        const total = await Notification.countDocuments(query);
        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .skip((parseInt(page) - 1) * parseInt(limit))
            .limit(parseInt(limit));

        const unreadCount = await Notification.countDocuments({ recipient: req.user.userId, isRead: false });

        res.json({ notifications, total, unreadCount, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Mark as read
exports.markRead = async (req, res) => {
    try {
        const { ids } = req.body; // array of IDs or 'all'
        if (ids === 'all') {
            await Notification.updateMany(
                { recipient: req.user.userId, isRead: false },
                { isRead: true, readAt: new Date() }
            );
        } else if (Array.isArray(ids)) {
            await Notification.updateMany(
                { _id: { $in: ids }, recipient: req.user.userId },
                { isRead: true, readAt: new Date() }
            );
        }
        res.json({ message: 'Marked as read' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};
