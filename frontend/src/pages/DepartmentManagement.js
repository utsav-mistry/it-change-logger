import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { Modal, EmptyState, LoadingPage } from '../components/UI';

export default function DepartmentManagement() {
    const toast = useToast();
    const [departments, setDepartments] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editDept, setEditDept] = useState(null);
    const [form, setForm] = useState({ name: '', description: '', headUserId: '' });

    const fetchAll = async () => {
        setLoading(true);
        const [d, u] = await Promise.all([
            api.get('/departments').catch(() => ({ data: [] })),
            api.get('/users?limit=200&isActive=true').catch(() => ({ data: { users: [] } })),
        ]);
        setDepartments(d.data);
        setUsers(u.data.users || []);
        setLoading(false);
    };

    useEffect(() => { fetchAll(); }, []);

    const openCreate = () => {
        setEditDept(null);
        setForm({ name: '', description: '', headUserId: '' });
        setShowModal(true);
    };

    const openEdit = (dept) => {
        setEditDept(dept);
        setForm({ name: dept.name, description: dept.description, headUserId: dept.head?._id || '' });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editDept) {
                await api.put(`/departments/${editDept._id}`, form);
                toast.success('Department updated');
            } else {
                await api.post('/departments', form);
                toast.success('Department created');
            }
            setShowModal(false);
            fetchAll();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Deactivate this department?')) return;
        try {
            await api.delete(`/departments/${id}`);
            toast.success('Department deactivated');
            fetchAll();
        } catch (e) {
            toast.error('Failed');
        }
    };

    return (
        <div className="animate-fadeIn">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1>Departments</h1>
                    <p className="text-secondary mt-1">Manage departments and department heads</p>
                </div>
                <button className="btn btn-primary" onClick={openCreate}>+ New Department</button>
            </div>

            {loading ? <LoadingPage /> : departments.length === 0 ? <EmptyState title="No departments" description="Create your first department" /> : (
                <div className="grid-3">
                    {departments.map(dept => (
                        <div key={dept._id} className="card">
                            <div style={{ marginBottom: 12 }}>
                                <h3 style={{ fontSize: 16 }}>🏢 {dept.name}</h3>
                                {dept.description && <p className="text-sm text-muted mt-1">{dept.description}</p>}
                            </div>
                            <div style={{ padding: '8px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
                                <div className="text-xs text-muted mb-1">Department Head</div>
                                <div className="flex items-center gap-2">
                                    {dept.head ? (
                                        <>
                                            <div className="avatar avatar-sm">{dept.head.displayName[0]}</div>
                                            <div>
                                                <div className="text-sm font-medium text-primary">{dept.head.displayName}</div>
                                                <div className="text-xs text-muted">@{dept.head.username}</div>
                                            </div>
                                        </>
                                    ) : (
                                        <span className="text-muted text-sm">No head assigned</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button className="btn btn-secondary btn-sm flex-1" onClick={() => openEdit(dept)}>Edit</button>
                                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(dept._id)}>✕</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <Modal title={editDept ? 'Edit Department' : 'New Department'} onClose={() => setShowModal(false)}>
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Department Name *</label>
                            <input className="form-control" required value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label>Description</label>
                            <textarea className="form-control" rows={3} value={form.description}
                                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label>Department Head</label>
                            <select className="form-control" value={form.headUserId}
                                onChange={e => setForm(f => ({ ...f, headUserId: e.target.value }))}>
                                <option value="">— None —</option>
                                {users.map(u => (
                                    <option key={u._id} value={u._id}>{u.displayName} (@{u.username})</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex gap-3 mt-4">
                            <button type="submit" className="btn btn-primary flex-1">
                                {editDept ? 'Save' : 'Create'}
                            </button>
                            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
}
