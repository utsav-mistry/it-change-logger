const express = require('express');
const router = express.Router();
const incidentController = require('../controllers/incidentController');
const { authenticate, requireSetup } = require('../middleware/auth');

router.use(requireSetup, authenticate);

router.get('/', incidentController.listIncidents);
router.post('/', incidentController.createIncident);
router.get('/:incidentId', incidentController.getIncident);
router.put('/:incidentId', incidentController.updateIncident);
router.get('/:incidentId/audit', incidentController.getAuditLog);
router.get('/:incidentId/timeline', incidentController.getTimeline);

module.exports = router;
