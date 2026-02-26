import React from 'react';
import { Link } from 'react-router-dom';

export default function Terms({ standalone }) {
    const content = (
        <div className="static-page">
            <h2>Terms and Conditions</h2>

            <h3>1. Internal Use Only</h3>
            <p>
                This software is provided exclusively for internal IT operations use by authorised employees
                of the organisation. Any unauthorised access, use, or distribution is strictly prohibited
                and may be subject to legal action.
            </p>

            <h3>2. No Warranty / No Liability</h3>
            <p>
                This system is provided "as is" without warranty of any kind, either express or implied. The
                organisation assumes no liability for any issues, data loss, or damages arising from the use
                or inability to use this system.
            </p>

            <h3>3. Data Ownership</h3>
            <p>
                All data entered into this system remains the exclusive property of the organisation. Users
                may not extract, copy, distribute, or retain any system data outside of authorised business
                channels. All data is subject to the organisation's data governance policies.
            </p>

            <h3>4. User Actions Are Logged and Audited</h3>
            <p>
                By using this system, you acknowledge and consent to the monitoring and auditing of all
                actions performed within the system. This includes logins, incident creation, modifications,
                and state changes. Audit records are retained in accordance with organisational policy.
            </p>

            <h3>5. Access Control</h3>
            <p>
                The organisation is solely responsible for granting and revoking access to this system.
                Users must report any suspected unauthorised access or security breach immediately to the
                IT security team. Users may not share credentials with others.
            </p>

            <h3>6. Attribution</h3>
            <p>
                Any redistribution, modification, or derivative work based on this software must retain
                proper attribution to the original author as indicated in this document and in the About
                section of the application.
            </p>

            {!standalone && (
                <div style={{ marginTop: 24 }}>
                    <Link to="/about" className="btn btn-secondary btn-sm">Back to About</Link>
                </div>
            )}
        </div>
    );

    if (standalone) {
        return (
            <div style={{
                minHeight: '100vh',
                background: 'var(--bg-page)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
            }}>
                <div style={{ maxWidth: 700, width: '100%' }}>
                    {content}
                    <div style={{ marginTop: 24 }}>
                        <Link to="/login" className="btn btn-secondary btn-sm">Back to Login</Link>
                    </div>
                </div>
            </div>
        );
    }

    return <div className="animate-fadeIn">{content}</div>;
}
