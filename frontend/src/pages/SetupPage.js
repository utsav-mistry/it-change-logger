import React, { useState } from 'react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';

const steps = ['Company Info', 'Admin Account', 'Authenticator'];

export default function SetupPage({ onComplete }) {
    const toast = useToast();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        companyName: '', logoBase64: '', logoMimeType: 'image/png',
        adminUsername: '', adminDisplayName: '', adminPassword: '', adminConfirmPassword: '',
        adminRole: 'Admin',
    });
    const [qrData, setQrData] = useState(null);
    const [userId, setUserId] = useState(null);
    const [totpToken, setTotpToken] = useState('');
    const [error, setError] = useState('');
    const [recoveryCodes, setRecoveryCodes] = useState(null);
    const [codesDownloaded, setCodesDownloaded] = useState(false);
    const [redirecting, setRedirecting] = useState(false);
    const [countdown, setCountdown] = useState(5);

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 512 * 1024) { toast.error('Logo must be under 512KB'); return; }
        const reader = new FileReader();
        reader.onload = (ev) => {
            const [header, base64] = ev.target.result.split(',');
            const mimeType = header.match(/:(.*?);/)[1];
            setForm(f => ({ ...f, logoBase64: base64, logoMimeType: mimeType }));
        };
        reader.readAsDataURL(file);
    };

    const startRedirect = () => {
        setRedirecting(true);
        let count = 5;
        setCountdown(count);
        const interval = setInterval(() => {
            count -= 1;
            setCountdown(count);
            if (count <= 0) {
                clearInterval(interval);
                onComplete();
            }
        }, 1000);
    };

    const handleNext = async () => {
        setError('');
        if (step === 0) {
            if (!form.companyName.trim()) { setError('Company name is required'); return; }
            setStep(1);
        } else if (step === 1) {
            if (!form.adminUsername || !form.adminDisplayName || !form.adminPassword) {
                setError('All fields are required'); return;
            }
            if (form.adminPassword !== form.adminConfirmPassword) {
                setError('Passwords do not match'); return;
            }
            if (form.adminPassword.length < 8) {
                setError('Password must be at least 8 characters'); return;
            }
            setLoading(true);
            try {
                const res = await api.post('/setup/complete', form);
                setQrData(res.data.qrDataUrl);
                setUserId(res.data.userId);
                setStep(2);
            } catch (e) {
                setError(e.response?.data?.message || 'Setup failed');
            } finally {
                setLoading(false);
            }
        } else if (step === 2) {
            if (!totpToken || totpToken.length !== 6) { setError('Enter a 6-digit code'); return; }
            setLoading(true);
            try {
                const res = await api.post('/setup/confirm-totp', { userId, token: totpToken });
                const codes = res.data.recoveryCodes;
                if (codes && Array.isArray(codes) && codes.length > 0) {
                    setRecoveryCodes(codes);
                } else {
                    startRedirect();
                }
            } catch (e) {
                setError(e.response?.data?.message || 'Invalid code');
            } finally {
                setLoading(false);
            }
        }
    };

    // ── Redirect countdown screen ───────────────────────────────────────────────
    if (redirecting) {
        const progress = (countdown / 5) * 100;
        return (
            <div className="setup-wrap">
                <div className="setup-card" style={{ position: 'relative', overflow: 'hidden', textAlign: 'center' }}>
                    {/* Success icon */}
                    <div style={{
                        width: 72, height: 72, borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--success), #34d399)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 20px',
                        boxShadow: '0 0 0 12px rgba(34,197,94,0.1)',
                        animation: 'setup-pop 0.4s cubic-bezier(0.175,0.885,0.32,1.275) both',
                    }}>
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
                            stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    </div>

                    <h2 style={{ marginBottom: 8, color: 'var(--text-primary)' }}>Setup Complete!</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
                        Your IT Incident Logger is ready.<br />
                        Redirecting you to the login page&hellip;
                    </p>

                    {/* Countdown circle */}
                    <div style={{
                        width: 56, height: 56, borderRadius: '50%',
                        border: '3px solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 12px',
                        background: 'var(--bg-surface)',
                        fontSize: 22, fontWeight: 700,
                        color: 'var(--accent)',
                    }}>
                        {countdown}
                    </div>

                    <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 24 }}>
                        Redirecting in {countdown} second{countdown !== 1 ? 's' : ''}…
                    </p>

                    <button
                        className="btn btn-primary"
                        onClick={onComplete}
                        style={{ marginBottom: 8 }}
                    >
                        Go to Login →
                    </button>

                    {/* Draining progress bar at the very bottom of the card */}
                    <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        height: 4,
                        background: 'var(--border)',
                        borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
                        overflow: 'hidden',
                    }}>
                        <div style={{
                            height: '100%',
                            width: `${progress}%`,
                            background: 'linear-gradient(90deg, var(--success), #34d399)',
                            transition: 'width 1s linear',
                            borderRadius: 'inherit',
                        }} />
                    </div>
                </div>

                <style>{`
                    @keyframes setup-pop {
                        from { transform: scale(0.5); opacity: 0; }
                        to   { transform: scale(1);   opacity: 1; }
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div className="setup-wrap">
            <div className="setup-card">
                <div className="setup-logo">IT</div>
                <h2 style={{ textAlign: 'center', marginBottom: 4 }}>Initial Setup</h2>
                <p style={{ textAlign: 'center', marginBottom: 28, fontSize: 13, color: 'var(--text-muted)' }}>
                    Configure your IT Incident Logger
                </p>
                <div style={{ textAlign: 'center', marginBottom: 12 }}>
                    <a href="/setup/terms">View Terms of Service</a>
                </div>

                {/* Step indicators */}
                <div className="step-indicator" style={{ justifyContent: 'center', marginBottom: 32 }}>
                    {steps.map((s, i) => (
                        <React.Fragment key={s}>
                            <div className={`step-dot ${i === step ? 'active' : i < step ? 'done' : ''}`} />
                            {i < steps.length - 1 && <div style={{ flex: 1, height: 1, background: i < step ? 'var(--accent-success)' : 'var(--border)' }} />}
                        </React.Fragment>
                    ))}
                </div>

                <h3 style={{ marginBottom: 20 }}>{steps[step]}</h3>

                {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

                {step === 0 && (
                    <>
                        <div className="form-group">
                            <label>Company Name *</label>
                            <input
                                className="form-control"
                                placeholder="Acme Corp"
                                value={form.companyName}
                                onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                            />
                        </div>
                        <div className="form-group">
                            <label>Company Logo (optional, max 512KB)</label>
                            <input type="file" accept="image/*" onChange={handleLogoUpload}
                                style={{ color: 'var(--text-secondary)', fontSize: 13 }} />
                            {form.logoBase64 && (
                                <img src={`data:${form.logoMimeType};base64,${form.logoBase64}`}
                                    alt="preview" style={{ width: 80, height: 80, objectFit: 'contain', borderRadius: 8, marginTop: 8 }} />
                            )}
                        </div>
                    </>
                )}

                {step === 1 && (
                    <>
                        <div className="form-group">
                            <label>Role *</label>
                            <select className="form-control" value={form.adminRole}
                                onChange={e => setForm(f => ({ ...f, adminRole: e.target.value }))}>
                                <option>Admin</option>
                                <option>IT Admin</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Username *</label>
                            <input className="form-control" placeholder="admin" value={form.adminUsername}
                                onChange={e => setForm(f => ({ ...f, adminUsername: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label>Display Name *</label>
                            <input className="form-control" placeholder="John Smith" value={form.adminDisplayName}
                                onChange={e => setForm(f => ({ ...f, adminDisplayName: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label>Password * (min 8 chars)</label>
                            <input type="password" className="form-control" value={form.adminPassword}
                                onChange={e => setForm(f => ({ ...f, adminPassword: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label>Confirm Password *</label>
                            <input type="password" className="form-control" value={form.adminConfirmPassword}
                                onChange={e => setForm(f => ({ ...f, adminConfirmPassword: e.target.value }))} />
                        </div>
                    </>
                )}

                {step === 2 && (
                    <div style={{ textAlign: 'center' }}>
                        <div className="alert alert-info" style={{ marginBottom: 16, textAlign: 'left' }}>
                            Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                        </div>
                        {qrData && (
                            <div className="qr-container">
                                <img src={qrData} alt="QR Code" width={200} height={200} />
                            </div>
                        )}
                        <div className="form-group" style={{ marginTop: 20 }}>
                            <label>Enter 6-digit code from app *</label>
                            <input
                                className="form-control font-mono"
                                placeholder="123456"
                                maxLength={6}
                                value={totpToken}
                                onChange={e => setTotpToken(e.target.value.replace(/\D/g, ''))}
                                style={{ textAlign: 'center', fontSize: 20, letterSpacing: 8 }}
                            />
                        </div>
                    </div>
                )}

                {recoveryCodes && (
                    <div style={{ marginTop: 12 }}>
                        <div className="alert alert-warning" style={{ textAlign: 'left', marginBottom: 12 }}>
                            <strong>Save these recovery codes now!</strong> Each code can be used once to log in if you ever lose access to your authenticator app. They will not be shown again.
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 16 }}>
                            {recoveryCodes.map(c => (
                                <div key={c} className="card" style={{ padding: 10, fontFamily: 'monospace', textAlign: 'center', fontSize: 13 }}>{c}</div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                            <button
                                className="btn btn-secondary w-full"
                                onClick={() => {
                                    const text = recoveryCodes.join('\n');
                                    const blob = new Blob([text], { type: 'text/plain' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = 'recovery-codes.txt';
                                    a.click();
                                    URL.revokeObjectURL(url);
                                    setCodesDownloaded(true);
                                }}
                            >
                                ⬇ Download Recovery Codes
                            </button>
                            <button
                                className="btn btn-primary w-full"
                                disabled={!codesDownloaded}
                                title={!codesDownloaded ? 'Please download your recovery codes first' : ''}
                                onClick={startRedirect}
                            >
                                {codesDownloaded ? 'Finish Setup →' : 'Download codes to continue'}
                            </button>
                        </div>
                    </div>
                )}

                {!recoveryCodes && (
                    <button
                        className="btn btn-primary w-full"
                        style={{ marginTop: 8 }}
                        onClick={handleNext}
                        disabled={loading}
                    >
                        {loading ? <span className="spinner" /> : null}
                        {step === steps.length - 1 ? 'Verify & Complete' : 'Next →'}
                    </button>
                )}
            </div>
        </div>
    );
}
