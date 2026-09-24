const express = require('express');
const router = express.Router();

const {
  applyToProject,
  getProjectApplications,
  getUserApplications,
  acceptApplication,
  rejectApplication,
  deleteApplication,
} = require('../controllers/applicationController');
const { protect } = require('../middlewares/authMiddleware');
const { upload } = require('../utils/cloudinaryHelper');

// Apply
router.post('/:id', protect, upload, applyToProject);

// Get
router.get('/me', protect, getUserApplications);
router.get('/project/:projectId', protect, getProjectApplications);

// Actions
router.put('/accept/:id', protect, acceptApplication);
router.put('/reject/:id', protect, rejectApplication);

// Delete
router.delete('/:id', protect, deleteApplication);

module.exports = router;