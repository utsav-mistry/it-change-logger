import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import api from '../api/client';
import { LoadingPage, stateBadge, priorityBadge } from '../components/UI';

const PRIORITY_COLORS = { Critical: 'var(--priority-critical)', High: 'var(--priority-high)', Medium: 'var(--priority-medium)', Low: 'var(--priority-low)' };
const TT_STYLE = {
    contentStyle: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 11 },
    labelStyle: { color: 'var(--text-primary)' },
};

export default function Dashboard() {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [recent, setRecent] = useState([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('30');

    useEffect(() => {
        Promise.all([
            api.get(`/reports/dashboard?period=${period}`),
            api.get('/incidents?limit=8&sortBy=incidentId&sortOrder=desc'),
        ]).then(([s, r]) => {
            setStats(s.data);
            setRecent(r.data.incidents);
        }).catch(() => { }).finally(() => setLoading(false));
    }, [period]);

    if (loading) return <LoadingPage />;

    const priorityData = stats ? ['Critical', 'High', 'Medium', 'Low'].map(p => ({
        name: p, value: stats.byPriority[p] || 0,
    })) : [];

    return (
        <div>
            <div className="page-header">
                <div>
                    <div className="page-title">Dashboard</div>
                    <div className="page-sub">Incident overview</div>
                </div>
                <div className="flex gap-2">
                    {[['7', '7 Days'], ['30', '30 Days'], ['90', '90 Days']].map(([v, l]) => (
                        <button
                            key={v}
                            className={`btn btn-sm ${period === v ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setPeriod(v)}
                        >
                            {l}
                        </button>
                    ))}
                    <button className="btn btn-primary btn-sm" onClick={() => navigate('/incidents/new')}>
                        New Incident
                    </button>
                </div>
            </div>

            {/* Stat cards */}
            <div className="grid-4 mb-4">
                {[
                    { label: 'Total', value: stats?.total || 0 },
                    { label: 'Resolved', value: stats?.resolved || 0 },
                    { label: 'Unresolved', value: (stats?.total || 0) - (stats?.resolved || 0) },
                    { label: 'Avg Resolution', value: `${stats?.resolutionTrend?.slice(-1)[0]?.avgHours || '—'}h` },
                ].map(card => (
                    <div key={card.label} className="stat-card">
                        <div className="stat-label">{card.label}</div>
                        <div className="stat-value">{card.value}</div>
                    </div>
                ))}
            </div>

            {/* Charts */}
            <div className="grid-2 mb-4">
                <div className="chart-card">
                    <div className="chart-title">Incidents Over Time</div>
                    <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={stats?.overTime || []}>
                            <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} tickFormatter={v => v.slice(5)} />
                            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 9 }} allowDecimals={false} />
                            <Tooltip {...TT_STYLE} />
                            <Line type="monotone" dataKey="count" stroke="var(--accent)" strokeWidth={1.5} dot={false} name="Incidents" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="chart-card">
                    <div className="chart-title">By Priority</div>
                    <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={priorityData} barSize={28}>
                            <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} />
                            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 9 }} allowDecimals={false} />
                            <Tooltip {...TT_STYLE} />
                            <Bar dataKey="value" radius={[2, 2, 0, 0]} name="Count">
                                {priorityData.map((entry) => (
                                    <rect key={entry.name} fill={PRIORITY_COLORS[entry.name]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Recent incidents */}
            <div className="card mb-0">
                <div className="card-header">
                    <span className="card-title">Recent Incidents</span>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate('/incidents')}>View All</button>
                </div>
                {recent.length === 0 ? (
                    <div className="empty-state">
                        <h3>No incidents logged yet</h3>
                        <p>Create the first incident to get started</p>
                    </div>
                ) : (
                    <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Product</th>
                                    <th>Priority</th>
                                    <th>State</th>
                                    <th>Raised By</th>
                                    <th>Raised At</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recent.map(inc => (
                                    <tr key={inc._id} onClick={() => navigate(`/incidents/${inc.incidentId}`)}>
                                        <td className="font-mono text-xs text-accent">#{inc.incidentId}</td>
                                        <td className="font-medium text-sm">{inc.product}</td>
                                        <td>{priorityBadge(inc.priority)}</td>
                                        <td>{stateBadge(inc.state)}</td>
                                        <td className="text-sm text-muted">{inc.raisedBy}</td>
                                        <td className="text-xs text-muted">{new Date(inc.raisedAt).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
