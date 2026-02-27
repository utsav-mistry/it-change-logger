const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireSetup, authenticate } = require('../middleware/auth');

router.post('/login', requireSetup, authController.login);
router.post('/verify-totp', requireSetup, authController.verifyTotp);
router.post('/enroll-totp', requireSetup, authController.enrollTotp);
router.post('/verify-recovery', requireSetup, authController.verifyRecovery);
router.get('/totp-qr/:userId', requireSetup, authController.getTotpQr);
router.get('/profile', authenticate, authController.getProfile);

module.exports = router;
