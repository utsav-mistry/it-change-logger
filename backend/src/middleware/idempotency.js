/**
 * Idempotency Middleware
 * ---------------------
 * - Applies to mutating methods: POST, PUT, PATCH, DELETE
 * - Reads  `Idempotency-Key` request header
 * - First request: processes normally, caches response (status + body), returns it
 * - Repeat request: returns exact cached response immediately
 * - No key: request passes through without caching
 * - TTL: 10 minutes (configurable via IDEMPOTENCY_TTL_MS env var)
 *
 * Storage abstraction lets you swap in-memory Map for Redis later
 * by replacing the `store` object below without touching the middleware.
 */

const logger = require('../utils/logger');

// ─── In-memory store (swap for Redis adapter when needed) ────────────────────

const TTL_MS = parseInt(process.env.IDEMPOTENCY_TTL_MS, 10) || 10 * 60 * 1000; // 10 min

/**
 * @typedef {{ status: number, body: any, headers: Record<string,string>, cachedAt: number }} CachedEntry
 */

/** @type {Map<string, CachedEntry>} */
const cache = new Map();

/**
 * Store adapter — replace the body of each method to use Redis:
 *
 *   get(key)          → { status, body, headers, cachedAt } | null
 *   set(key, entry)   → void
 *   delete(key)       → void
 */
const store = {
    get(key) {
        const entry = cache.get(key);
        if (!entry) return null;
        if (Date.now() - entry.cachedAt > TTL_MS) {
            cache.delete(key);
            return null;
        }
        return entry;
    },
    set(key, entry) {
        cache.set(key, { ...entry, cachedAt: Date.now() });
    },
    delete(key) {
        cache.delete(key);
    },
};

// ─── TTL sweeper: remove expired entries every minute ─────────────────────────
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
        if (now - entry.cachedAt > TTL_MS) {
            cache.delete(key);
        }
    }
}, 60 * 1000);

// ─── In-flight tracker (prevents duplicate concurrent requests) ───────────────
/** @type {Set<string>} */
const inFlight = new Set();

// ─── Mutating methods that should be covered ─────────────────────────────────
const COVERED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * idempotency — Express middleware
 *
 * Mount BEFORE your route handlers:
 *   app.use(idempotency);
 */
function idempotency(req, res, next) {
    // Only cover mutating methods
    if (!COVERED_METHODS.has(req.method)) return next();

    const key = req.headers['idempotency-key'];

    // No key → pass through
    if (!key || typeof key !== 'string' || key.trim() === '') return next();

    const trimmedKey = key.trim();

    // ── Hit: return cached response immediately ──────────────────────────────
    const cached = store.get(trimmedKey);
    if (cached) {
        logger.info(`[Idempotency] Cache hit for key="${trimmedKey}" status=${cached.status}`);
        // Restore any cached custom headers
        if (cached.headers) {
            for (const [h, v] of Object.entries(cached.headers)) {
                res.setHeader(h, v);
            }
        }
        res.setHeader('X-Idempotency-Replayed', 'true');
        return res.status(cached.status).json(cached.body);
    }

    // ── In-flight: reject duplicate concurrent requests ──────────────────────
    if (inFlight.has(trimmedKey)) {
        logger.warn(`[Idempotency] Concurrent duplicate for key="${trimmedKey}"`);
        return res.status(409).json({
            error: 'Conflict',
            message: 'A request with this Idempotency-Key is already being processed. Please wait and retry.',
        });
    }

    // ── New request: process and cache ───────────────────────────────────────
    inFlight.add(trimmedKey);

    // Intercept res.json to capture the response body + status
    const originalJson = res.json.bind(res);

    res.json = function (body) {
        // Only cache successful responses (2xx) to avoid caching transient errors
        if (res.statusCode >= 200 && res.statusCode < 300) {
            store.set(trimmedKey, {
                status: res.statusCode,
                body,
                headers: {}, // extend here if you need to cache specific response headers
            });
            logger.info(`[Idempotency] Cached key="${trimmedKey}" status=${res.statusCode} ttl=${TTL_MS}ms`);
        }

        inFlight.delete(trimmedKey);
        return originalJson(body);
    };

    // Ensure in-flight entry is cleaned up even on stream-close / error
    res.on('finish', () => inFlight.delete(trimmedKey));
    res.on('close', () => inFlight.delete(trimmedKey));

    next();
}

module.exports = idempotency;
