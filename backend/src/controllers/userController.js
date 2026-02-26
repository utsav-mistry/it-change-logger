const User = require('../models/User');
const Department = require('../models/Department');
const Notification = require('../models/Notification');
const AuthenticatorChangeRequest = require('../models/AuthenticatorChangeRequest');
const { totp } = require('otplib');
const QRCode = require('qrcode');
const logger = require('../utils/logger');

// List all users
exports.listUsers = async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '', isActive } = req.query;
        const query = {};
        if (search) {
            query.$or = [
                { username: { $regex: search, $options: 'i' } },
                { displayName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        }
        if (isActive !== undefined) query.isActive = isActive === 'true';

        const total = await User.countDocuments(query);
        const users = await User.find(query)
            .select('-password -totpSecret')
            .populate('department', 'name')
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        res.json({ users, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Get single user
exports.getUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password -totpSecret').populate('department', 'name');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Create user
exports.createUser = async (req, res) => {
    try {
        const { username, password, displayName, email, role, department } = req.body;
        if (!username || !password || !displayName) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const existing = await User.findOne({ username: username.toLowerCase().trim() });
        if (existing) return res.status(409).json({ message: 'Username already taken' });

        // Generate TOTP secret
        const secret = totp.generateSecret();

        const user = new User({
            username: username.toLowerCase().trim(),
            password,
            displayName: displayName.trim(),
            email: email ? email.toLowerCase().trim() : '',
            role: role || 'IT Admin',
            department: department || null,
            totpSecret: secret,
            totpEnabled: false,
            totpEnrolled: false,
            createdBy: req.user.userId,
        });
        await user.save();

        res.status(201).json({
            message: 'User created',
            userId: user._id,
            username: user.username,
            displayName: user.displayName,
        });
    } catch (err) {
        logger.error(`Create user error: ${err.message}`);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// Update user (admin only, cannot update own role)
exports.updateUser = async (req, res) => {
    try {
        const { displayName, email, role, department, isActive, isDepartmentHead } = req.body;
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (displayName) user.displayName = displayName.trim();
        if (email !== undefined) user.email = email.toLowerCase().trim();
        if (role) user.role = role;
        if (department !== undefined) user.department = department || null;
        if (isActive !== undefined) user.isActive = isActive;
        if (isDepartmentHead !== undefined) user.isDepartmentHead = isDepartmentHead;

        await user.save();

        // Update department head ref if needed
        if (isDepartmentHead && department) {
            await Department.findByIdAndUpdate(department, { head: user._id });
        }

        res.json({ message: 'User updated' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Deactivate user
exports.deactivateUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user._id.toString() === req.user.userId) {
            return res.status(400).json({ message: 'Cannot deactivate your own account' });
        }
        user.isActive = false;
        await user.save();
        res.json({ message: 'User deactivated' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Request TOTP change (for regular users wanting to change their authenticator)
exports.requestTotpChange = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Admin/IT Admin can change their own without approval
        if (user.role === 'Admin' || user.role === 'IT Admin') {
            const secret = totp.generateSecret();
            const otpAuthUrl = `otpauth://totp/IT-Logger:${user.username}?secret=${secret}&issuer=IT-Logger`;
            const qrDataUrl = await QRCode.toDataURL(otpAuthUrl);

            user.totpSecret = secret;
            user.totpEnabled = false;
            user.totpEnrolled = false;
            await user.save();

            return res.json({ qrDataUrl, secret, message: 'New TOTP ready. Please re-enroll.' });
        }

        // Check pending request
        const pending = await AuthenticatorChangeRequest.findOne({ requestedBy: user._id, status: 'pending' });
        if (pending) {
            return res.status(409).json({ message: 'Pending TOTP change request already exists' });
        }

        const secret = totp.generateSecret();
        const otpAuthUrl = `otpauth://totp/IT-Logger:${user.username}?secret=${secret}&issuer=IT-Logger`;
        const qrDataUrl = await QRCode.toDataURL(otpAuthUrl);

        const changeReq = new AuthenticatorChangeRequest({
            requestedBy: user._id,
            newTotpSecret: secret,
            newTotpQr: qrDataUrl,
        });
        await changeReq.save();

        // Notify all admins and department head
        const admins = await User.find({ role: { $in: ['Admin', 'IT Admin'] }, isActive: true, _id: { $ne: user._id } });
        for (const admin of admins) {
            await Notification.create({
                recipient: admin._id,
                type: 'totp_approval_request',
                title: 'TOTP Change Request',
                message: `${user.displayName} has requested an authenticator change.`,
                data: { requestId: changeReq._id, userId: user._id },
            });
        }

        // If user has a department head
        if (user.department) {
            const dept = await Department.findById(user.department).populate('head');
            if (dept && dept.head && dept.head._id.toString() !== user._id.toString()) {
                const alreadyNotified = admins.find(a => a._id.toString() === dept.head._id.toString());
                if (!alreadyNotified) {
                    await Notification.create({
                        recipient: dept.head._id,
                        type: 'totp_approval_request',
                        title: 'TOTP Change Request',
                        message: `${user.displayName} has requested an authenticator change.`,
                        data: { requestId: changeReq._id, userId: user._id },
                    });
                }
            }
        }

        res.status(201).json({ message: 'TOTP change request submitted. Awaiting approval.' });
    } catch (err) {
        logger.error(`TOTP change request error: ${err.message}`);
        res.status(500).json({ message: 'Server error' });
    }
};

// List TOTP change requests (admin view)
exports.listTotpRequests = async (req, res) => {
    try {
        const { status = 'pending' } = req.query;
        const requests = await AuthenticatorChangeRequest.find({ status })
            .populate('requestedBy', 'username displayName department')
            .populate('reviewedBy', 'username displayName')
            .sort({ createdAt: -1 });
        res.json(requests);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Approve/reject TOTP change
exports.reviewTotpRequest = async (req, res) => {
    try {
        const { action, note } = req.body; // action: 'approve' | 'reject'
        const changeReq = await AuthenticatorChangeRequest.findById(req.params.id).populate('requestedBy');
        if (!changeReq) return res.status(404).json({ message: 'Request not found' });
        if (changeReq.status !== 'pending') return res.status(400).json({ message: 'Request already resolved' });

        const reviewer = await User.findById(req.user.userId);
        const requestor = changeReq.requestedBy;

        // Check if reviewer is authorized
        const isAdmin = reviewer.role === 'Admin' || reviewer.role === 'IT Admin';
        const isDeptHead = reviewer.isDepartmentHead && requestor.department &&
            reviewer.department?.toString() === requestor.department?.toString();

        if (!isAdmin && !isDeptHead) {
            return res.status(403).json({ message: 'Not authorized to review this request' });
        }

        changeReq.status = action === 'approve' ? 'approved' : 'rejected';
        changeReq.reviewedBy = reviewer._id;
        changeReq.reviewedAt = new Date();
        changeReq.reviewNote = note || '';
        await changeReq.save();

        if (action === 'approve') {
            const user = await User.findById(requestor._id);
            user.totpSecret = changeReq.newTotpSecret;
            user.totpEnabled = false;
            user.totpEnrolled = false;
            user.mustChangeTOTP = true;
            await user.save();

            await Notification.create({
                recipient: requestor._id,
                type: 'totp_approved',
                title: 'Authenticator Change Approved',
                message: 'Your authenticator change request has been approved. Please re-enroll.',
                data: { requestId: changeReq._id, qrDataUrl: changeReq.newTotpQr },
            });
        } else {
            await Notification.create({
                recipient: requestor._id,
                type: 'totp_rejected',
                title: 'Authenticator Change Rejected',
                message: `Your authenticator change request was rejected. ${note || ''}`,
                data: { requestId: changeReq._id },
            });
        }

        res.json({ message: `Request ${action}d` });
    } catch (err) {
        logger.error(`Review TOTP request error: ${err.message}`);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get TOTP QR for approved change (for the user themselves)
exports.getApprovedTotpQr = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user.mustChangeTOTP) {
            return res.status(400).json({ message: 'No pending TOTP re-enrollment' });
        }
        const changeReq = await AuthenticatorChangeRequest.findOne({
            requestedBy: user._id,
            status: 'approved'
        }).sort({ createdAt: -1 });

        if (!changeReq) return res.status(404).json({ message: 'No approved request found' });

        res.json({ qrDataUrl: changeReq.newTotpQr, secret: user.totpSecret });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Change own password
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const valid = await user.comparePassword(currentPassword);
        if (!valid) return res.status(401).json({ message: 'Current password is incorrect' });

        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({ message: 'New password must be at least 8 characters' });
        }

        user.password = newPassword;
        await user.save();
        res.json({ message: 'Password changed' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};
