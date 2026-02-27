const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    displayName: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    role: { type: String, enum: ['Admin', 'IT Admin', 'User'], default: 'User' },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    isDepartmentHead: { type: Boolean, default: false },
    totpSecret: { type: String, default: null },
    totpEnabled: { type: Boolean, default: false },
    totpEnrolled: { type: Boolean, default: false },
    totpRecoveryCodes: [{
        codeHash: { type: String },
        createdAt: { type: Date, default: Date.now },
        usedAt: { type: Date, default: null },
    }],
    isActive: { type: Boolean, default: true },
    mustChangeTOTP: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    lastLogin: { type: Date, default: null },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

userSchema.methods.comparePassword = async function (plainPassword) {
    return bcrypt.compare(plainPassword, this.password);
};

// unique constraint on username already creates an index
userSchema.index({ department: 1 });
userSchema.index({ role: 1 });

module.exports = mongoose.model('User', userSchema);
