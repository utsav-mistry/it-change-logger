const express = require('express');
const router = express.Router();
const setupController = require('../controllers/setupController');
const { requireAdmin, authenticate } = require('../middleware/auth');

// Public - check if initialized
router.get('/status', setupController.checkSetup);

// Public - first time setup
router.post('/complete', setupController.completeSetup);

// Public - confirm totp for setup user
router.post('/confirm-totp', setupController.confirmSetupTotp);

// Public - get company branding
router.get('/company', setupController.getCompanySettings);

// Protected - update company settings
router.put('/company', authenticate, requireAdmin, setupController.updateCompanySettings);

module.exports = router;
