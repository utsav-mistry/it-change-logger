require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const idempotency = require('./middleware/idempotency');
const { globalLimiter } = require('./middleware/rateLimiter');

// ─── Route modules ───────────────────────────────────────────────────────────
const healthRoutes = require('./routes/health');
const setupRoutes = require('./routes/setup');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const departmentRoutes = require('./routes/departments');
const incidentRoutes = require('./routes/incidents');
const reportRoutes = require('./routes/reports');
const notificationRoutes = require('./routes/notifications');
const workLogRoutes = require('./routes/workLogs');
const statusRoutes = require('./routes/status');

// ─── App bootstrap ───────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '127.0.0.1'; // bind to localhost only in prod

connectDB();

// ─── Security & parsing ──────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3000'];

app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? allowedOrigins
        : 'http://localhost:3000',
    credentials: true,
}));

app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ─── Global rate limiter (all routes, 100 req / 15 min / IP) ─────────────────
app.use(globalLimiter);

// ─── Global idempotency (POST, PUT, PATCH, DELETE only) ──────────────────────
app.use(idempotency);

// ─── Health/readiness probes (no auth required) ──────────────────────────────
app.use('/', healthRoutes);

// ─── Auth limiter (stricter: 30 req / 15 min) ────────────────────────────────
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { message: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// ─── API routes ──────────────────────────────────────────────────────────────
app.use('/api/setup', setupRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/worklogs', workLogRoutes);
app.use('/api/status', statusRoutes);

// ─── Frontend SPA static serving (dev only – in prod NGINX handles this) ─────
if (process.env.NODE_ENV !== 'production') {
    const frontendBuild = path.join(__dirname, '../../frontend/build');
    app.use(express.static(frontendBuild));
    app.get('*', (req, res) => {
        res.sendFile(path.join(frontendBuild, 'index.html'));
    });
}

// ─── Global error handler (must be last) ─────────────────────────────────────
app.use(errorHandler);

// ─── Start server ─────────────────────────────────────────────────────────────
const server = app.listen(PORT, HOST, () => {
    logger.info(`Server started on ${HOST}:${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
function shutdown(signal) {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
    // Force-kill after 10 s
    setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
