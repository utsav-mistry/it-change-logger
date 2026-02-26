const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const { authenticate, requireAdmin, requireSetup } = require('../middleware/auth');

router.use(requireSetup, authenticate);

router.get('/', departmentController.listDepartments);
router.post('/', requireAdmin, departmentController.createDepartment);
router.put('/:id', requireAdmin, departmentController.updateDepartment);
router.delete('/:id', requireAdmin, departmentController.deleteDepartment);

module.exports = router;
