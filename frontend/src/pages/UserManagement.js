import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { Modal, EmptyState, LoadingPage, Pagination } from '../components/UI';

export default function UserManagement() {
    const toast = useToast();
    const [users, setUsers] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editUser, setEditUser] = useState(null);
    const [totpRequests, setTotpRequests] = useState([]);

    const [form, setForm] = useState({
        username: '', displayName: '', email: '', password: '', role: 'IT Admin', department: '',
    });

    const fetchUsers = async (pg = 1) => {
        setLoading(true);
        try {
            const res = await api.get('/users', { params: { page: pg, limit: 20, search } });
            setUsers(res.data.users);
            setTotal(res.data.total);
            setTotalPages(res.data.totalPages);
        } catch { }
        setLoading(false);
    };

    useEffect(() => {
        fetchUsers(1);
        api.get('/departments').then(r => setDepartments(r.data)).catch(() => { });
        api.get('/users/totp-requests?status=pending').then(r => setTotpRequests(r.data)).catch(() => { });
    }, [search]);

    const openCreate = () => {
        setEditUser(null);
        setForm({ username: '', displayName: '', email: '', password: '', role: 'IT Admin', department: '' });
        setShowModal(true);
    };

    const openEdit = (user) => {
        setEditUser(user);
        setForm({
            username: user.username,
            displayName: user.displayName,
            email: user.email || '',
            password: '',
            role: user.role,
            department: user.department?._id || '',
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editUser) {
                await api.put(`/users/${editUser._id}`, { displayName: form.displayName, email: form.email, role: form.role, department: form.department || null });
                toast.success('User updated');
            } else {
                await api.post('/users', form);
                toast.success('User created');
            }
            setShowModal(false);
            fetchUsers(page);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed');
        }
    };

    const handleDeactivate = async (userId) => {
        if (!window.confirm('Deactivate this user?')) return;
        try {
            await api.delete(`/users/${userId}`);
            toast.success('User deactivated');
            fetchUsers(page);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed');
        }
    };

    const handleTotpReview = async (requestId, action) => {
        try {
            await api.post(`/users/totp-requests/${requestId}/review`, { action });
            toast.success(`Request ${action}d`);
            setTotpRequests(prev => prev.filter(r => r._id !== requestId));
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed');
        }
    };

    return (
        <div className="animate-fadeIn">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1>User Management</h1>
                    <p className="text-secondary mt-1">{total} users total</p>
                </div>
                <button className="btn btn-primary" onClick={openCreate}>+ New User</button>
            </div>

            {/* TOTP Change Requests */}
            {totpRequests.length > 0 && (
                <div className="card mb-6">
                    <div className="card-header">
                        <h3>🔑 Pending Authenticator Change Requests</h3>
                        <span className="badge badge-open">{totpRequests.length} pending</span>
                    </div>
                    {totpRequests.map(req => (
                        <div key={req._id} style={{
                            padding: '12px 16px', borderBottom: '1px solid var(--border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                            <div>
                                <strong>{req.requestedBy?.displayName}</strong>
                                <span className="text-muted text-sm" style={{ marginLeft: 8 }}>@{req.requestedBy?.username}</span>
                                <div className="text-sm text-muted mt-1">Requested {new Date(req.createdAt).toLocaleString()}</div>
                            </div>
                            <div className="flex gap-2">
                                <button className="btn btn-success btn-sm" onClick={() => handleTotpReview(req._id, 'approve')}>Approve</button>
                                <button className="btn btn-danger btn-sm" onClick={() => handleTotpReview(req._id, 'reject')}>Reject</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Search */}
            <div className="filter-bar mb-4">
                <div className="search-bar" style={{ flex: 1 }}>
                    <span className="search-icon">🔍</span>
                    <input className="form-control" placeholder="Search users..."
                        value={search} onChange={e => setSearch(e.target.value)} />
                </div>
            </div>

            {loading ? <LoadingPage /> : users.length === 0 ? <EmptyState title="No users found" /> : (
                <>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Username</th>
                                    <th>Role</th>
                                    <th>Department</th>
                                    <th>TOTP</th>
                                    <th>Status</th>
                                    <th>Last Login</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u._id}>
                                        <td className="font-medium">{u.displayName}</td>
                                        <td className="font-mono text-muted">@{u.username}</td>
                                        <td><span className="badge badge-open">{u.role}</span></td>
                                        <td className="text-muted">{u.department?.name || '—'}</td>
                                        <td>
                                            {u.totpEnrolled
                                                ? <span className="badge badge-resolved">Enrolled</span>
                                                : <span className="badge badge-onhold">Pending</span>}
                                        </td>
                                        <td>
                                            {u.isActive
                                                ? <span className="badge badge-resolved">Active</span>
                                                : <span className="badge badge-archived">Inactive</span>}
                                        </td>
                                        <td className="text-muted text-sm">
                                            {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}
                                        </td>
                                        <td>
                                            <div className="flex gap-2">
                                                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(u)}>Edit</button>
                                                {u.isActive && (
                                                    <button className="btn btn-danger btn-sm" onClick={() => handleDeactivate(u._id)}>
                                                        Deactivate
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Pagination page={page} totalPages={totalPages} onChange={p => { setPage(p); fetchUsers(p); }} />
                </>
            )}

            {showModal && (
                <Modal title={editUser ? 'Edit User' : 'Create User'} onClose={() => setShowModal(false)}>
                    <form onSubmit={handleSubmit}>
                        {!editUser && (
                            <div className="form-group">
                                <label>Username *</label>
                                <input className="form-control" placeholder="username" required
                                    value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
                            </div>
                        )}
                        <div className="form-group">
                            <label>Display Name *</label>
                            <input className="form-control" placeholder="Full Name" required
                                value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label>Email</label>
                            <input className="form-control" type="email" placeholder="email@company.com"
                                value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                        </div>
                        {!editUser && (
                            <div className="form-group">
                                <label>Password * (min 8 chars)</label>
                                <input className="form-control" type="password" required minLength={8}
                                    value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                            </div>
                        )}
                        <div className="form-group">
                            <label>Role</label>
                            <select className="form-control" value={form.role}
                                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                                <option>Admin</option>
                                <option>IT Admin</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Department</label>
                            <select className="form-control" value={form.department}
                                onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
                                <option value="">— None —</option>
                                {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                            </select>
                        </div>
                        <div className="flex gap-3 mt-4">
                            <button type="submit" className="btn btn-primary flex-1">
                                {editUser ? 'Save Changes' : 'Create User'}
                            </button>
                            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
}
