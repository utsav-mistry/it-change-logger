import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/client';

export default function Profile() {
    const { user, refreshUser } = useAuth();
    const toast = useToast();
    const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [pwLoading, setPwLoading] = useState(false);
    const [totpLoading, setTotpLoading] = useState(false);
    const [totpQrData, setTotpQrData] = useState(null);
    const [profile, setProfile] = useState(null);

    useEffect(() => {
        api.get('/auth/profile').then(r => setProfile(r.data)).catch(() => { });
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
                setTotpQrData(res.data.qrDataUrl);
                toast.success('New authenticator QR code generated. Scan and log in to enroll.');
            } else {
                toast.success('Authenticator change request submitted. Awaiting admin approval.');
            }
        } catch (e) {
            toast.error(e.response?.data?.message || 'Request failed');
        } finally {
            setTotpLoading(false);
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
                        <div className="info-item-value">{profile?.lastLogin ? new Date(profile.lastLogin).toLocaleString() : 'Not recorded'}</div>
                    </div>
                    <div>
                        <div className="info-item-label">TOTP Status</div>
                        <div className="info-item-value">
                            {user?.totpEnrolled
                                ? <span className="badge badge-resolved">Enrolled</span>
                                : <span className="badge badge-onhold">Not enrolled</span>}
                        </div>
                    </div>
                    <div>
                        <div className="info-item-label">Department Head</div>
                        <div className="info-item-value">{user?.isDepartmentHead ? 'Yes' : 'No'}</div>
                    </div>
                </div>
            </div>

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

            {/* Authenticator */}
            <div className="card">
                <div className="card-header">
                    <span className="card-title">Authenticator App</span>
                </div>
                <p className="text-secondary mb-4" style={{ fontSize: 13 }}>
                    {user?.role === 'Admin' || user?.role === 'IT Admin'
                        ? 'You can reset your authenticator directly. A new QR code will be generated.'
                        : 'Changing your authenticator requires approval from an Admin, IT Admin, or your Department Head.'}
                </p>

                {totpQrData && (
                    <div className="mb-4">
                        <div className="alert alert-success mb-3">
                            Scan this QR code with your authenticator app. You must log out and log back in to complete enrollment.
                        </div>
                        <div className="qr-wrap">
                            <img src={totpQrData} alt="Authenticator QR Code" width={180} height={180} />
                        </div>
                    </div>
                )}

                <button className="btn btn-secondary btn-sm" onClick={handleTotpRequest} disabled={totpLoading}>
                    {totpLoading ? <span className="spinner" /> : null}
                    {user?.role === 'Admin' || user?.role === 'IT Admin'
                        ? 'Reset Authenticator'
                        : 'Request Authenticator Change'}
                </button>
            </div>
        </div>
    );
}
