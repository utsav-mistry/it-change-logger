// pm2 ecosystem file — manages backend (cluster) + frontend (static SPA)
// Usage:
//   pm2 start ecosystem.config.js
//   pm2 reload ecosystem.config.js  (zero-downtime reload)
//   pm2 delete ecosystem.config.js  (stop + remove all)

module.exports = {
    apps: [
        // ── Backend API ──────────────────────────────────────────────────────────
        {
            name: 'api',
            script: './backend/src/server.js',
            instances: 2,               // cluster mode — 2 workers
            exec_mode: 'cluster',
            watch: false,
            max_memory_restart: '512M',
            restart_delay: 3000,
            env: {
                NODE_ENV: 'development',
                PORT: 4000,
                HOST: '127.0.0.1',
            },
            env_production: {
                NODE_ENV: 'production',
                PORT: 5000,               // NGINX proxies api.myproj.tld → 5000
                HOST: '127.0.0.1',
            },
            error_file: './backend/logs/pm2-error.log',
            out_file: './backend/logs/pm2-out.log',
            time: true,                 // prefix logs with timestamp
            merge_logs: true,
        },

        // ── Frontend SPA ─────────────────────────────────────────────────────────
        // pm2 serve requires the @pm2/io package (bundled since PM2 v5)
        {
            name: 'frontend',
            script: 'serve',            // uses 'serve' npm package
            args: ['-s', 'frontend/build', '-l', '3000'],
            interpreter: 'none',
            exec_mode: 'fork',          // serve is single-process
            watch: false,
            env: {
                NODE_ENV: 'production',
            },
            error_file: './backend/logs/pm2-frontend-error.log',
            out_file: './backend/logs/pm2-frontend-out.log',
            time: true,
        },
    ],
};
