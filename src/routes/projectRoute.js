const express = require('express');
const router = express.Router();

const {
  createProject,
  getProjects,
  getProject,
  updateProject,
  deleteProject,
  saveProject,
  removeSavedProject,
} = require('../controllers/projectController');

const { protect, employerOnly } = require('../middlewares/authMiddleware');
const { upload } = require('../utils/cloudinaryHelper');

// Protected
router.post('/', protect, employerOnly, upload, createProject);
router.put('/:id', protect, employerOnly, updateProject);
router.delete('/:id', protect, employerOnly, deleteProject);
router.put('/save/:id', protect, saveProject);
router.delete('/save/:id', protect, removeSavedProject);

// Public
router.get('/', getProjects);
router.get('/:id', getProject);

module.exports = router;