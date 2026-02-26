import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { LoadingPage } from '../components/UI';

export default function Settings() {
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState({ companyName: '', logoBase64: '', logoMimeType: 'image/png' });

    useEffect(() => {
        api.get('/setup/company').then(r => setSettings(r.data)).catch(() => { }).finally(() => setLoading(false));
    }, []);

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 512 * 1024) { toast.error('Logo must be under 512 KB'); return; }
        const reader = new FileReader();
        reader.onload = (ev) => {
            const [header, base64] = ev.target.result.split(',');
            const mimeType = header.match(/:(.*?);/)[1];
            setSettings(s => ({ ...s, logoBase64: base64, logoMimeType: mimeType }));
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.put('/setup/company', {
                companyName: settings.companyName,
                logoBase64: settings.logoBase64,
                logoMimeType: settings.logoMimeType,
            });
            toast.success('Company settings saved');
        } catch (e) {
            toast.error(e.response?.data?.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <LoadingPage />;

    return (
        <div style={{ maxWidth: 560 }}>
            <div className="page-header">
                <div className="page-title">Settings</div>
            </div>

            <div className="card">
                <div className="card-header">
                    <span className="card-title">Company Settings</span>
                </div>
                <form onSubmit={handleSave}>
                    <div className="form-group">
                        <label className="form-label">Company Name *</label>
                        <input className="form-control" required value={settings.companyName}
                            onChange={e => setSettings(s => ({ ...s, companyName: e.target.value }))} />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Company Logo (max 512 KB)</label>
                        <input type="file" accept="image/*" onChange={handleLogoUpload}
                            style={{ color: 'var(--text-secondary)', fontSize: 13 }} />
                        {settings.logoBase64 && (
                            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                                <img
                                    src={`data:${settings.logoMimeType || 'image/png'};base64,${settings.logoBase64}`}
                                    alt="Current Logo"
                                    style={{ width: 64, height: 64, objectFit: 'contain', border: '1px solid var(--border)', borderRadius: 4, padding: 4, background: 'var(--bg-surface)' }}
                                />
                                <button
                                    type="button"
                                    className="btn btn-danger btn-sm"
                                    onClick={() => setSettings(s => ({ ...s, logoBase64: '', logoMimeType: 'image/png' }))}
                                >
                                    Remove Logo
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="divider" />

                    <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                        {saving ? <span className="spinner" /> : null}
                        Save Settings
                    </button>
                </form>
            </div>
        </div>
    );
}
