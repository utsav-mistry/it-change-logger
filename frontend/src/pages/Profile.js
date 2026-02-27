import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/client';

export default function Profile() {
    const { user } = useAuth();
    const toast = useToast();
    const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [pwLoading, setPwLoading] = useState(false);
    const [totpLoading, setTotpLoading] = useState(false);
    const [recoveryCodes, setRecoveryCodes] = useState(null);
    const [profile, setProfile] = useState(null);

    const fetchProfile = async () => {
        try {
            const r = await api.get('/auth/profile');
            setProfile(r.data);
        } catch { }
    };

    useEffect(() => {
        fetchProfile();
    }, []);

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        if (passwords.newPassword !== passwords.confirmPassword) { toast.error('Passwords do not match'); return; }
        if (passwords.newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
        setPwLoading(true);
        try {
            await api.post('/users/change-password', {
                currentPassword: passwords.currentPassword,
                newPassword: passwords.newPassword,
            });
            toast.success('Password changed successfully');
            setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to change password');
        } finally {
            setPwLoading(false);
        }
    };

    const handleTotpRequest = async () => {
        setTotpLoading(true);
        try {
            const res = await api.post('/users/request-totp-change');
            if (res.data.qrDataUrl) {
                // For Admins/IT Admins, they might get a QR immediately. 
                // However, user requested QR ONLY in notifications.
                // But for self-reset, we can show it here or tell them to check notifications.
                // To be safe and follow "QR ONLY in notifications", let's tell them to check notifications even for self-reset.
                toast.success('Authenticator reset. Please check your Notifications for the new QR code.');
            } else {
                toast.success('Authenticator change request submitted. Awaiting admin approval.');
            }
        } catch (e) {
            toast.error(e.response?.data?.message || 'Request failed');
        } finally {
            setTotpLoading(false);
        }
    };

    const handleGenerateRecovery = async () => {
        try {
            const res = await api.post(`/users/${profile._id}/totp/recovery/generate`);
            if (res.data.recoveryCodes) {
                setRecoveryCodes(res.data.recoveryCodes);
                toast.success('Recovery codes generated — save them now.');
            } else {
                toast.success(res.data.message || 'Recovery codes generated');
            }
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to generate recovery codes');
        }
    };

    const initials = user?.displayName
        ? user.displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
        : '??';

    return (
        <div style={{ maxWidth: 680 }}>
            <div className="page-header">
                <div className="page-title">My Profile</div>
            </div>

            {/* Profile summary */}
            <div className="card mb-4">
                <div className="flex items-center gap-3">
                    <div className="avatar avatar-lg">{initials}</div>
                    <div style={{ flex: 1 }}>
                        <div className="font-bold" style={{ fontSize: 15 }}>{user?.displayName}</div>
                        <div className="text-muted text-sm">@{user?.username}</div>
                        {user?.email && <div className="text-secondary text-xs mt-1">{user.email}</div>}
                    </div>
                    <span className="badge badge-open">{user?.role}</span>
                </div>
                <div className="divider" />
                <div className="grid-2 text-sm">
                    <div>
                        <div className="info-item-label">Department</div>
                        <div className="info-item-value">{profile?.department?.name || 'Not assigned'}</div>
                    </div>
                    <div>
                        <div className="info-item-label">Last Login</div>
                        <div className="info-item-value">{profile?.lastLogin ? new Date(profile.lastLogin).toLocaleString() : '—'}</div>
                    </div>
                    <div>
                        <div className="info-item-label">Is Dept Head</div>
                        <div className="info-item-value">{profile?.isDepartmentHead ? 'Yes' : 'No'}</div>
                    </div>
                    {!(['Admin', 'IT Admin'].includes(profile?.role) || (profile?.department?.head && profile.department.head._id === profile._id)) && (
                        <div>
                            <div className="info-item-label">Reports To</div>
                            <div className="info-item-value">{profile?.department?.head?.displayName || '—'}</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Re-enrollment Notification Banner (No QR here) */}
            {profile?.mustChangeTOTP && (
                <div className="alert alert-warning mb-4" style={{ fontSize: 13 }}>
                    <strong>Action Required: Re-enroll your Authenticator</strong><br />
                    Your authenticator change was approved. Please go to your <strong>Notifications</strong> to scan the secure QR code.
                </div>
            )}

            {/* Change Password */}
            <div className="card mb-4">
                <div className="card-header">
                    <span className="card-title">Change Password</span>
                </div>
                <form onSubmit={handlePasswordChange}>
                    <div className="form-group">
                        <label className="form-label">Current Password</label>
                        <input type="password" className="form-control" required
                            value={passwords.currentPassword}
                            onChange={e => setPasswords(p => ({ ...p, currentPassword: e.target.value }))} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">New Password (min 8 characters)</label>
                        <input type="password" className="form-control" required minLength={8}
                            value={passwords.newPassword}
                            onChange={e => setPasswords(p => ({ ...p, newPassword: e.target.value }))} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Confirm New Password</label>
                        <input type="password" className="form-control" required
                            value={passwords.confirmPassword}
                            onChange={e => setPasswords(p => ({ ...p, confirmPassword: e.target.value }))} />
                    </div>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={pwLoading}>
                        {pwLoading ? <span className="spinner" /> : null}
                        Change Password
                    </button>
                </form>
            </div>

            {/* Authenticator Request */}
            <div className="card">
                <div className="card-header">
                    <span className="card-title">Authenticator App</span>
                </div>
                <p className="text-secondary mb-4" style={{ fontSize: 13 }}>
                    {user?.role === 'Admin' || user?.role === 'IT Admin'
                        ? 'You can reset your authenticator directly. A new QR code will be generated in your Notifications.'
                        : 'Changing your authenticator requires approval from an Admin, IT Admin, or your Department Head.'}
                </p>

                <button className="btn btn-secondary btn-sm" onClick={handleTotpRequest} disabled={totpLoading}>
                    {totpLoading ? <span className="spinner" /> : null}
                    {user?.role === 'Admin' || user?.role === 'IT Admin'
                        ? 'Reset Authenticator'
                        : 'Request Authenticator Change'}
                </button>
                <button className="btn btn-outline btn-sm" style={{ marginLeft: 8 }} onClick={handleGenerateRecovery}>Generate Recovery Codes</button>

                {recoveryCodes && (
                    <div style={{ marginTop: 12 }}>
                        <div className="alert alert-info" style={{ textAlign: 'left' }}>
                            Recovery codes — store them securely. Each code can be used once.
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 12 }}>
                            {recoveryCodes.map(c => (
                                <div key={c} className="card" style={{ padding: 10, fontFamily: 'monospace', textAlign: 'center' }}>{c}</div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
