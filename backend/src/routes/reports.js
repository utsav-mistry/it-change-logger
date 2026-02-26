const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticate, requireSetup, requireAdmin } = require('../middleware/auth');

// Dashboard stats: all logged-in users (shown on main Dashboard page)
router.get('/dashboard', requireSetup, authenticate, reportController.getDashboardStats);

// Everything else is admin-only
router.use(requireSetup, authenticate, requireAdmin);
router.get('/data', reportController.getReportData);
router.get('/csv', reportController.generateCSV);
router.get('/pdf', reportController.generatePDF);
router.get('/download-audit', reportController.getDownloadAudit);

module.exports = router;
