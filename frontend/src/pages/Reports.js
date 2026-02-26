import React, { useState } from 'react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { LoadingPage, Spinner, BarRow } from '../components/UI';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

const PERIOD_OPTS = [
    { value: 'daily', label: 'Daily (last 24h)' },
    { value: 'weekly', label: 'Weekly (last 7d)' },
    { value: 'monthly', label: 'Monthly (last 30d)' },
    { value: 'yearly', label: 'Yearly (last 12mo)' },
    { value: 'custom', label: 'Custom Range' },
];

const PRIORITY_COLORS = {
    Critical: 'var(--priority-critical)',
    High: 'var(--priority-high)',
    Medium: 'var(--priority-medium)',
    Low: 'var(--priority-low)',
};

const STATE_COLORS = {
    Open: 'var(--state-open)',
    'In Progress': 'var(--state-inprogress)',
    'On Hold': 'var(--state-onhold)',
    Resolved: 'var(--state-resolved)',
    Archived: 'var(--state-archived)',
};

const TT_STYLE = {
    contentStyle: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 11 },
    labelStyle: { color: 'var(--text-primary)' },
};

export default function Reports() {
    const toast = useToast();
    const [period, setPeriod] = useState('monthly');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(null);

    const loadReport = async () => {
        if (period === 'custom' && (!from || !to)) {
            toast.error('Select a date range for custom reports');
            return;
        }
        setLoading(true);
        setData(null);
        try {
            const params = { period };
            if (period === 'custom') { params.from = from; params.to = to; }
            const res = await api.get('/reports/data', { params });
            setData(res.data);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to load report');
        } finally {
            setLoading(false);
        }
    };

    const downloadExport = async (format) => {
        setExporting(format);
        try {
            const params = { period };
            if (period === 'custom') { params.from = from; params.to = to; }
            const res = await api.get(`/reports/${format.toLowerCase()}`, { params, responseType: 'blob' });
            const url = URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `incident-report-${period}-${Date.now()}.${format.toLowerCase()}`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success(`${format} downloaded`);
        } catch {
            toast.error(`${format} export failed`);
        } finally {
            setExporting(null);
        }
    };

    const priorityData = data
        ? Object.entries(data.byPriority).map(([name, value]) => ({ name, value }))
        : [];
    const stateData = data
        ? Object.entries(data.byState).map(([name, value]) => ({ name, value }))
        : [];
    const maxPriority = priorityData.reduce((m, d) => Math.max(m, d.value), 0);
    const maxState = stateData.reduce((m, d) => Math.max(m, d.value), 0);
    const maxChannel = data
        ? Math.max(...Object.values(data.byChannel).map(Number))
        : 0;

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div>
                    <div className="page-title">Reports</div>
                    <div className="page-sub">Incident analysis and export</div>
                </div>
            </div>

            {/* Controls */}
            <div className="card mb-4">
                <div className="flex flex-wrap gap-3 items-end">
                    <div className="form-group" style={{ minWidth: 200, flex: 1, marginBottom: 0 }}>
                        <label className="form-label">Report Period</label>
                        <select className="form-control" value={period} onChange={e => setPeriod(e.target.value)}>
                            {PERIOD_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>

                    {period === 'custom' && (
                        <>
                            <div className="form-group" style={{ minWidth: 140, marginBottom: 0 }}>
                                <label className="form-label">From</label>
                                <input type="date" className="form-control" value={from} onChange={e => setFrom(e.target.value)} />
                            </div>
                            <div className="form-group" style={{ minWidth: 140, marginBottom: 0 }}>
                                <label className="form-label">To</label>
                                <input type="date" className="form-control" value={to} onChange={e => setTo(e.target.value)} />
                            </div>
                        </>
                    )}

                    <button className="btn btn-primary btn-sm" onClick={loadReport} disabled={loading}>
                        {loading ? <Spinner /> : null}
                        View Report
                    </button>

                    {data && (
                        <>
                            <button className="btn btn-secondary btn-sm" onClick={() => downloadExport('CSV')} disabled={exporting === 'CSV'}>
                                {exporting === 'CSV' ? <Spinner /> : null}
                                Export CSV
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={() => downloadExport('PDF')} disabled={exporting === 'PDF'}>
                                {exporting === 'PDF' ? <Spinner /> : null}
                                Export PDF
                            </button>
                        </>
                    )}
                </div>
            </div>

            {loading && <LoadingPage />}

            {data && !loading && (
                <>
                    {/* Header */}
                    <div className="card mb-4" style={{ borderLeft: '3px solid var(--accent)' }}>
                        <div className="flex flex-wrap gap-4 items-start justify-between">
                            <div>
                                <div className="font-bold text-primary">{data.label || 'Report'}</div>
                                <div className="text-xs text-muted mt-1">
                                    {new Date(data.dateFrom).toUTCString()} — {new Date(data.dateTo).toUTCString()}
                                </div>
                                <div className="text-xs text-muted">Generated: {new Date(data.generatedAt).toUTCString()}</div>
                            </div>
                            <div className="grid-4 gap-3" style={{ gridTemplateColumns: 'repeat(4,minmax(90px,1fr))', gap: 10 }}>
                                {[
                                    { label: 'Total', value: data.total },
                                    { label: 'Resolved', value: data.resolved },
                                    { label: 'Unresolved', value: data.unresolved },
                                    { label: 'Avg Resolution', value: `${data.avgResolutionHours}h` },
                                ].map(s => (
                                    <div key={s.label} className="stat-card" style={{ padding: '10px 14px' }}>
                                        <div className="stat-label">{s.label}</div>
                                        <div className="stat-value" style={{ fontSize: '1.2rem' }}>{s.value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="grid-2 mb-4">
                        {/* By Priority */}
                        <div className="report-section">
                            <div className="report-section-header">Priority Distribution</div>
                            <div className="report-section-body">
                                {['Critical', 'High', 'Medium', 'Low'].map(p => (
                                    <BarRow
                                        key={p}
                                        label={p}
                                        value={data.byPriority[p] || 0}
                                        max={maxPriority}
                                        color={PRIORITY_COLORS[p]}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* By State */}
                        <div className="report-section">
                            <div className="report-section-header">State Distribution</div>
                            <div className="report-section-body">
                                {['Open', 'In Progress', 'On Hold', 'Resolved', 'Archived'].map(s => (
                                    <BarRow
                                        key={s}
                                        label={s}
                                        value={data.byState[s] || 0}
                                        max={maxState}
                                        color={STATE_COLORS[s]}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="grid-2 mb-4">
                        {/* By Channel */}
                        <div className="report-section">
                            <div className="report-section-header">Channel Distribution</div>
                            <div className="report-section-body">
                                {Object.entries(data.byChannel).map(([ch, cnt]) => (
                                    <BarRow key={ch} label={ch} value={cnt} max={maxChannel} />
                                ))}
                            </div>
                        </div>

                        {/* By Handler */}
                        <div className="report-section">
                            <div className="report-section-header">Top Handlers</div>
                            <div className="report-section-body">
                                {data.byHandler.slice(0, 7).map(h => (
                                    <BarRow
                                        key={h.name}
                                        label={h.name}
                                        value={h.count}
                                        max={data.byHandler[0]?.count || 1}
                                    />
                                ))}
                                {data.byHandler.length === 0 && (
                                    <div className="text-sm text-muted">No data</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Time of day distribution */}
                    <div className="report-section mb-4">
                        <div className="report-section-header">Time-of-Day Distribution (UTC hour — when incidents are raised)</div>
                        <div className="report-section-body">
                            <ResponsiveContainer width="100%" height={160}>
                                <BarChart data={data.hourDistribution} barSize={10}>
                                    <XAxis
                                        dataKey="hour"
                                        tick={{ fill: 'var(--text-muted)', fontSize: 9 }}
                                        interval={1}
                                        tickFormatter={v => v.split(':')[0]}
                                    />
                                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 9 }} allowDecimals={false} />
                                    <Tooltip
                                        {...TT_STYLE}
                                        formatter={(val) => [val, 'Incidents']}
                                    />
                                    <Bar dataKey="count" fill="var(--accent)" radius={[2, 2, 0, 0]} name="Incidents" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Incidents over time */}
                    {data.overTime && data.overTime.length > 0 && (
                        <div className="report-section mb-4">
                            <div className="report-section-header">Incidents Over Time</div>
                            <div className="report-section-body">
                                <ResponsiveContainer width="100%" height={160}>
                                    <LineChart data={data.overTime}>
                                        <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 9 }}
                                            tickFormatter={v => v.slice(5)} />
                                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 9 }} allowDecimals={false} />
                                        <Tooltip {...TT_STYLE} />
                                        <Line type="monotone" dataKey="count" stroke="var(--accent)" strokeWidth={1.5} dot={false} name="Incidents" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Incident list */}
                    <div className="report-section">
                        <div className="report-section-header">
                            Incident List ({data.incidents.length} records)
                        </div>
                        <div className="table-wrap" style={{ border: 'none' }}>
                            <table>
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Priority</th>
                                        <th>State</th>
                                        <th>Product</th>
                                        <th>Raised By</th>
                                        <th>Handler</th>
                                        <th>Raised At</th>
                                        <th>Resolved At</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.incidents.slice(0, 200).map(inc => (
                                        <tr key={inc._id} style={{ cursor: 'default' }}>
                                            <td className="font-mono text-xs">#{inc.incidentId}</td>
                                            <td><span className={`badge badge-${(inc.priority || '').toLowerCase()}`}>{inc.priority}</span></td>
                                            <td><span className={`badge badge-${(inc.state || '').toLowerCase().replace(/ /g, '')}`}>{inc.state}</span></td>
                                            <td className="text-sm">{inc.product}</td>
                                            <td className="text-sm text-muted">{inc.raisedBy}</td>
                                            <td className="text-sm text-muted">
                                                {inc.handledByType === 'self' ? (inc.createdInToolBy?.displayName || '—')
                                                    : inc.handledByType === 'selfResolved' ? `${inc.raisedBy} (Self)`
                                                        : inc.handledByName || '—'}
                                            </td>
                                            <td className="text-xs text-muted">{new Date(inc.raisedAt).toLocaleDateString()}</td>
                                            <td className="text-xs text-muted">
                                                {inc.resolutionTime ? new Date(inc.resolutionTime).toLocaleDateString() : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                    {data.incidents.length > 200 && (
                                        <tr>
                                            <td colSpan={8} style={{ textAlign: 'center', padding: 10, color: 'var(--text-muted)', fontSize: 11 }}>
                                                Showing first 200 of {data.incidents.length}. Export PDF/CSV for full list.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
