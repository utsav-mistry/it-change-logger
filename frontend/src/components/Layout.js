import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

// Nav icon: a minimal SVG text alternative (no emojis)
const Icon = ({ char }) => (
    <span className="nav-icon" style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700 }}>{char}</span>
);

const NAV = [
    { to: '/dashboard', label: 'Dashboard', icon: 'DB' },
    { to: '/incidents', label: 'Incidents', icon: 'IN' },
    { to: '/worklog', label: 'Daily Work Log', icon: 'WL' },
];

const NAV_ADMIN = [
    { to: '/users', label: 'Users', icon: 'US' },
    { to: '/departments', label: 'Departments', icon: 'DP' },
    { to: '/reports', label: 'Reports', icon: 'RP' },
    { to: '/reports/audit', label: 'Download Audit', icon: 'DA' },
    { to: '/worklogs/admin', label: 'All Work Logs', icon: 'WA' },
];

const NAV_ACCOUNT = [
    { to: '/notifications', label: 'Notifications', icon: 'NT', notif: true },
    { to: '/profile', label: 'My Profile', icon: 'PR' },
    { to: '/settings', label: 'Settings', icon: 'ST', adminOnly: true },
    { to: '/about', label: 'About', icon: 'AB' },
];

export default function Layout({ children }) {
    const { user, logout, theme, toggleTheme } = useAuth();
    const location = useLocation();
    const [company, setCompany] = useState(null);
    const [unread, setUnread] = useState(0);

    useEffect(() => {
        api.get('/setup/company').then(r => setCompany(r.data)).catch(() => { });
    }, []);

    useEffect(() => {
        const fetchUnread = () => {
            api.get('/notifications?limit=1').then(r => setUnread(r.data.unreadCount || 0)).catch(() => { });
        };
        fetchUnread();
        const interval = setInterval(fetchUnread, 30000);
        return () => clearInterval(interval);
    }, []);

    const isAdmin = user?.role === 'Admin' || user?.role === 'IT Admin';
    const initials = user?.displayName
        ? user.displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
        : '??';

    return (
        <div className="layout">
            {/* Sidebar */}
            <aside className="sidebar">
                {/* Brand */}
                <div className="sidebar-brand">
                    {company?.logoBase64 ? (
                        <img
                            src={`data:${company.logoMimeType || 'image/png'};base64,${company.logoBase64}`}
                            alt="Logo"
                            className="sidebar-brand-logo"
                        />
                    ) : (
                        <div className="sidebar-brand-logo-placeholder">IT</div>
                    )}
                    <div style={{ overflow: 'hidden' }}>
                        <div className="sidebar-brand-text">
                            {company?.companyName || 'IT Logger'}
                        </div>
                        <div className="sidebar-brand-sub">Change / Incident Logger</div>
                    </div>
                </div>

                {/* Nav */}
                <nav className="sidebar-nav">
                    <div className="nav-section">Operations</div>
                    {NAV.map(item => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                            <Icon char={item.icon} />
                            {item.label}
                        </NavLink>
                    ))}

                    {isAdmin && (
                        <>
                            <div className="nav-section">Administration</div>
                            {NAV_ADMIN.map(item => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    end={item.to === '/reports'}
                                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                >
                                    <Icon char={item.icon} />
                                    {item.label}
                                </NavLink>
                            ))}
                        </>
                    )}

                    <div className="nav-section">Account</div>
                    {NAV_ACCOUNT.filter(i => !i.adminOnly || isAdmin).map(item => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                            <Icon char={item.icon} />
                            {item.label}
                            {item.notif && unread > 0 && (
                                <span className="nav-count">{unread > 99 ? '99+' : unread}</span>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* Theme toggle */}
                <div className="theme-toggle-wrap">
                    <div
                        className="theme-toggle"
                        onClick={toggleTheme}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => e.key === 'Enter' && toggleTheme()}
                        aria-label="Toggle dark/light mode"
                    >
                        <div className={`theme-toggle-switch ${theme === 'light' ? 'on' : ''}`}>
                            <div className="theme-toggle-knob" />
                        </div>
                        <span>{theme === 'light' ? 'Light Mode' : 'Dark Mode'}</span>
                    </div>
                </div>

                {/* User */}
                <div className="sidebar-footer">
                    <div className="sidebar-user">
                        <div className="avatar">{initials}</div>
                        <div style={{ overflow: 'hidden', flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {user?.displayName}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{user?.role}</div>
                        </div>
                        <button
                            className="btn-icon"
                            onClick={logout}
                            title="Sign out"
                            style={{ border: 'none', background: 'none', padding: 4, cursor: 'pointer' }}
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main */}
            <div className="main-content">
                {/* Top bar */}
                <div className="topbar">
                    <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {location.pathname.replace('/', '').replace(/\//g, ' / ') || 'Home'}
                        </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {new Date().toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
                    </div>
                </div>
                <main className="page-content">
                    {children}
                </main>
            </div>
        </div>
    );
}
