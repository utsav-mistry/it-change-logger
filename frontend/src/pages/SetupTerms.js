import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function SetupTerms() {
    const navigate = useNavigate();

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-page)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ maxWidth: 700, width: '100%' }} className="static-page">
                <h2>Terms and Conditions</h2>

                <p>These terms apply during initial setup. By continuing you acknowledge these terms.</p>

                <h3>Main Points</h3>
                <p>Internal use only. No warranty. Actions are logged. Data belongs to the organisation.</p>

                <div style={{ marginTop: 24 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>Back to Setup</button>
                </div>
            </div>
        </div>
    );
}
