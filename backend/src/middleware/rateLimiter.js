const rateLimit = require('express-rate-limit');

/**
 * Global API rate limiter: 100 requests per 15 minutes per IP.
 * Returns 429 with a JSON body on limit exceed.
 */
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,   // RateLimit-* headers (RFC 6585)
    legacyHeaders: false,
    keyGenerator: (req) => req.ip,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please try again after 15 minutes.',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
        });
    },
});

module.exports = { globalLimiter };
