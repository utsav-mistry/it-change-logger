const jwt = require('jsonwebtoken');
const CompanySettings = require('../models/CompanySettings');

const JWT_SECRET = process.env.JWT_SECRET || 'changeme-secure-jwt-secret';

// Require system to be initialized
exports.requireSetup = async (req, res, next) => {
    try {
        const settings = await CompanySettings.findOne();
        if (!settings) {
            return res.status(403).json({ message: 'System not initialized. Please complete setup first.' });
        }
        next();
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Authenticate JWT
exports.authenticate = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};

// Require admin role
exports.requireAdmin = (req, res, next) => {
    if (!req.user || !['Admin', 'IT Admin'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};
