import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/client';
import { priorityBadge, stateBadge, LoadingPage, formatDateTime } from '../components/UI';
import RichEditor from '../components/RichEditor';

const STATES = ['Open', 'In Progress', 'On Hold', 'Resolved', 'Archived'];

export default function IncidentDetail() {
    const { incidentId } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();

    const [incident, setIncident] = useState(null);
    const [auditLog, setAuditLog] = useState([]);
    const [timeline, setTimeline] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('details');

    const [edit, setEdit] = useState({
        observation: '', steps: '', resolution: '',
        resolutionTime: '', resolutionTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        handledByType: 'self', handledByName: '',
        state: 'Open',
    });

    const loadData = () => {
        Promise.all([
            api.get(`/incidents/${incidentId}`),
            api.get(`/incidents/${incidentId}/audit`),
            api.get(`/incidents/${incidentId}/timeline`),
        ]).then(([inc, audit, tl]) => {
            const i = inc.data;
            setIncident(i);
            setEdit({
                observation: i.observation || '',
                steps: i.steps || '',
                resolution: i.resolution || '',
                resolutionTime: i.resolutionTime ? new Date(i.resolutionTime).toISOString().slice(0, 16) : '',
                resolutionTimezone: i.resolutionTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
                handledByType: i.handledByType || 'self',
                handledByName: i.handledByName || '',
                state: i.state || 'Open',
            });
            setAuditLog(audit.data);
            setTimeline(tl.data);
        }).catch(() => toast.error('Failed to load incident'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { loadData(); }, [incidentId]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                ...edit,
                resolutionTime: edit.resolutionTime ? new Date(edit.resolutionTime).toISOString() : null,
            };
            const res = await api.put(`/incidents/${incidentId}`, payload);
            setIncident(res.data.incident);
            toast.success('Incident updated');
            const [audit, tl] = await Promise.all([
                api.get(`/incidents/${incidentId}/audit`),
                api.get(`/incidents/${incidentId}/timeline`),
            ]);
            setAuditLog(audit.data);
            setTimeline(tl.data);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const handleArchive = async () => {
        if (!window.confirm('Archive this incident? It will be removed from active operations.')) return;
        setSaving(true);
        try {
            await api.put(`/incidents/${incidentId}`, { isArchived: true, state: 'Archived' });
            toast.success('Incident archived');
            navigate('/incidents');
        } catch {
            toast.error('Archive failed');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <LoadingPage />;
    if (!incident) return <div className="alert alert-error">Incident not found</div>;

    const canArchive = !incident.isArchived && (user?.role === 'Admin' || user?.role === 'IT Admin');

    return (
        <div>
            {/* Header */}
            <div className="page-header">
                <div className="flex items-center gap-3">
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate('/incidents')}>Back</button>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-accent" style={{ fontSize: 16 }}>#{incident.incidentId}</span>
                            {priorityBadge(incident.priority)}
                            {stateBadge(incident.state)}
                            {incident.isArchived && <span className="badge badge-archived">Archived</span>}
                        </div>
                        <div className="text-sm text-muted mt-1">{incident.product}</div>
                    </div>
                </div>
                <div className="flex gap-2">
                    {canArchive && (
                        <button className="btn btn-danger btn-sm" onClick={handleArchive} disabled={saving}>Archive</button>
                    )}
                    <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                        {saving ? <span className="spinner" /> : null}
                        Save Changes
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="tab-row">
                {['details', 'edit', 'timeline', 'audit'].map(tab => (
                    <button
                        key={tab}
                        className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {/* Details */}
            {activeTab === 'details' && (
                <div>
                    <div className="info-grid mb-4">
                        {[
                            { label: 'Raised At', value: formatDateTime(incident.raisedAt, incident.raisedAtTimezone) },
                            { label: 'Raised By', value: incident.raisedBy },
                            { label: 'Channel', value: incident.channel + (incident.channelOther ? ` (${incident.channelOther})` : '') },
                            { label: 'Created By', value: incident.createdInToolBy?.displayName || '—' },
                            { label: 'Handled By', value: incident.handledByType === 'self' ? incident.createdInToolBy?.displayName : incident.handledByType === 'selfResolved' ? `${incident.raisedBy} (Self)` : incident.handledByName || '—' },
                            { label: 'Resolution Time', value: incident.resolutionTime ? formatDateTime(incident.resolutionTime, incident.resolutionTimezone) : '—' },
                        ].map(item => (
                            <div key={item.label}>
                                <div className="info-item-label">{item.label}</div>
                                <div className="info-item-value">{item.value}</div>
                            </div>
                        ))}
                    </div>

                    {[
                        { label: 'Issue', content: incident.issue },
                        { label: 'Observation', content: incident.observation },
                        { label: 'Steps Taken', content: incident.steps },
                        { label: 'Resolution', content: incident.resolution },
                    ].filter(s => s.content).map(section => (
                        <div key={section.label} className="detail-section mb-3">
                            <div className="detail-section-header">{section.label}</div>
                            <div className="detail-section-body rich-content"
                                dangerouslySetInnerHTML={{ __html: section.content }} />
                        </div>
                    ))}
                </div>
            )}

            {/* Edit */}
            {activeTab === 'edit' && (
                <div style={{ maxWidth: 760 }}>
                    <div className="alert alert-info mb-4" style={{ fontSize: 12 }}>
                        Only observation, steps, resolution, resolution time, handler, and state can be changed after creation.
                    </div>

                    <div className="card mb-4">
                        <div className="card-header"><span className="card-title">State and Assignment</span></div>
                        <div className="grid-2">
                            <div className="form-group">
                                <label className="form-label">Incident State</label>
                                {incident.isArchived ? (
                                    <div className="form-control text-muted" style={{ opacity: 0.6, lineHeight: '20px' }}>Archived — cannot change</div>
                                ) : (
                                    <select className="form-control" value={edit.state} onChange={e => setEdit(f => ({ ...f, state: e.target.value }))}>
                                        {STATES.map(s => <option key={s}>{s}</option>)}
                                    </select>
                                )}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Resolution Time ({edit.resolutionTimezone})</label>
                                <div className="flex gap-2">
                                    <input type="datetime-local" className="form-control flex-1"
                                        value={edit.resolutionTime}
                                        onChange={e => setEdit(f => ({ ...f, resolutionTime: e.target.value }))} />
                                    <button type="button" className="btn btn-secondary btn-sm"
                                        onClick={() => setEdit(f => ({ ...f, resolutionTime: new Date().toISOString().slice(0, 16) }))}>
                                        Now
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Handled By</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                {[
                                    { value: 'self', label: `${user?.displayName || 'You'} (logged-in user)` },
                                    { value: 'selfResolved', label: `${incident.raisedBy} (self-resolved)` },
                                    { value: 'other', label: 'Another person' },
                                ].map(opt => (
                                    <label key={opt.value} style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
                                        <input type="radio" name="editHandledByType" value={opt.value}
                                            checked={edit.handledByType === opt.value}
                                            onChange={e => setEdit(f => ({ ...f, handledByType: e.target.value }))} />
                                        {opt.label}
                                    </label>
                                ))}
                            </div>
                            {edit.handledByType === 'other' && (
                                <div className="form-group mt-3">
                                    <label className="form-label">Handler Name</label>
                                    <input className="form-control" value={edit.handledByName}
                                        onChange={e => setEdit(f => ({ ...f, handledByName: e.target.value }))} />
                                </div>
                            )}
                        </div>
                    </div>

                    {[
                        { key: 'observation', label: 'Observation' },
                        { key: 'steps', label: 'Steps Taken' },
                        { key: 'resolution', label: 'Resolution' },
                    ].map(section => (
                        <div key={section.key} className="card mb-4">
                            <div className="card-header"><span className="card-title">{section.label}</span></div>
                            <RichEditor
                                value={edit[section.key]}
                                onChange={v => setEdit(f => ({ ...f, [section.key]: v }))}
                                placeholder={`Document ${section.label.toLowerCase()}...`}
                            />
                        </div>
                    ))}

                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? <span className="spinner" /> : null}
                        Save Changes
                    </button>
                </div>
            )}

            {/* Timeline */}
            {activeTab === 'timeline' && (
                <div style={{ maxWidth: 600 }}>
                    {timeline.length === 0 ? (
                        <div className="empty-state"><h3>No timeline events yet</h3></div>
                    ) : (
                        <div className="timeline">
                            {timeline.map(entry => (
                                <div key={entry._id} className="timeline-item">
                                    <div className="timeline-dot"
                                        style={{ background: entry.action === 'create' ? 'var(--success)' : entry.action === 'archive' ? 'var(--danger)' : 'var(--accent)' }}
                                    />
                                    <div className="timeline-entry">
                                        <div className="font-medium text-sm">
                                            {entry.action === 'create' && 'Incident Created'}
                                            {entry.action === 'state_change' && `State changed to: ${entry.newValue}`}
                                            {entry.action === 'archive' && 'Incident Archived'}
                                            {entry.action === 'update' && `Updated: ${entry.field}`}
                                        </div>
                                        {entry.action === 'state_change' && (
                                            <div className="text-xs text-muted mt-1">{entry.oldValue} → {entry.newValue}</div>
                                        )}
                                        <div className="timeline-meta">
                                            {entry.changedBy?.displayName || '—'} · {new Date(entry.changedAt).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Audit */}
            {activeTab === 'audit' && (
                <div>
                    {auditLog.length === 0 ? (
                        <div className="empty-state"><h3>No audit entries</h3></div>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Field</th>
                                        <th>Old Value</th>
                                        <th>New Value</th>
                                        <th>Changed By</th>
                                        <th>Changed At</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {auditLog.map(entry => (
                                        <tr key={entry._id} style={{ cursor: 'default' }}>
                                            <td className="font-mono text-xs">{entry.field}</td>
                                            <td className="text-xs text-muted" style={{ maxWidth: 200 }}>
                                                <span className="truncate" style={{ display: 'block' }}>
                                                    {String(entry.oldValue ?? '—').replace(/<[^>]+>/g, '').slice(0, 80)}
                                                </span>
                                            </td>
                                            <td className="text-xs" style={{ maxWidth: 200 }}>
                                                <span className="truncate" style={{ display: 'block' }}>
                                                    {String(entry.newValue ?? '—').replace(/<[^>]+>/g, '').slice(0, 80)}
                                                </span>
                                            </td>
                                            <td className="text-sm">{entry.changedBy?.displayName || '—'}</td>
                                            <td className="text-xs text-muted">{new Date(entry.changedAt).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
