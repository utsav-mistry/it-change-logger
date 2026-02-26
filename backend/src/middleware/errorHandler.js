const logger = require('../utils/logger');

// Log only 5xx errors
module.exports = (err, req, res, next) => {
    if (err.status >= 500 || !err.status) {
        logger.error(`5xx Error: ${err.message} | ${req.method} ${req.path}`);
    }
    const status = err.status || 500;
    res.status(status).json({ message: err.message || 'Internal Server Error' });
};
