const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * dbCheck
 * -------
 * Resolves `true` when MongoDB readyState is 1 (connected).
 * Resolves `false` for any other state (disconnected, connecting, etc.).
 *
 * Used internally by the /ready endpoint.
 * Adds a lightweight ping to confirm the connection is truly alive.
 */
async function dbCheck() {
    const state = mongoose.connection.readyState;
    // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
    if (state !== 1) return false;

    try {
        // Ping the primary — fast, cheap, authoritative
        await mongoose.connection.db.admin().ping();
        return true;
    } catch (err) {
        logger.error(`[DB Check] Ping failed: ${err.message}`);
        return false;
    }
}

/**
 * GET /health
 * -----------
 * Always 200 while the process is alive.
 */
async function healthCheck(req, res) {
    const uptimeSeconds = process.uptime();
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = Math.floor(uptimeSeconds % 60);

    res.status(200).json({
        status: 'ok',
        uptime: `${hours}h ${minutes}m ${seconds}s`,
        uptimeSeconds,
        service: 'api',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
    });
}

/**
 * GET /ready
 * ----------
 * 200 → all checks pass
 * 503 → one or more checks fail
 */
async function readinessCheck(req, res) {
    const mongoOk = await dbCheck();

    const checks = {
        mongodb: mongoOk ? 'ok' : 'down',
    };

    const allOk = Object.values(checks).every((v) => v === 'ok');

    return res.status(allOk ? 200 : 503).json({
        status: allOk ? 'ready' : 'unavailable',
        checks,
        timestamp: new Date().toISOString(),
    });
}

module.exports = { healthCheck, readinessCheck, dbCheck };
