import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/client';

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();
    const [step, setStep] = useState('credentials'); // credentials | totp_verify | totp_enroll
    const [company, setCompany] = useState(null);
    const [form, setForm] = useState({ username: '', password: '', token: '', recoveryCode: '' });
    const [userId, setUserId] = useState(null);
    const [qrData, setQrData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [termsAccepted, setTermsAccepted] = useState(false);
    // Show terms immediately on first render if never accepted — no flicker, no useEffect delay
    const [showTerms, setShowTerms] = useState(() => !localStorage.getItem('terms_accepted'));
    const [useRecovery, setUseRecovery] = useState(false); // toggle recovery code login

    useEffect(() => {
        api.get('/setup/company').then(r => setCompany(r.data)).catch(() => { });
    }, []);

    const handleCredentials = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await api.post('/auth/login', {
                username: form.username, password: form.password
            });
            setUserId(res.data.userId);
            if (res.data.step === 'totp_enroll') {
                const qrRes = await api.get(`/auth/totp-qr/${res.data.userId}`);
                setQrData(qrRes.data.qrDataUrl);
                setStep('totp_enroll');
            } else {
                setStep('totp_verify');
            }
        } catch (e) {
            toast.error(e.response?.data?.message || 'Invalid username or password');
        } finally {
            setLoading(false);
        }
    };

    const handleTotpVerify = async (e) => {
        e.preventDefault();
        if (!form.token || form.token.length !== 6) { toast.error('Enter a 6-digit code from your authenticator app'); return; }
        setLoading(true);
        try {
            const res = await api.post('/auth/verify-totp', { userId, token: form.token });
            login(res.data.token, res.data.user);
            localStorage.setItem('terms_accepted', 'true');
            navigate('/dashboard');
            toast.success(`Welcome back, ${res.data.user.displayName}!`);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Invalid or expired TOTP code');
            setForm(f => ({ ...f, token: '' }));
        } finally {
            setLoading(false);
        }
    };

    const handleTotpEnroll = async (e) => {
        e.preventDefault();
        if (!form.token || form.token.length !== 6) { toast.error('Enter the 6-digit code from your authenticator app'); return; }
        setLoading(true);
        try {
            const res = await api.post('/auth/enroll-totp', { userId, token: form.token });
            login(res.data.token, res.data.user);
            localStorage.setItem('terms_accepted', 'true');
            navigate('/dashboard');
            toast.success(`Welcome, ${res.data.user.displayName}!`);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Invalid code — check your authenticator and try again');
            setForm(f => ({ ...f, token: '' }));
        } finally {
            setLoading(false);
        }
    };

    const handleRecoveryVerify = async (e) => {
        e.preventDefault();
        if (!form.recoveryCode || form.recoveryCode.trim().length < 6) { toast.error('Enter your recovery code'); return; }
        setLoading(true);
        try {
            const res = await api.post('/auth/verify-recovery', { userId, code: form.recoveryCode.trim() });
            login(res.data.token, res.data.user);
            localStorage.setItem('terms_accepted', 'true');
            navigate('/dashboard');
            toast.success(`Welcome back, ${res.data.user.displayName}! Recovery code used — please generate new codes.`);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Invalid or already-used recovery code');
            setForm(f => ({ ...f, recoveryCode: '' }));
        } finally {
            setLoading(false);
        }
    };

    const stepLabels = { credentials: 'Sign In', totp_verify: useRecovery ? 'Recovery Code' : 'Verify Identity', totp_enroll: 'Setup Authenticator' };

    return (
        <div className="login-wrap">
            {/* Terms modal for first login */}
            {/* Only show the terms modal while on the credentials step, never during TOTP */}
            {showTerms && step === 'credentials' && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: 640 }}>
                        <div className="modal-header">
                            <h3>Terms and Conditions</h3>
                        </div>
                        <div style={{ maxHeight: '60vh', overflowY: 'auto', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.8 }}>
                            <p><strong style={{ color: 'var(--text-primary)' }}>Internal Use Only</strong></p>
                            <p>This software is provided exclusively for internal IT operations. Unauthorized access is strictly prohibited.</p>
                            <p><strong style={{ color: 'var(--text-primary)' }}>No Warranty</strong></p>
                            <p>This system is provided as-is without warranty of any kind. The organisation assumes no liability for issues arising from use.</p>
                            <p><strong style={{ color: 'var(--text-primary)' }}>Data Ownership</strong></p>
                            <p>All data entered into this system is owned by the organisation. Users may not extract, distribute, or retain data outside authorised channels.</p>
                            <p><strong style={{ color: 'var(--text-primary)' }}>Audit & Monitoring</strong></p>
                            <p>All user actions within this system are logged and audited. By using this system, you consent to such monitoring.</p>
                            <p><strong style={{ color: 'var(--text-primary)' }}>Access Control</strong></p>
                            <p>The organisation is responsible for granting and revoking access. Users must report suspicion of unauthorised access immediately.</p>
                            <p>
                                <a href="/terms" target="_blank" style={{ color: 'var(--accent-primary)' }}>View full Terms and Conditions</a>
                            </p>
                        </div>
                        <div style={{ marginTop: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>
                                <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} />
                                I accept the Terms and Conditions
                            </label>
                            <button
                                className="btn btn-primary btn-sm"
                                disabled={!termsAccepted}
                                onClick={() => { setShowTerms(false); localStorage.setItem('terms_accepted', 'true'); }}
                                style={{ marginLeft: 'auto' }}
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Left panel */}
            <div className="login-left">
                <div style={{ position: 'relative', textAlign: 'center' }}>
                    {company?.logoBase64 ? (
                        <img src={`data:${company.logoMimeType};base64,${company.logoBase64}`}
                            alt="Company Logo" style={{ width: 80, height: 80, objectFit: 'contain', borderRadius: 12, marginBottom: 24 }} />
                    ) : (
                        <div style={{
                            width: 80, height: 80, borderRadius: 16,
                            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 32, margin: '0 auto 24px', fontWeight: 'bold', color: 'white'
                        }}>IT</div>
                    )}
                    <h1 style={{ fontSize: '1.8rem', marginBottom: 12 }}>{company?.companyName || 'IT Logger'}</h1>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: 320, margin: '0 auto', fontSize: 15, lineHeight: 1.7 }}>
                        Secure internal IT Change and Incident Management
                    </p>
                    <div style={{ marginTop: 48, display: 'flex', gap: 16, justifyContent: 'center' }}>
                        {['Secure', 'Audited', 'Fast'].map(item => (
                            <div key={item} style={{
                                background: 'rgba(59,130,246,0.1)',
                                border: '1px solid rgba(59,130,246,0.2)',
                                borderRadius: 8, padding: '6px 12px',
                                fontSize: 12, color: 'var(--accent-primary-light)',
                            }}>
                                {item}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right panel */}
            <div className="login-right">
                <div style={{ width: '100%', maxWidth: 380 }}>
                    <div className="step-indicator" style={{ marginBottom: 32 }}>
                        <div className={`step-dot ${step === 'credentials' ? 'active' : 'done'}`} />
                        <div style={{ flex: 1, height: 1, background: step !== 'credentials' ? 'var(--accent-success)' : 'var(--border)' }} />
                        <div className={`step-dot ${step === 'totp_verify' || step === 'totp_enroll' ? 'active' : ''}`} />
                    </div>

                    <h2 style={{ marginBottom: 4 }}>{stepLabels[step]}</h2>
                    <p className="text-secondary" style={{ marginBottom: 28, fontSize: 13 }}>
                        {step === 'credentials' && 'Enter your IT credentials to continue'}
                        {step === 'totp_verify' && 'Enter the code from your authenticator app'}
                        {step === 'totp_enroll' && 'Scan the QR code and enter the 6-digit code'}
                    </p>

                    {step === 'credentials' && (
                        <form onSubmit={handleCredentials}>
                            <div className="form-group">
                                <label>Username</label>
                                <input
                                    className="form-control"
                                    autoComplete="username"
                                    placeholder="your.username"
                                    value={form.username}
                                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Password</label>
                                <input
                                    type="password"
                                    className="form-control"
                                    autoComplete="current-password"
                                    placeholder="••••••••"
                                    value={form.password}
                                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                    required
                                />
                            </div>
                            <button type="submit" className="btn btn-primary w-full" style={{ marginTop: 8 }} disabled={loading}>
                                {loading ? <span className="spinner" /> : null}
                                Continue →
                            </button>
                        </form>
                    )}

                    {step === 'totp_verify' && !useRecovery && (
                        <form onSubmit={handleTotpVerify}>
                            <div className="form-group">
                                <label>6-Digit TOTP Code</label>
                                <input
                                    className="form-control font-mono"
                                    placeholder="000000"
                                    maxLength={6}
                                    value={form.token}
                                    onChange={e => setForm(f => ({ ...f, token: e.target.value.replace(/\D/g, '') }))}
                                    autoFocus
                                    style={{ textAlign: 'center', fontSize: 24, letterSpacing: 12 }}
                                />
                            </div>
                            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                                {loading ? <span className="spinner" /> : null}
                                Verify & Login
                            </button>
                            <button type="button" className="btn btn-secondary w-full" style={{ marginTop: 8 }}
                                onClick={() => { setStep('credentials'); setError(''); setUseRecovery(false); }}>
                                ← Back
                            </button>
                            <div style={{ textAlign: 'center', marginTop: 12 }}>
                                <button type="button" className="btn btn-ghost btn-sm"
                                    style={{ color: 'var(--text-muted)', fontSize: 12, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
                                    onClick={() => { setUseRecovery(true); setError(''); }}>
                                    Lost access to authenticator? Use a recovery code
                                </button>
                            </div>
                        </form>
                    )}

                    {step === 'totp_verify' && useRecovery && (
                        <form onSubmit={handleRecoveryVerify}>
                            <div className="alert alert-warning" style={{ marginBottom: 16, fontSize: 12 }}>
                                Recovery codes are single-use. After login, visit Profile to generate new codes.
                            </div>
                            <div className="form-group">
                                <label>Recovery Code</label>
                                <input
                                    className="form-control font-mono"
                                    placeholder="xxxxxx-xxxxxx"
                                    value={form.recoveryCode}
                                    onChange={e => setForm(f => ({ ...f, recoveryCode: e.target.value }))}
                                    autoFocus
                                    style={{ textAlign: 'center', fontSize: 16, letterSpacing: 4 }}
                                />
                            </div>
                            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                                {loading ? <span className="spinner" /> : null}
                                Login with Recovery Code
                            </button>
                            <button type="button" className="btn btn-secondary w-full" style={{ marginTop: 8 }}
                                onClick={() => { setUseRecovery(false); setError(''); }}>
                                ← Back to Authenticator
                            </button>
                        </form>
                    )}

                    {step === 'totp_enroll' && (
                        <form onSubmit={handleTotpEnroll}>
                            <div className="alert alert-info" style={{ marginBottom: 16, fontSize: 12 }}>
                                Scan with Google Authenticator, Authy, or any RFC-6238 app
                            </div>
                            {qrData && (
                                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                                    <div className="qr-container" style={{ display: 'inline-flex' }}>
                                        <img src={qrData} alt="QR Code" width={180} height={180} />
                                    </div>
                                </div>
                            )}
                            <div className="form-group">
                                <label>Enter Code from App</label>
                                <input
                                    className="form-control font-mono"
                                    placeholder="000000"
                                    maxLength={6}
                                    value={form.token}
                                    onChange={e => setForm(f => ({ ...f, token: e.target.value.replace(/\D/g, '') }))}
                                    style={{ textAlign: 'center', fontSize: 24, letterSpacing: 12 }}
                                />
                            </div>
                            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                                {loading ? <span className="spinner" /> : null}
                                Enroll & Login
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
