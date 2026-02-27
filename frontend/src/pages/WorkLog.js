import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { LoadingPage, Spinner, formatDateTime } from '../components/UI';
import RichEditor from '../components/RichEditor';

export default function WorkLog() {
    const toast = useToast();
    const [today, setToday] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [confirmSubmit, setConfirmSubmit] = useState(false);
    const [content, setContent] = useState('');
    const [history, setHistory] = useState([]);
    const [histTotal, setHistTotal] = useState(0);
    const [histPage, setHistPage] = useState(1);
    const [view, setView] = useState('today'); // today | history
    const [expandedId, setExpandedId] = useState(null);

    useEffect(() => {
        api.get('/worklogs/my/today')
            .then(r => {
                // 204 = no draft yet this day — show clean empty editor
                if (r.status === 204 || !r.data) {
                    setToday(null);
                    setContent('');
                } else {
                    setToday(r.data);
                    setContent(r.data.content || '');
                }
            })
            .catch(() => { setToday(null); setContent(''); })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (view === 'history') fetchHistory(1);
    }, [view]);

    const fetchHistory = async (pg) => {
        try {
            const res = await api.get(`/worklogs/my/history?page=${pg}&limit=10`);
            setHistory(res.data.logs);
            setHistTotal(res.data.total);
            setHistPage(pg);
        } catch { }
    };

    const saveDraft = async () => {
        if (today?.isSubmitted) return;
        setSaving(true);
        try {
            await api.post('/worklogs/my/draft', { content });
            toast.success('Draft saved');
        } catch (e) {
            toast.error(e.response?.data?.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const deleteDraft = async (id) => {
        try {
            await api.delete(`/worklogs/${id}`);
            toast.success('Draft deleted');
            setConfirmDelete(false);
            const r = await api.get('/worklogs/my/today').catch(() => null);
            if (!r || r.status === 204 || !r.data) { setToday(null); setContent(''); }
            else { setToday(r.data); setContent(r.data.content || ''); }
            if (view === 'history') fetchHistory(histPage);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Delete failed');
            setConfirmDelete(false);
        }
    };

    const submitLog = async () => {
        if (today?.isSubmitted) return;
        const plainText = content.replace(/<[^>]+>/g, '').trim();
        if (!plainText) { toast.error('Work log cannot be empty'); return; }
        setSubmitting(true);
        try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const res = await api.post('/worklogs/my/submit', { content, timezone: tz });
            setToday(res.data.log);
            setConfirmSubmit(false);
            toast.success('Work log submitted — it is now locked.');
        } catch (e) {
            toast.error(e.response?.data?.message || 'Submit failed');
        } finally {
            setSubmitting(false);
        }
    };

    const serverDate = today?.date || new Date().toISOString().slice(0, 10);

    if (loading) return <LoadingPage />;

    return (
        <div className="animate-fadeIn" style={{ maxWidth: 800 }}>
            <div className="page-header">
                <div>
                    <div className="page-title">Daily Work Log</div>
                    <div className="page-sub">Internal IT staff activity record — {serverDate}</div>
                </div>
                <div className="flex gap-2">
                    <button
                        className={`btn btn-sm ${view === 'today' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setView('today')}
                    >
                        Today
                    </button>
                    <button
                        className={`btn btn-sm ${view === 'history' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setView('history')}
                    >
                        My History
                    </button>
                </div>
            </div>

            {view === 'today' && (
                <>
                    {today?.isSubmitted ? (
                        <div className="alert alert-success mb-4">
                            Submitted at {formatDateTime(today.submittedAt, today.submittedAtTimezone)}. This log is now read-only.
                        </div>
                    ) : today?._id ? (
                        <div className="alert alert-info mb-4">
                            Draft in progress for {serverDate}. Save anytime. Once submitted the entry is locked.
                        </div>
                    ) : (
                        <div className="alert alert-info mb-4">
                            No entry yet for {serverDate}. Start writing below and click <strong>Save Draft</strong> or <strong>Submit</strong> when ready.
                        </div>
                    )}

                    <div className="card mb-4">
                        <div className="card-header">
                            <span className="card-title">Work Log — {serverDate}</span>
                            {today?.isSubmitted && (
                                <span className="badge badge-resolved">Submitted</span>
                            )}
                        </div>

                        {today?.isSubmitted ? (
                            <div
                                className="rich-content"
                                style={{ minHeight: 80 }}
                                dangerouslySetInnerHTML={{ __html: today.content || '<p style="color:var(--text-muted)">(No content)</p>' }}
                            />
                        ) : (
                            <RichEditor
                                value={content}
                                onChange={setContent}
                                placeholder="Describe your work activities for today..."
                                allowNumberedList
                            />
                        )}
                    </div>

                    {!today?.isSubmitted && (
                        <div className="flex gap-3" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
                            <button className="btn btn-secondary" onClick={saveDraft} disabled={saving}>
                                {saving ? <Spinner /> : null}
                                Save Draft
                            </button>

                            {/* Delete Draft — inline confirm */}
                            {today?._id && !confirmDelete && (
                                <button className="btn btn-outline" onClick={() => setConfirmDelete(true)} disabled={saving}>
                                    Delete Draft
                                </button>
                            )}
                            {today?._id && confirmDelete && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                                    <span style={{ color: 'var(--danger)', fontWeight: 500 }}>Delete draft?</span>
                                    <button className="btn btn-danger btn-sm" onClick={() => deleteDraft(today._id)}>Yes, delete</button>
                                    <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
                                </span>
                            )}

                            {/* Submit — inline confirm */}
                            {!confirmSubmit && (
                                <button className="btn btn-primary" onClick={() => setConfirmSubmit(true)} disabled={submitting}>
                                    Submit Work Log
                                </button>
                            )}
                            {confirmSubmit && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                                    <span style={{ color: 'var(--warning)', fontWeight: 500 }}>This cannot be undone</span>
                                    <button className="btn btn-primary btn-sm" onClick={submitLog} disabled={submitting}>
                                        {submitting ? <Spinner /> : 'Confirm Submit'}
                                    </button>
                                    <button className="btn btn-secondary btn-sm" onClick={() => setConfirmSubmit(false)}>Cancel</button>
                                </span>
                            )}
                        </div>
                    )}
                </>
            )}

            {view === 'history' && (
                <>
                    <div className="table-wrap mb-4">
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Submitted At</th>
                                    <th>Status</th>
                                    <th>Preview</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.length === 0 ? (
                                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No history found</td></tr>
                                ) : history.map(log => (
                                    <React.Fragment key={log._id}>
                                        <tr>
                                            <td className="font-mono text-sm">{log.date}</td>
                                            <td className="text-sm text-muted">
                                                {log.submittedAt ? new Date(log.submittedAt).toLocaleString() : '—'}
                                            </td>
                                            <td>
                                                {log.isSubmitted
                                                    ? <span className="badge badge-resolved">Submitted</span>
                                                    : <span className="badge badge-onhold">Draft</span>}
                                            </td>
                                            <td className="text-sm text-muted truncate" style={{ maxWidth: 250 }}>
                                                {(log.content || '').replace(/<[^>]+>/g, '').slice(0, 80) || '(empty)'}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <button
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={() => setExpandedId(expandedId === log._id ? null : log._id)}
                                                    >
                                                        {expandedId === log._id ? 'Collapse' : 'View'}
                                                    </button>
                                                    {!log.isSubmitted && (
                                                        <button className="btn btn-outline btn-sm" onClick={() => deleteDraft(log._id)}>
                                                            Delete
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedId === log._id && (
                                            <tr>
                                                <td colSpan={5}>
                                                    <div
                                                        className="rich-content"
                                                        style={{ padding: '12px 16px', background: 'var(--bg-row-alt)' }}
                                                        dangerouslySetInnerHTML={{ __html: log.content || '<p style="color:var(--text-muted)">(empty)</p>' }}
                                                    />
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {histTotal > 10 && (
                        <div className="flex gap-2 items-center">
                            <button
                                className="btn btn-secondary btn-sm"
                                disabled={histPage <= 1}
                                onClick={() => fetchHistory(histPage - 1)}
                            >
                                Previous
                            </button>
                            <span className="text-sm text-muted">Page {histPage} of {Math.ceil(histTotal / 10)}</span>
                            <button
                                className="btn btn-secondary btn-sm"
                                disabled={histPage >= Math.ceil(histTotal / 10)}
                                onClick={() => fetchHistory(histPage + 1)}
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
