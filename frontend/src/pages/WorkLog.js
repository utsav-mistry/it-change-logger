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
    const [content, setContent] = useState('');
    const [history, setHistory] = useState([]);
    const [histTotal, setHistTotal] = useState(0);
    const [histPage, setHistPage] = useState(1);
    const [view, setView] = useState('today'); // today | history
    const [expandedId, setExpandedId] = useState(null);

    useEffect(() => {
        api.get('/worklogs/my/today')
            .then(r => { setToday(r.data); setContent(r.data.content || ''); })
            .catch(() => { })
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

    const submitLog = async () => {
        if (today?.isSubmitted) return;
        const plainText = content.replace(/<[^>]+>/g, '').trim();
        if (!plainText) { toast.error('Work log cannot be empty'); return; }
        if (!window.confirm('Submit today\'s work log? You will not be able to edit it after submission.')) return;
        setSubmitting(true);
        try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const res = await api.post('/worklogs/my/submit', { content, timezone: tz });
            setToday(res.data.log);
            toast.success('Work log submitted');
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
                    ) : (
                        <div className="alert alert-info mb-4">
                            Entry for today ({serverDate}). Save draft at any time. After submission, the entry is locked.
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
                        <div className="flex gap-3">
                            <button className="btn btn-secondary" onClick={saveDraft} disabled={saving}>
                                {saving ? <Spinner /> : null}
                                Save Draft
                            </button>
                            <button className="btn btn-primary" onClick={submitLog} disabled={submitting}>
                                {submitting ? <Spinner /> : null}
                                Submit Work Log
                            </button>
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
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => setExpandedId(expandedId === log._id ? null : log._id)}
                                                >
                                                    {expandedId === log._id ? 'Collapse' : 'View'}
                                                </button>
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
