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
                await api.post('/setup/confirm-totp', { userId, token: totpToken });
                toast.success('Setup complete! You can now login.');
                onComplete();
            } catch (e) {
                setError(e.response?.data?.message || 'Invalid code');
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <div className="setup-page">
            <div className="setup-card">
                <div className="setup-logo">IT</div>
                <h2 style={{ textAlign: 'center', marginBottom: 4 }}>Initial Setup</h2>
                <p style={{ textAlign: 'center', marginBottom: 28, fontSize: 13, color: 'var(--text-muted)' }}>
                    Configure your IT Incident Logger
                </p>

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

                <button
                    className="btn btn-primary w-full"
                    style={{ marginTop: 8 }}
                    onClick={handleNext}
                    disabled={loading}
                >
                    {loading ? <span className="spinner" /> : null}
                    {step === steps.length - 1 ? 'Complete Setup' : 'Next →'}
                </button>
            </div>
        </div>
    );
}
