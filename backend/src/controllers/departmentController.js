const Department = require('../models/Department');
const User = require('../models/User');

// List departments
exports.listDepartments = async (req, res) => {
    try {
        const departments = await Department.find({ isActive: true })
            .populate('head', 'username displayName')
            .sort({ name: 1 });
        res.json(departments);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Create department
exports.createDepartment = async (req, res) => {
    try {
        const { name, description, headUserId } = req.body;
        if (!name) return res.status(400).json({ message: 'Department name required' });

        const existing = await Department.findOne({ name: name.trim() });
        if (existing) return res.status(409).json({ message: 'Department already exists' });

        const dept = new Department({
            name: name.trim(),
            description: description || '',
            head: headUserId || null,
        });
        await dept.save();

        if (headUserId) {
            await User.findByIdAndUpdate(headUserId, { isDepartmentHead: true, department: dept._id });
        }

        res.status(201).json({ message: 'Department created', department: dept });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Update department
exports.updateDepartment = async (req, res) => {
    try {
        const { name, description, headUserId } = req.body;
        const dept = await Department.findById(req.params.id);
        if (!dept) return res.status(404).json({ message: 'Department not found' });

        // Remove head flag from old head
        if (dept.head && headUserId && dept.head.toString() !== headUserId) {
            await User.findByIdAndUpdate(dept.head, { isDepartmentHead: false });
        }

        if (name) dept.name = name.trim();
        if (description !== undefined) dept.description = description;
        if (headUserId !== undefined) dept.head = headUserId || null;
        await dept.save();

        if (headUserId) {
            await User.findByIdAndUpdate(headUserId, { isDepartmentHead: true, department: dept._id });
        }

        res.json({ message: 'Department updated', department: dept });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Delete department (soft)
exports.deleteDepartment = async (req, res) => {
    try {
        const dept = await Department.findById(req.params.id);
        if (!dept) return res.status(404).json({ message: 'Department not found' });
        dept.isActive = false;
        await dept.save();
        res.json({ message: 'Department deactivated' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};
