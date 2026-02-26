import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { EmptyState, LoadingPage, Pagination } from '../components/UI';

export default function NotificationPage() {
    const toast = useToast();
    const [notifications, setNotifications] = useState([]);
    const [total, setTotal] = useState(0);
    const [unreadCount, setUnreadCount] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);

    const fetch = async (pg = 1) => {
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

    useEffect(() => { fetch(1); }, []);

    const markAllRead = async () => {
        try {
            await api.post('/notifications/mark-read', { ids: 'all' });
            toast.success('All notifications marked as read');
            fetch(page);
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
        totp_approved: 'Authenticator Change Approved',
        totp_rejected: 'Authenticator Change Rejected',
        incident_assigned: 'Incident Assigned',
        incident_resolved: 'Incident Resolved',
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
                    <div className="table-wrap mb-4">
                        <table>
                            <thead>
                                <tr>
                                    <th></th>
                                    <th>Type</th>
                                    <th>Title</th>
                                    <th>Message</th>
                                    <th>Received</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {notifications.map(notif => (
                                    <tr key={notif._id} style={{ cursor: 'default' }}>
                                        <td style={{ width: 8, padding: '8px 4px 8px 12px' }}>
                                            {!notif.isRead && (
                                                <div style={{ width: 6, height: 6, background: 'var(--accent)', borderRadius: '50%' }} />
                                            )}
                                        </td>
                                        <td className="text-xs text-muted">{TYPE_LABELS[notif.type] || notif.type}</td>
                                        <td className={`text-sm ${!notif.isRead ? 'font-bold' : ''}`}>{notif.title}</td>
                                        <td className="text-sm text-muted" style={{ maxWidth: 280 }}>
                                            <span className="truncate" style={{ display: 'block' }}>{notif.message}</span>
                                        </td>
                                        <td className="text-xs text-muted">{new Date(notif.createdAt).toLocaleString()}</td>
                                        <td>
                                            {!notif.isRead && (
                                                <button className="btn btn-secondary btn-sm" onClick={() => markRead(notif._id)}>
                                                    Mark Read
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Pagination page={page} totalPages={totalPages} onChange={p => { setPage(p); fetch(p); }} />
                </>
            )}
        </div>
    );
}
