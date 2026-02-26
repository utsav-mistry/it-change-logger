import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { priorityBadge, stateBadge, Pagination, EmptyState, LoadingPage } from '../components/UI';
import { useAuth } from '../context/AuthContext';

const PRIORITIES = ['', 'Critical', 'High', 'Medium', 'Low'];
const CHANNELS = ['', 'Teams', 'Mail', 'Ticket', 'Other'];
const STATES = ['', 'Open', 'In Progress', 'On Hold', 'Resolved', 'Archived'];

export default function IncidentList() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [incidents, setIncidents] = useState([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState([]);
    const [filters, setFilters] = useState({
        search: '', incidentId: '', priority: '', channel: '', state: '',
        handledBy: '', raisedBy: '', product: '',
        raisedAtFrom: '', raisedAtTo: '', resolutionFrom: '', resolutionTo: '',
        sortBy: 'incidentId', sortOrder: 'desc',
    });

    useEffect(() => {
        api.get('/users?limit=100').then(r => setUsers(r.data.users || [])).catch(() => { });
    }, []);

    const fetchIncidents = useCallback(async (pg = 1) => {
        setLoading(true);
        try {
            const params = { page: pg, limit: 20, ...filters };
            Object.keys(params).forEach(k => !params[k] && delete params[k]);
            const res = await api.get('/incidents', { params });
            setIncidents(res.data.incidents);
            setTotal(res.data.total);
            setTotalPages(res.data.totalPages);
        } catch { }
        setLoading(false);
    }, [filters]);

    useEffect(() => {
        const t = setTimeout(() => fetchIncidents(1), 300);
        return () => clearTimeout(t);
    }, [filters]);

    const setFilter = (key, val) => {
        setFilters(f => ({ ...f, [key]: val }));
        setPage(1);
    };

    const clearFilters = () => {
        setFilters({
            search: '', incidentId: '', priority: '', channel: '', state: '',
            handledBy: '', raisedBy: '', product: '',
            raisedAtFrom: '', raisedAtTo: '', resolutionFrom: '', resolutionTo: '',
            sortBy: 'incidentId', sortOrder: 'desc',
        });
        setPage(1);
    };

    const handlePageChange = (p) => {
        setPage(p);
        fetchIncidents(p);
    };

    return (
        <div className="animate-fadeIn">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1>Incidents</h1>
                    <p className="text-secondary mt-1">{total} total records</p>
                </div>
                <button className="btn btn-primary" onClick={() => navigate('/incidents/new')}>
                    + New Incident
                </button>
            </div>

            {/* Filter bar */}
            <div className="filter-bar">
                <div className="search-bar">
                    <span className="search-icon">🔍</span>
                    <input
                        className="form-control"
                        placeholder="Search issue, product, resolution..."
                        value={filters.search}
                        onChange={e => setFilter('search', e.target.value)}
                    />
                </div>
                <div className="form-group">
                    <label>Incident ID</label>
                    <input className="form-control" placeholder="#" type="number"
                        value={filters.incidentId} onChange={e => setFilter('incidentId', e.target.value)} />
                </div>
                <div className="form-group">
                    <label>Priority</label>
                    <select className="form-control" value={filters.priority} onChange={e => setFilter('priority', e.target.value)}>
                        {PRIORITIES.map(p => <option key={p} value={p}>{p || 'All'}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label>Channel</label>
                    <select className="form-control" value={filters.channel} onChange={e => setFilter('channel', e.target.value)}>
                        {CHANNELS.map(c => <option key={c} value={c}>{c || 'All'}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label>State</label>
                    <select className="form-control" value={filters.state} onChange={e => setFilter('state', e.target.value)}>
                        {STATES.map(s => <option key={s} value={s}>{s || 'All'}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label>Product</label>
                    <input className="form-control" placeholder="Filter by product"
                        value={filters.product} onChange={e => setFilter('product', e.target.value)} />
                </div>
                <div className="form-group">
                    <label>Raised By</label>
                    <input className="form-control" placeholder="Reporter name"
                        value={filters.raisedBy} onChange={e => setFilter('raisedBy', e.target.value)} />
                </div>
                <div className="form-group">
                    <label>Raised From</label>
                    <input type="date" className="form-control"
                        value={filters.raisedAtFrom} onChange={e => setFilter('raisedAtFrom', e.target.value)} />
                </div>
                <div className="form-group">
                    <label>Raised To</label>
                    <input type="date" className="form-control"
                        value={filters.raisedAtTo} onChange={e => setFilter('raisedAtTo', e.target.value)} />
                </div>
                <div className="form-group">
                    <label>Sort By</label>
                    <select className="form-control" value={filters.sortBy} onChange={e => setFilter('sortBy', e.target.value)}>
                        <option value="incidentId">Incident ID</option>
                        <option value="raisedAt">Raised At</option>
                        <option value="priority">Priority</option>
                        <option value="state">State</option>
                    </select>
                </div>
                <div className="form-group">
                    <label>Order</label>
                    <select className="form-control" value={filters.sortOrder} onChange={e => setFilter('sortOrder', e.target.value)}>
                        <option value="desc">Newest First</option>
                        <option value="asc">Oldest First</option>
                    </select>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={clearFilters}>Clear Filters</button>
            </div>

            {/* Table */}
            {loading ? (
                <LoadingPage />
            ) : incidents.length === 0 ? (
                <EmptyState icon="📭" title="No incidents found" description="Try adjusting your filters" />
            ) : (
                <>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Product</th>
                                    <th>Issue (preview)</th>
                                    <th>Priority</th>
                                    <th>State</th>
                                    <th>Channel</th>
                                    <th>Raised By</th>
                                    <th>Handler</th>
                                    <th>Raised At</th>
                                </tr>
                            </thead>
                            <tbody>
                                {incidents.map(inc => (
                                    <tr key={inc._id} onClick={() => navigate(`/incidents/${inc.incidentId}`)}>
                                        <td><span className="font-mono text-accent">#{inc.incidentId}</span></td>
                                        <td className="font-medium">{inc.product}</td>
                                        <td className="text-secondary" style={{ maxWidth: 200 }}>
                                            <span className="truncate" style={{ display: 'block' }}>
                                                {(inc.issue || '').replace(/<[^>]+>/g, '').slice(0, 60) || '—'}
                                            </span>
                                        </td>
                                        <td>{priorityBadge(inc.priority)}</td>
                                        <td>{stateBadge(inc.state)}</td>
                                        <td><span className="text-secondary">{inc.channel}</span></td>
                                        <td>{inc.raisedBy}</td>
                                        <td className="text-secondary">
                                            {inc.handledByType === 'self'
                                                ? (inc.createdInToolBy?.displayName || '—')
                                                : inc.handledByType === 'selfResolved'
                                                    ? `${inc.raisedBy} (Self)`
                                                    : inc.handledByName || '—'
                                            }
                                        </td>
                                        <td className="text-muted text-sm">{new Date(inc.raisedAt).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Pagination page={page} totalPages={totalPages} onChange={handlePageChange} />
                </>
            )}
        </div>
    );
}
