const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate, requireSetup } = require('../middleware/auth');

router.use(requireSetup, authenticate);

router.get('/', notificationController.getNotifications);
router.post('/mark-read', notificationController.markRead);

module.exports = router;
