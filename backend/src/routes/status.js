const express = require('express');
const router = express.Router();
const { pm2Status } = require('../controllers/statusController');

// GET /api/status/pm2
router.get('/pm2', pm2Status);

module.exports = router;
