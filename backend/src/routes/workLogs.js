const express = require('express');
const router = express.Router();
const workLogController = require('../controllers/workLogController');
const { authenticate, requireAdmin, requireSetup } = require('../middleware/auth');

router.use(requireSetup, authenticate);

// My work log
router.get('/my/today', workLogController.getMyToday);
router.post('/my/draft', workLogController.saveDraft);
router.post('/my/submit', workLogController.submitLog);
router.get('/my/history', workLogController.getMyHistory);

// Admin views
router.get('/admin/all', requireAdmin, workLogController.adminListLogs);
router.get('/admin/export/csv', requireAdmin, workLogController.exportCSV);
router.get('/admin/export/pdf', requireAdmin, workLogController.exportPDF);
router.delete('/:id', workLogController.deleteLog);

module.exports = router;
