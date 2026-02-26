import React from 'react';

// Priority badges
export const priorityBadge = (priority) => {
    const clsMap = {
        Critical: 'badge badge-critical',
        High: 'badge badge-high',
        Medium: 'badge badge-medium',
        Low: 'badge badge-low',
    };
    return <span className={clsMap[priority] || 'badge badge-neutral'}>{priority || '—'}</span>;
};

// State badges
export const stateBadge = (state) => {
    const clsMap = {
        Open: 'badge badge-open',
        'In Progress': 'badge badge-inprogress',
        'On Hold': 'badge badge-onhold',
        Resolved: 'badge badge-resolved',
        Archived: 'badge badge-archived',
    };
    return <span className={clsMap[state] || 'badge badge-neutral'}>{state || '—'}</span>;
};

// Inline spinner
export const Spinner = ({ size = 'sm' }) => (
    <span className={`spinner ${size === 'lg' ? 'spinner-lg' : ''}`} />
);

// Full-page loading
export const LoadingPage = () => (
    <div className="loading-center">
        <span className="spinner spinner-lg" />
        <span>Loading...</span>
    </div>
);

// Empty state
export const EmptyState = ({ title = 'No data', description = '' }) => (
    <div className="empty-state">
        <h3>{title}</h3>
        {description && <p>{description}</p>}
    </div>
);

// Pagination
export const Pagination = ({ page, totalPages, onChange }) => {
    if (totalPages <= 1) return null;
    const pages = [];
    const range = 5;
    const start = Math.max(1, page - Math.floor(range / 2));
    const end = Math.min(totalPages, start + range - 1);
    for (let i = start; i <= end; i++) pages.push(i);

    return (
        <div className="pagination">
            <button className="pg-btn" disabled={page <= 1} onClick={() => onChange(1)}>«</button>
            <button className="pg-btn" disabled={page <= 1} onClick={() => onChange(page - 1)}>‹</button>
            {start > 1 && <span className="pg-btn text-muted" style={{ pointerEvents: 'none' }}>…</span>}
            {pages.map(p => (
                <button key={p} className={`pg-btn ${p === page ? 'active' : ''}`} onClick={() => onChange(p)}>
                    {p}
                </button>
            ))}
            {end < totalPages && <span className="pg-btn text-muted" style={{ pointerEvents: 'none' }}>…</span>}
            <button className="pg-btn" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>›</button>
            <button className="pg-btn" disabled={page >= totalPages} onClick={() => onChange(totalPages)}>»</button>
        </div>
    );
};

// Modal
export const Modal = ({ title, onClose, children, maxWidth = 520 }) => (
    <div
        className="modal-overlay"
        onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
        <div className="modal" style={{ maxWidth }}>
            <div className="modal-header">
                <span className="font-bold text-primary">{title}</span>
                <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
            </div>
            {children}
        </div>
    </div>
);

// Date formatter
export const formatDateTime = (dt, timezone) => {
    if (!dt) return '—';
    try {
        return new Date(dt).toLocaleString('en-CA', {
            timeZone: timezone || 'UTC',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false,
        }).replace(',', '') + (timezone ? '' : ' UTC');
    } catch {
        return new Date(dt).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    }
};

// Bar chart row for in-app reports (no recharts needed for simple bars)
export const BarRow = ({ label, value, max, color = 'var(--accent)' }) => {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
        <div className="bar-row">
            <div className="bar-label truncate">{label}</div>
            <div className="bar-track">
                <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
            </div>
            <div className="bar-val">{value}</div>
        </div>
    );
};
