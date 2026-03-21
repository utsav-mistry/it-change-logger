const { exec } = require('child_process');
const { promisify } = require('util');
const logger = require('../utils/logger');

const execAsync = promisify(exec);

/**
 * GET /api/status/pm2
 * -------------------
 * Runs `pm2 jlist` and returns the parsed JSON array of process descriptors.
 * Intended for the status dashboard only — consider adding auth middleware
 * in production to restrict access to trusted internal clients.
 */
async function pm2Status(req, res) {
    try {
        const { stdout } = await execAsync('pm2 jlist', { timeout: 5000 });
        let processes;
        try {
            processes = JSON.parse(stdout);
        } catch {
            return res.status(502).json({ error: 'Failed to parse pm2 jlist output' });
        }

        // Expose only the fields the UI needs (avoid leaking internal paths etc.)
        const sanitized = processes.map((p) => ({
            name: p.name,
            pm_id: p.pm_id,
            monit: p.monit,            // { cpu, memory }
            pm2_env: {
                status: p.pm2_env?.status,
                exec_mode: p.pm2_env?.exec_mode,
                pm_uptime: p.pm2_env?.pm_uptime,
                restart_time: p.pm2_env?.restart_time,
                node_version: p.pm2_env?.node_version,
            },
        }));

        res.status(200).json(sanitized);
    } catch (err) {
        logger.error(`[PM2 Status] ${err.message}`);
        res.status(500).json({ error: 'Unable to retrieve PM2 status', detail: err.message });
    }
}

module.exports = { pm2Status };
