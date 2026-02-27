import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { LoadingPage, Spinner, formatDateTime } from '../components/UI';

export default function WorkLogAdmin() {
    const toast = useToast();
    const [logs, setLogs] = useState([]);
    const [users, setUsers] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(null);
    const [expandedId, setExpandedId] = useState(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    const [filters, setFilters] = useState({
        userId: '', department: '', date: '', from: '', to: '',
    });

    useEffect(() => {
        api.get('/users?limit=200&isActive=true').then(r => setUsers(r.data.users || [])).catch(() => { });
        api.get('/departments').then(r => setDepartments(r.data)).catch(() => { });
    }, []);

    const fetchLogs = async (pg = 1) => {
        setLoading(true);
        try {
            const params = { page: pg, limit: 30, ...filters };
            Object.keys(params).forEach(k => !params[k] && delete params[k]);
            const res = await api.get('/worklogs/admin/all', { params });
            setLogs(res.data.logs);
            setTotal(res.data.total);
            setTotalPages(res.data.totalPages);
        } catch { }
        setLoading(false);
    };

    useEffect(() => {
        const t = setTimeout(() => fetchLogs(1), 300);
        return () => clearTimeout(t);
    }, [filters]);

    const setFilter = (k, v) => {
        setFilters(f => ({ ...f, [k]: v }));
        setPage(1);
    };

    const clearFilters = () => {
        setFilters({ userId: '', department: '', date: '', from: '', to: '' });
        setPage(1);
    };

    const exportLogs = async (format) => {
        if (!filters.from || !filters.to) {
            toast.error('Select a date range (From / To) before exporting');
            return;
        }
        setExporting(format);
        try {
            const params = { from: filters.from, to: filters.to };
            if (filters.userId) params.userId = filters.userId;
            if (filters.department) params.department = filters.department;
            const res = await api.get(`/worklogs/admin/export/${format.toLowerCase()}`, {
                params,
                responseType: 'blob',
            });
            const url = URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `worklogs-${filters.from}-${filters.to}.${format.toLowerCase()}`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success(`${format} exported`);
        } catch {
            toast.error(`${format} export failed`);
        } finally {
            setExporting(null);
        }
    };

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div>
                    <div className="page-title">All Work Logs</div>
                    <div className="page-sub">{total} total entries</div>
                </div>
                <div className="flex gap-2">
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => exportLogs('CSV')}
                        disabled={exporting === 'CSV'}
                    >
                        {exporting === 'CSV' ? <Spinner /> : null}
                        Export CSV
                    </button>
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => exportLogs('PDF')}
                        disabled={exporting === 'PDF'}
                    >
                        {exporting === 'PDF' ? <Spinner /> : null}
                        Export PDF
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="filter-bar mb-4">
                <div className="form-group">
                    <label className="form-label">User</label>
                    <select className="form-control" value={filters.userId} onChange={e => setFilter('userId', e.target.value)}>
                        <option value="">All Users</option>
                        {users.map(u => (
                            <option key={u._id} value={u._id}>{u.displayName} (@{u.username})</option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">Department</label>
                    <select className="form-control" value={filters.department} onChange={e => setFilter('department', e.target.value)}>
                        <option value="">All Departments</option>
                        {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">Exact Date</label>
                    <input type="date" className="form-control" value={filters.date}
                        onChange={e => setFilter('date', e.target.value)} />
                </div>
                <div className="form-group">
                    <label className="form-label">From Date</label>
                    <input type="date" className="form-control" value={filters.from}
                        onChange={e => setFilter('from', e.target.value)} />
                </div>
                <div className="form-group">
                    <label className="form-label">To Date</label>
                    <input type="date" className="form-control" value={filters.to}
                        onChange={e => setFilter('to', e.target.value)} />
                </div>
                <div className="form-group" style={{ justifyContent: 'flex-end' }}>
                    <label className="form-label">&nbsp;</label>
                    <button className="btn btn-secondary btn-sm" onClick={clearFilters}>Clear</button>
                </div>
            </div>

            {loading ? <LoadingPage /> : (
                <>
                    <div className="table-wrap mb-4">
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Employee</th>
                                    <th>Department</th>
                                    <th>Dept Head</th>
                                    <th>Submitted At</th>
                                    <th>Status</th>
                                    <th>Preview</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                                            No work logs found for the selected filters.
                                        </td>
                                    </tr>
                                ) : logs.map(log => (
                                    <React.Fragment key={log._id}>
                                        <tr>
                                            <td className="font-mono text-sm">{log.date}</td>
                                            <td>
                                                <div className="font-medium">{log.employee?.displayName || '—'}</div>
                                                <div className="text-xs text-muted">@{log.employee?.username}</div>
                                            </td>
                                            <td className="text-muted text-sm">{log.employee?.department?.name || '—'}</td>
                                            <td className="text-muted text-sm">
                                                {(['Admin', 'IT Admin'].includes(log.employee?.role) || (log.employee?.department?.head && log.employee.department.head._id === log.employee._id))
                                                    ? '—' : (log.employee?.department?.head?.displayName || '—')}
                                            </td>
                                            <td className="text-sm text-muted">
                                                {log.submittedAt ? new Date(log.submittedAt).toLocaleString() : '—'}
                                            </td>
                                            <td>
                                                {log.isSubmitted
                                                    ? <span className="badge badge-resolved">Submitted</span>
                                                    : <span className="badge badge-onhold">Draft</span>}
                                            </td>
                                            <td className="text-sm text-muted">
                                                <span className="truncate" style={{ display: 'block', maxWidth: 220 }}>
                                                    {(log.content || '').replace(/<[^>]+>/g, '').slice(0, 80) || '(empty)'}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <button
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={() => setExpandedId(expandedId === log._id ? null : log._id)}
                                                    >
                                                        {expandedId === log._id ? 'Collapse' : 'View'}
                                                    </button>
                                                    {!log.isSubmitted && confirmDeleteId !== log._id && (
                                                        <button className="btn btn-outline btn-sm" onClick={() => setConfirmDeleteId(log._id)}>
                                                            Delete
                                                        </button>
                                                    )}
                                                    {!log.isSubmitted && confirmDeleteId === log._id && (
                                                        <>
                                                            <button className="btn btn-danger btn-sm" onClick={async () => {
                                                                try {
                                                                    await api.delete(`/worklogs/${log._id}`);
                                                                    toast.success('Draft deleted');
                                                                    setConfirmDeleteId(null);
                                                                    fetchLogs(page);
                                                                } catch (e) { toast.error(e.response?.data?.message || 'Delete failed'); setConfirmDeleteId(null); }
                                                            }}>Yes, delete</button>
                                                            <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                                                        </>
                                                    )}
                                                </div>

                                            </td>
                                        </tr>
                                        {expandedId === log._id && (
                                            <tr>
                                                <td colSpan={7}>
                                                    <div style={{ background: 'var(--bg-row-alt)', padding: '12px 16px' }}>
                                                        <div className="text-xs text-muted mb-2">
                                                            IP: {log.ipAddress || '—'} | Submitted: {log.submittedAt ? new Date(log.submittedAt).toUTCString() : '—'}
                                                        </div>
                                                        <div
                                                            className="rich-content"
                                                            dangerouslySetInnerHTML={{ __html: log.content || '<p style="color:var(--text-muted)">(empty)</p>' }}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex gap-2 items-center">
                            <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => { setPage(p => p - 1); fetchLogs(page - 1); }}>
                                Previous
                            </button>
                            <span className="text-sm text-muted">Page {page} of {totalPages}</span>
                            <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => { setPage(p => p + 1); fetchLogs(page + 1); }}>
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
