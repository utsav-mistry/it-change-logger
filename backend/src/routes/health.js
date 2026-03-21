const express = require('express');
const router = express.Router();
const { healthCheck, readinessCheck } = require('../controllers/healthController');

/**
 * GET /health  — liveness probe
 * GET /ready   — readiness probe (checks MongoDB)
 */
router.get('/health', healthCheck);
router.get('/ready', readinessCheck);

module.exports = router;
