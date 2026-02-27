const CompanySettings = require('../models/CompanySettings');
const User = require('../models/User');
const { authenticator } = require('otplib');
const { createRecoveryCodes } = require('../utils/totp');
const QRCode = require('qrcode');
const logger = require('../utils/logger');

// Check if system is initialized
exports.checkSetup = async (req, res) => {
    try {
        const settings = await CompanySettings.findOne();
        res.json({ initialized: !!settings });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Complete first-time setup
exports.completeSetup = async (req, res) => {
    try {
        const existing = await CompanySettings.findOne();
        if (existing) {
            return res.status(400).json({ message: 'System already initialized' });
        }

        const { companyName, logoBase64, logoMimeType, adminUsername, adminDisplayName, adminPassword, adminRole } = req.body;

        if (!companyName || !adminUsername || !adminDisplayName || !adminPassword) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Create admin user
        const user = new User({
            username: adminUsername.toLowerCase().trim(),
            password: adminPassword,
            displayName: adminDisplayName.trim(),
            role: adminRole === 'Admin' ? 'Admin' : 'IT Admin',
        });
        await user.save();

        // Generate TOTP secret for admin
        const secret = authenticator.generateSecret();
        const appLabel = `${companyName.trim()} IT Logger`;
        const otpAuthUrl = `otpauth://totp/${encodeURIComponent(appLabel)}:${encodeURIComponent(user.username)}?secret=${secret}&issuer=${encodeURIComponent(appLabel)}`;
        const qrDataUrl = await QRCode.toDataURL(otpAuthUrl);

        user.totpSecret = secret;
        user.totpEnrolled = true;
        user.totpEnabled = false;
        await user.save();

        // Save company settings
        const settings = new CompanySettings({
            companyName: companyName.trim(),
            logoBase64: logoBase64 || '',
            logoMimeType: logoMimeType || 'image/png',
            setupCompletedBy: user._id,
        });
        await settings.save();

        // Update user with setupCompletedBy
        await CompanySettings.findByIdAndUpdate(settings._id, { setupCompletedBy: user._id });

        res.status(201).json({
            message: 'Setup complete',
            qrDataUrl,
            totpSecret: secret,
            userId: user._id,
        });
    } catch (err) {
        logger.error(`Setup error: ${err.message}`);
        res.status(500).json({ message: 'Setup failed', error: err.message });
    }
};

// Confirm TOTP enrollment for setup user
exports.confirmSetupTotp = async (req, res) => {
    try {
        const { userId, token } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const isValid = authenticator.check(token, user.totpSecret);
        if (!isValid) return res.status(400).json({ message: 'Invalid TOTP code' });

        user.totpEnabled = true;
        user.totpEnrolled = true;

        // generate recovery codes for admin (returned once)
        const { plain, entries } = await createRecoveryCodes(10);
        user.totpRecoveryCodes = entries;
        await user.save();

        res.json({ message: 'TOTP enrolled successfully', recoveryCodes: plain });
    } catch (err) {
        logger.error(`TOTP confirm error: ${err.message}`);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get company settings (public - for branding)
exports.getCompanySettings = async (req, res) => {
    try {
        const settings = await CompanySettings.findOne().select('-__v');
        if (!settings) return res.status(404).json({ message: 'Not initialized' });
        res.json(settings);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Update company settings (admin only)
exports.updateCompanySettings = async (req, res) => {
    try {
        const { companyName, logoBase64, logoMimeType } = req.body;
        const settings = await CompanySettings.findOne();
        if (!settings) return res.status(404).json({ message: 'Not initialized' });

        if (companyName) settings.companyName = companyName.trim();
        if (logoBase64 !== undefined) settings.logoBase64 = logoBase64;
        if (logoMimeType) settings.logoMimeType = logoMimeType;
        await settings.save();

        res.json({ message: 'Settings updated', settings });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};
