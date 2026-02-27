import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/client';
import { priorityBadge, stateBadge, LoadingPage, formatDateTime } from '../components/UI';
import RichEditor from '../components/RichEditor';

const STATES = ['Open', 'In Progress', 'On Hold', 'Resolved'];

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
    const [showResolveModal, setShowResolveModal] = useState(false);

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

    // Core save — called directly OR after resolve-confirmation
    const doSave = async () => {
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

    const handleSave = () => {
        // Intercept: transitioning to Resolved for the first time → show confirmation modal
        if (edit.state === 'Resolved' && incident.state !== 'Resolved') {
            setShowResolveModal(true);
            return;
        }
        doSave();
    };

    const handleArchive = async () => {
        setSaving(true);
        try {
            await api.put(`/incidents/${incidentId}`, { isArchived: true, state: 'Archived' });
            toast.success('Incident archived and removed from active operations.');
            navigate('/incidents');
        } catch {
            toast.error('Archive failed');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <LoadingPage />;
    if (!incident) return <div className="alert alert-error">Incident not found</div>;

    const canArchive = !incident.isArchived && incident.state !== 'Resolved' && (user?.role === 'Admin' || user?.role === 'IT Admin');
    // Lock when archived OR resolved — resolved incidents are permanently view-only
    const isLocked = incident.isArchived || incident.state === 'Resolved';
    const isResolved = incident.state === 'Resolved' && !incident.isArchived;
    const canUnarchive = incident.isArchived && (user?.role === 'Admin' || user?.role === 'IT Admin');

    const handleUnarchive = async () => {
        setSaving(true);
        try {
            await api.put(`/incidents/${incidentId}`, { isArchived: false, state: 'Open' });
            toast.success('Incident unarchived and reopened.');
            loadData();
        } catch (e) {
            toast.error('Unarchive failed');
        } finally {
            setSaving(false);
        }
    };

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
                    {canUnarchive && (
                        <button className="btn btn-secondary btn-sm" onClick={handleUnarchive} disabled={saving}>Unarchive</button>
                    )}
                    {/* Hide Save when incident is locked (resolved or archived) */}
                    {!isLocked && (
                        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                            {saving ? <span className="spinner" /> : null}
                            Save Changes
                        </button>
                    )}
                    {isResolved && (
                        <span className="badge badge-resolved" style={{ alignSelf: 'center', fontSize: 11 }}>Resolved &amp; Locked</span>
                    )}
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

            {/* Resolve Confirmation Modal */}
            {showResolveModal && (
                <div className="modal-overlay" style={{ zIndex: 9999 }}>
                    <div className="modal" style={{ maxWidth: 480 }}>
                        <div className="modal-header">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 16, fontWeight: 600 }}>Mark Incident as Resolved?</span>
                            </h3>
                        </div>
                        <div style={{ padding: '16px 0', color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7 }}>
                            <p style={{ marginBottom: 12 }}>
                                You are about to mark this incident as <strong style={{ color: 'var(--text-primary)' }}>Resolved</strong>.
                                Please review the details below — <strong style={{ color: 'var(--danger)' }}>this action is final</strong>.
                            </p>
                            <div style={{
                                background: 'var(--bg-surface)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius)',
                                padding: '10px 14px',
                                fontSize: 13,
                                marginBottom: 12,
                            }}>
                                <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                                    <span style={{ color: 'var(--text-muted)', minWidth: 90 }}>State:</span>
                                    <span className="badge badge-resolved">Resolved</span>
                                </div>
                                {edit.resolution && (
                                    <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                                        <span style={{ color: 'var(--text-muted)', minWidth: 90 }}>Resolution:</span>
                                        <span style={{ color: 'var(--text-primary)' }}>
                                            {edit.resolution.replace(/<[^>]+>/g, '').slice(0, 120) || '—'}
                                        </span>
                                    </div>
                                )}
                                {edit.resolutionTime && (
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <span style={{ color: 'var(--text-muted)', minWidth: 90 }}>Resolved At:</span>
                                        <span style={{ color: 'var(--text-primary)' }}>{new Date(edit.resolutionTime).toLocaleString()}</span>
                                    </div>
                                )}
                            </div>
                            <div className="alert alert-warning" style={{ fontSize: 12 }}>
                                Once confirmed, this incident will become <strong>view-only</strong>. No further edits will be permitted.
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowResolveModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                disabled={saving}
                                onClick={() => { setShowResolveModal(false); doSave(); }}
                            >
                                {saving ? <span className="spinner" /> : null}
                                Confirm &amp; Mark Resolved
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit */}
            {activeTab === 'edit' && (
                <div style={{ maxWidth: 760 }}>

                    {/* Silent greyed-out overlay when locked — no banner, just visual dimming */}
                    <div style={isLocked ? { opacity: 0.42, pointerEvents: 'none', userSelect: 'none' } : {}}>

                        {!isLocked && (
                            <div className="alert alert-info mb-4" style={{ fontSize: 12 }}>
                                Only observation, steps, resolution, resolution time, handler, and state can be changed after creation.
                            </div>
                        )}

                        <div className="card mb-4">
                            <div className="card-header"><span className="card-title">State and Assignment</span></div>
                            <div className="grid-2">
                                <div className="form-group">
                                    <label className="form-label">Incident State</label>
                                    {isLocked ? (
                                        <div className="form-control text-muted" style={{ opacity: 0.6, lineHeight: '20px' }}>
                                            {incident.isArchived ? 'Archived — cannot change' : 'Resolved — locked'}
                                        </div>
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
                                            onChange={e => setEdit(f => ({ ...f, resolutionTime: e.target.value }))}
                                            disabled={isLocked} />
                                        <button type="button" className="btn btn-secondary btn-sm"
                                            onClick={() => setEdit(f => ({ ...f, resolutionTime: new Date().toISOString().slice(0, 16) }))}
                                            disabled={isLocked}>
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
                                                onChange={e => setEdit(f => ({ ...f, handledByType: e.target.value }))}
                                                disabled={isLocked} />
                                            {opt.label}
                                        </label>
                                    ))}
                                </div>
                                {edit.handledByType === 'other' && (
                                    <div className="form-group mt-3">
                                        <label className="form-label">Handler Name</label>
                                        <input className="form-control" value={edit.handledByName}
                                            onChange={e => setEdit(f => ({ ...f, handledByName: e.target.value }))}
                                            disabled={isLocked} />
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
                                    readOnly={isLocked}
                                    placeholder={`Document ${section.label.toLowerCase()}...`}
                                />
                            </div>
                        ))}

                    </div>

                    {incident.isArchived && (
                        <div className="alert alert-warning" style={{ marginTop: 4 }}>
                            This incident is archived — all fields are locked. Use Unarchive to reopen it.
                        </div>
                    )}
                    {!isLocked && (
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? <span className="spinner" /> : null}
                            Save Changes
                        </button>
                    )}
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
