import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/client';

const getUserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const nowLocal = () => new Date().toISOString().slice(0, 16);

export default function IncidentCreate() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState({
        raisedAt: nowLocal(),
        raisedAtTimezone: getUserTimezone(),
        raisedBy: '',
        priority: 'Medium',
        channel: 'Teams',
        channelOther: '',
        product: '',
        issue: '',
        state: 'Open',
    });

    const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.raisedBy.trim()) { setError('Raised By is required'); return; }
        if (!form.product.trim()) { setError('Product is required'); return; }
        if (!form.issue.trim()) { setError('Issue description is required'); return; }
        setLoading(true);
        try {
            const res = await api.post('/incidents', {
                ...form,
                raisedAt: new Date(form.raisedAt).toISOString(),
            });
            toast.success(`Incident #${res.data.incident.incidentId} created`);
            navigate(`/incidents/${res.data.incident.incidentId}`);
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to create incident');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: 760 }}>
            <div className="page-header">
                <div>
                    <div className="page-title">New Incident</div>
                    <div className="page-sub">Fields marked with * are immutable after creation</div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>Back</button>
            </div>

            <form onSubmit={handleSubmit}>
                {error && <div className="alert alert-error">{error}</div>}

                <div className="card mb-4">
                    <div className="card-header">
                        <span className="card-title">Incident Details</span>
                        <span className="text-xs text-muted">Immutable after creation</span>
                    </div>

                    <div className="grid-2">
                        <div className="form-group">
                            <label className="form-label">Raised At * ({form.raisedAtTimezone})</label>
                            <div className="flex gap-2">
                                <input type="datetime-local" className="form-control flex-1"
                                    value={form.raisedAt} onChange={e => setField('raisedAt', e.target.value)} />
                                <button type="button" className="btn btn-secondary btn-sm"
                                    onClick={() => setField('raisedAt', nowLocal())}>
                                    Now
                                </button>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Raised By *</label>
                            <input className="form-control" placeholder="Reporter, vendor, system, team..."
                                value={form.raisedBy} onChange={e => setField('raisedBy', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Priority *</label>
                            <select className="form-control" value={form.priority} onChange={e => setField('priority', e.target.value)}>
                                {['Critical', 'High', 'Medium', 'Low'].map(p => <option key={p}>{p}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Channel *</label>
                            <select className="form-control" value={form.channel} onChange={e => setField('channel', e.target.value)}>
                                {['Teams', 'Mail', 'Ticket', 'Other'].map(c => <option key={c}>{c}</option>)}
                            </select>
                        </div>
                        {form.channel === 'Other' && (
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label className="form-label">Specify Channel</label>
                                <input className="form-control" placeholder="e.g., Phone, Slack, Walk-in"
                                    value={form.channelOther} onChange={e => setField('channelOther', e.target.value)} />
                            </div>
                        )}
                        <div className="form-group" style={{ gridColumn: '1/-1' }}>
                            <label className="form-label">Product / System *</label>
                            <input className="form-control" placeholder="Affected system, application, or component"
                                value={form.product} onChange={e => setField('product', e.target.value)} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Issue Description *</label>
                        <textarea className="form-control" placeholder="Describe the issue..." rows={5}
                            value={form.issue} onChange={e => setField('issue', e.target.value)}
                            style={{ fontFamily: 'inherit' }} />
                    </div>
                </div>

                <div className="flex gap-3">
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading && <span className="spinner" />}
                        Create Incident
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
                </div>
            </form>
        </div>
    );
}
