import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

const ICONS = {
    success: '✓',
    error: '✕',
    info: 'i',
};

const DURATION = 4000;

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const dismiss = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const addToast = useCallback((message, type = 'info', duration = DURATION) => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, message, type, duration }]);
        setTimeout(() => dismiss(id), duration);
    }, [dismiss]);

    const success = useCallback((msg, dur) => addToast(msg, 'success', dur), [addToast]);
    const error = useCallback((msg, dur) => addToast(msg, 'error', dur), [addToast]);
    const info = useCallback((msg, dur) => addToast(msg, 'info', dur), [addToast]);

    return (
        <ToastContext.Provider value={{ success, error, info }}>
            {children}
            <div className="toast-stack">
                {toasts.map(t => (
                    <div key={t.id} className={`toast toast-${t.type}`} role="alert" aria-live="assertive">
                        {/* Left accent stripe */}
                        <div className="toast-accent" />

                        {/* Body: icon + text */}
                        <div className="toast-body">
                            <div className="toast-icon">{ICONS[t.type]}</div>
                            <span className="toast-text">{t.message}</span>
                        </div>

                        {/* Dismiss button */}
                        <button
                            className="toast-close"
                            onClick={() => dismiss(t.id)}
                            aria-label="Dismiss notification"
                        >
                            &times;
                        </button>

                        {/* Auto-dismiss progress bar */}
                        <div className="toast-progress">
                            <div
                                className="toast-progress-bar"
                                style={{ animationDuration: `${t.duration ?? DURATION}ms` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
};
