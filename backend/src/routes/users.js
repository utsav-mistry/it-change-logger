const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, requireAdmin, requireSetup } = require('../middleware/auth');

router.use(requireSetup, authenticate);

router.get('/', requireAdmin, userController.listUsers);
router.get('/totp-requests', requireAdmin, userController.listTotpRequests);
router.post('/totp-requests/:id/review', userController.reviewTotpRequest);
router.get('/totp-approved-qr', userController.getApprovedTotpQr);
router.post('/request-totp-change', userController.requestTotpChange);
router.post('/:id/totp/recovery/generate', userController.generateRecoveryCodes);
router.post('/change-password', userController.changePassword);
router.post('/', requireAdmin, userController.createUser);
router.get('/:id', requireAdmin, userController.getUser);
router.put('/:id', requireAdmin, userController.updateUser);
router.delete('/:id', requireAdmin, userController.deactivateUser);

module.exports = router;
