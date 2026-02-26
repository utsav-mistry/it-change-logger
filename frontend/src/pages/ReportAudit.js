import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { LoadingPage, Pagination } from '../components/UI';

export default function ReportAudit() {
    const [records, setRecords] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ module: '', format: '', from: '', to: '' });

    const fetch = useCallback(async (pg = 1) => {
        setLoading(true);
        try {
            const params = { page: pg, limit: 30, ...filters };
            Object.keys(params).forEach(k => !params[k] && delete params[k]);
            const res = await api.get('/reports/download-audit', { params });
            setRecords(res.data.records);
            setTotal(res.data.total);
            setTotalPages(res.data.totalPages);
        } catch { }
        setLoading(false);
    }, [filters]);

    useEffect(() => {
        const t = setTimeout(() => fetch(1), 200);
        return () => clearTimeout(t);
    }, [filters]);

    const setFilter = (k, v) => { setFilters(f => ({ ...f, [k]: v })); setPage(1); };

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div>
                    <div className="page-title">Download Audit</div>
                    <div className="page-sub">{total} report download records</div>
                </div>
            </div>

            <div className="filter-bar mb-4">
                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Module</label>
                    <select className="form-control" value={filters.module} onChange={e => setFilter('module', e.target.value)}>
                        <option value="">All</option>
                        <option value="incidents">Incidents</option>
                        <option value="worklog">Work Logs</option>
                    </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Format</label>
                    <select className="form-control" value={filters.format} onChange={e => setFilter('format', e.target.value)}>
                        <option value="">All</option>
                        <option value="PDF">PDF</option>
                        <option value="CSV">CSV</option>
                    </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">From</label>
                    <input type="date" className="form-control" value={filters.from}
                        onChange={e => setFilter('from', e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">To</label>
                    <input type="date" className="form-control" value={filters.to}
                        onChange={e => setFilter('to', e.target.value)} />
                </div>
                <div className="form-group" style={{ justifyContent: 'flex-end', marginBottom: 0 }}>
                    <label className="form-label">&nbsp;</label>
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setFilters({ module: '', format: '', from: '', to: '' })}
                    >
                        Clear
                    </button>
                </div>
            </div>

            {loading ? <LoadingPage /> : (
                <>
                    <div className="table-wrap mb-4">
                        <table>
                            <thead>
                                <tr>
                                    <th>Downloaded At</th>
                                    <th>Downloaded By</th>
                                    <th>Module</th>
                                    <th>Report Type</th>
                                    <th>Format</th>
                                    <th>Date From</th>
                                    <th>Date To</th>
                                </tr>
                            </thead>
                            <tbody>
                                {records.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                                            No download records found.
                                        </td>
                                    </tr>
                                ) : records.map(r => (
                                    <tr key={r._id} style={{ cursor: 'default' }}>
                                        <td className="text-sm">{new Date(r.downloadedAt).toLocaleString()}</td>
                                        <td>
                                            <div className="font-medium text-sm">{r.downloadedBy?.displayName || '—'}</div>
                                            <div className="text-xs text-muted">@{r.downloadedBy?.username}</div>
                                        </td>
                                        <td className="text-sm">{r.module}</td>
                                        <td><span className="badge badge-neutral">{r.reportType}</span></td>
                                        <td>
                                            <span className={`badge ${r.exportFormat === 'PDF' ? 'badge-open' : 'badge-resolved'}`}>
                                                {r.exportFormat}
                                            </span>
                                        </td>
                                        <td className="text-sm text-muted">{new Date(r.dateFrom).toLocaleDateString()}</td>
                                        <td className="text-sm text-muted">{new Date(r.dateTo).toLocaleDateString()}</td>
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
