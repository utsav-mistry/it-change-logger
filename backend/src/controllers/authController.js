const User = require('../models/User');
const CompanySettings = require('../models/CompanySettings');
const jwt = require('jsonwebtoken');
const { totp } = require('otplib');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'changeme-secure-jwt-secret';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';

// Step 1: username + password
exports.login = async (req, res) => {
    try {
        const settings = await CompanySettings.findOne();
        if (!settings) {
            return res.status(403).json({ message: 'System not initialized' });
        }

        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password required' });
        }

        const user = await User.findOne({ username: username.toLowerCase().trim(), isActive: true });
        if (!user) {
            logger.warn(`Login failed: unknown user '${username}'`);
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const valid = await user.comparePassword(password);
        if (!valid) {
            logger.warn(`Login failed: wrong password for '${username}'`);
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        if (!user.totpEnrolled) {
            return res.json({
                step: 'totp_enroll',
                userId: user._id,
                message: 'TOTP not enrolled. Please enroll your authenticator.',
            });
        }

        return res.json({
            step: 'totp_verify',
            userId: user._id,
            message: 'Enter your TOTP code',
        });
    } catch (err) {
        logger.error(`Login error: ${err.message}`);
        res.status(500).json({ message: 'Server error' });
    }
};

// Step 2: TOTP verification
exports.verifyTotp = async (req, res) => {
    try {
        const { userId, token } = req.body;
        const user = await User.findById(userId).populate('department');
        if (!user || !user.isActive) {
            return res.status(401).json({ message: 'Invalid session' });
        }

        if (!user.totpEnabled || !user.totpSecret) {
            logger.warn(`TOTP verify failed: not enrolled for user ${user.username}`);
            return res.status(400).json({ message: 'TOTP not configured' });
        }

        const isValid = totp.check(token, user.totpSecret);
        if (!isValid) {
            logger.warn(`TOTP verify failed for user '${user.username}'`);
            return res.status(401).json({ message: 'Invalid TOTP code' });
        }

        user.lastLogin = new Date();
        await user.save();

        const jwtToken = jwt.sign(
            { userId: user._id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES }
        );

        res.json({
            token: jwtToken,
            user: {
                _id: user._id,
                username: user.username,
                displayName: user.displayName,
                role: user.role,
                department: user.department,
                isDepartmentHead: user.isDepartmentHead,
                email: user.email,
            }
        });
    } catch (err) {
        logger.error(`TOTP verify error: ${err.message}`);
        res.status(500).json({ message: 'Server error' });
    }
};

// Enroll TOTP for a user (first time)
exports.enrollTotp = async (req, res) => {
    try {
        const { userId, token } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const isValid = totp.check(token, user.totpSecret);
        if (!isValid) {
            logger.warn(`TOTP enrollment failed for user '${user.username}'`);
            return res.status(400).json({ message: 'Invalid TOTP code' });
        }

        user.totpEnabled = true;
        user.totpEnrolled = true;
        user.mustChangeTOTP = false;
        await user.save();

        const jwtToken = jwt.sign(
            { userId: user._id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES }
        );

        const fullUser = await User.findById(user._id).populate('department');

        res.json({
            token: jwtToken,
            user: {
                _id: fullUser._id,
                username: fullUser.username,
                displayName: fullUser.displayName,
                role: fullUser.role,
                department: fullUser.department,
                isDepartmentHead: fullUser.isDepartmentHead,
                email: fullUser.email,
            }
        });
    } catch (err) {
        logger.error(`TOTP enroll error: ${err.message}`);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get TOTP QR for new user
exports.getTotpQr = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.totpEnrolled) return res.status(400).json({ message: 'Already enrolled' });

        const QRCode = require('qrcode');
        const otpAuthUrl = `otpauth://totp/IT-Logger:${user.username}?secret=${user.totpSecret}&issuer=IT-Logger`;
        const qrDataUrl = await QRCode.toDataURL(otpAuthUrl);

        res.json({ qrDataUrl, secret: user.totpSecret });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).populate('department').select('-password -totpSecret');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};
