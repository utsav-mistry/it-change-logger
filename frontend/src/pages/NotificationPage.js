import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { EmptyState, LoadingPage, Pagination } from '../components/UI';

export default function NotificationPage() {
    const toast = useToast();
    const { logout } = useAuth();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [total, setTotal] = useState(0);
    const [unreadCount, setUnreadCount] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [expandedNotif, setExpandedNotif] = useState(null);
    const [activeQr, setActiveQr] = useState(null);
    const [qrLoading, setQrLoading] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);

    const fetchNotifs = async (pg = 1) => {
        setLoading(true);
        try {
            const res = await api.get(`/notifications?page=${pg}&limit=25`);
            setNotifications(res.data.notifications);
            setTotal(res.data.total);
            setUnreadCount(res.data.unreadCount);
            setTotalPages(res.data.totalPages);
        } catch { }
        setLoading(false);
    };

    useEffect(() => { fetchNotifs(1); }, []);

    const markAllRead = async () => {
        try {
            await api.post('/notifications/mark-read', { ids: 'all' });
            toast.success('All notifications marked as read');
            fetchNotifs(page);
        } catch { }
    };

    const markRead = async (id) => {
        try {
            await api.post('/notifications/mark-read', { ids: [id] });
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
            setUnreadCount(c => Math.max(0, c - 1));
        } catch { }
    };

    const TYPE_LABELS = {
        totp_approval_request: 'Authenticator Change Request',
        totp_approved: 'Authenticator Approved',
        totp_rejected: 'Authenticator Rejected',
        incident_assigned: 'Incident Assigned',
        incident_resolved: 'Incident Resolved',
    };

    useEffect(() => {
        if (timeLeft > 0) {
            const t = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
            return () => clearTimeout(t);
        } else if (timeLeft === 0 && activeQr) {
            setActiveQr(null);
            toast.info('QR code entry expired for security');
        }
    }, [timeLeft, activeQr]);

    const handleFetchApprovedQr = async () => {
        setQrLoading(true);
        try {
            const res = await api.get('/users/totp-approved-qr');
            if (res.data.qrDataUrl) {
                setActiveQr(res.data.qrDataUrl);
                setTimeLeft(10);
                toast.success('QR Code visible for 10 seconds');
            }
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to fetch QR');
        } finally {
            setQrLoading(false);
        }
    };

    const toggleExpand = (id) => {
        setExpandedNotif(prev => prev === id ? null : id);
        setActiveQr(null);
        setTimeLeft(0);
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <div className="page-title">Notifications</div>
                    <div className="page-sub">{unreadCount} unread</div>
                </div>
                {unreadCount > 0 && (
                    <button className="btn btn-secondary btn-sm" onClick={markAllRead}>Mark All Read</button>
                )}
            </div>

            {loading ? <LoadingPage /> : notifications.length === 0 ? (
                <EmptyState title="No notifications" description="Nothing to show." />
            ) : (
                <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                        {notifications.map(notif => {
                            const isExpanded = expandedNotif === notif._id;
                            const isApproval = notif.type === 'totp_approved';
                            const isRejection = notif.type === 'totp_rejected';
                            const hasQr = isApproval && notif.data?.qrDataUrl;
                            // rejection: show expand if there's a review note
                            const hasNote = isRejection && notif.data?.note;

                            return (
                                <div key={notif._id} style={{
                                    background: 'var(--bg-card)',
                                    border: `1px solid ${!notif.isRead ? 'var(--accent)' : 'var(--border)'}`,
                                    borderRadius: 'var(--radius)',
                                    overflow: 'hidden',
                                    transition: 'border-color 0.2s',
                                }}>
                                    {/* Main row */}
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px' }}>
                                        {/* Unread dot */}
                                        <div style={{ paddingTop: 6, flexShrink: 0 }}>
                                            {!notif.isRead
                                                ? <div style={{ width: 8, height: 8, background: 'var(--accent)', borderRadius: '50%' }} />
                                                : <div style={{ width: 8, height: 8 }} />}
                                        </div>

                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                    {TYPE_LABELS[notif.type] || notif.type}
                                                </span>
                                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                    &bull; {new Date(notif.createdAt).toLocaleString()}
                                                </span>
                                            </div>
                                            <div style={{ fontWeight: notif.isRead ? 400 : 600, fontSize: 14, marginBottom: 3 }}>
                                                {notif.title}
                                            </div>
                                            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                                {notif.message}
                                            </div>
                                        </div>

                                        {/* Action buttons */}
                                        <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                                            {(isApproval || hasNote) && (
                                                <button
                                                    className={`btn btn-sm ${isExpanded ? 'btn-primary' : 'btn-secondary'}`}
                                                    onClick={() => { toggleExpand(notif._id); if (!notif.isRead) markRead(notif._id); }}
                                                >
                                                    {isApproval
                                                        ? (isExpanded ? 'Hide' : 'Show QR Code')
                                                        : (isExpanded ? 'Hide' : 'View Reason')}
                                                </button>
                                            )}
                                            {!notif.isRead && (
                                                <button className="btn btn-secondary btn-sm" onClick={() => markRead(notif._id)}>
                                                    Mark Read
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* ── Expanded: QR code panel for totp_approved ── */}
                                    {isExpanded && isApproval && (
                                        <div style={{
                                            borderTop: '1px solid var(--border)',
                                            padding: '20px 24px',
                                            background: 'var(--bg-surface)',
                                            textAlign: 'center',
                                        }}>
                                            <div className="alert alert-warning" style={{ textAlign: 'left', marginBottom: 20, fontSize: 13 }}>
                                                <strong>Action Required &mdash; Secure Scannable QR</strong><br />
                                                Your authenticator change was approved.
                                                {!activeQr ? (
                                                    <div className="mt-2">
                                                        <button
                                                            className="btn btn-primary"
                                                            onClick={handleFetchApprovedQr}
                                                            disabled={qrLoading}
                                                        >
                                                            {qrLoading ? <span className="spinner" /> : null}
                                                            Show QR Code (10s Timer)
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="mt-2 font-bold" style={{ color: 'var(--danger)' }}>
                                                        QR visible for: {timeLeft}s
                                                    </div>
                                                )}
                                            </div>

                                            {activeQr && (
                                                <div style={{
                                                    display: 'inline-block',
                                                    padding: 14,
                                                    background: '#ffffff',
                                                    borderRadius: 'var(--radius)',
                                                    boxShadow: '0 2px 16px rgba(0,0,0,0.15)',
                                                    marginBottom: 20,
                                                }}>
                                                    <img src={activeQr} alt="New Authenticator QR" width={200} height={200} />
                                                </div>
                                            )}

                                            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                                                <button
                                                    className="btn btn-primary"
                                                    onClick={() => { if (logout) logout(); navigate('/login'); }}
                                                >
                                                    Log Out &amp; Re-enroll Now
                                                </button>
                                                <button className="btn btn-secondary" onClick={() => navigate('/profile')}>
                                                    Go to Profile
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Expanded: rejection reason ── */}
                                    {isExpanded && hasNote && (
                                        <div style={{
                                            borderTop: '1px solid var(--border)',
                                            padding: '14px 24px',
                                            background: 'var(--bg-surface)',
                                        }}>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Admin reason:</div>
                                            <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{notif.data.note}</div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <Pagination page={page} totalPages={totalPages} onChange={p => { setPage(p); fetchNotifs(p); }} />
                </>
            )}
        </div>
    );
}
