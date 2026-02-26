import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

export default function About() {
    const [company, setCompany] = useState(null);

    useEffect(() => {
        api.get('/setup/company').then(r => setCompany(r.data)).catch(() => { });
    }, []);

    return (
        <div className="animate-fadeIn">
            <div className="static-page">
                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                    {company?.logoBase64 && (
                        <img
                            src={`data:${company.logoMimeType || 'image/png'};base64,${company.logoBase64}`}
                            alt="Company Logo"
                            style={{ width: 80, height: 80, objectFit: 'contain', borderRadius: 4, marginBottom: 16 }}
                        />
                    )}
                    <h2>About this application</h2>
                </div>

                <div className="card" style={{ marginBottom: 16 }}>
                    <h3>Application</h3>
                    <p style={{ marginTop: 8 }}>
                        <strong style={{ color: 'var(--text-primary)' }}>IT Change / Incident Logger</strong> is an
                        internal IT operations tool designed for IT teams to log, track, and manage incidents and
                        changes efficiently. It is <em>not</em> a public-facing ticket portal.
                    </p>
                </div>

                {company?.companyName && (
                    <div className="card" style={{ marginBottom: 16 }}>
                        <h3>Organisation</h3>
                        <p style={{ marginTop: 8 }}>
                            Deployed for: <strong style={{ color: 'var(--text-primary)' }}>{company.companyName}</strong>
                        </p>
                    </div>
                )}

                <div className="card" style={{ marginBottom: 16 }}>
                    <h3>Key Features</h3>
                    <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                        {[
                            'TOTP-based two-factor authentication (RFC-6238)',
                            'Immutable incident creation fields',
                            'Full audit log and state timeline',
                            'Full-text search with indexed MongoDB queries',
                            'In-app report viewer with charts and date filtering',
                            'CSV and PDF report generation with download audit trail',
                            'Daily Work Log module for IT staff activity tracking',
                            'Dashboard with incident charts',
                            'Role-based access (Admin / IT Admin)',
                            'Department management with head assignment',
                            'In-app notifications',
                            'Dark / Light mode with session persistence',
                        ].map(f => (
                            <li key={f} style={{ marginBottom: 4, color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                {f}
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <h3>Legal</h3>
                            <p style={{ marginTop: 4 }}>For usage terms, please review our Terms and Conditions.</p>
                        </div>
                        <Link to="/terms" className="btn btn-secondary btn-sm">View Terms</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
