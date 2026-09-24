const express = require('express');
const router = express.Router();

const {
  createService,
  getServices,
  getService,
  updateService,
  deleteService,
} = require('../controllers/serviceController');

const { protect, adminOnly } = require('../middlewares/authMiddleware');

// Protected
router.post('/', protect, adminOnly, createService);
router.put('/:id', protect, adminOnly, updateService);
router.delete('/:id', protect, adminOnly, deleteService);

// Public
router.get('/', getServices);
router.get('/:id', getService);

module.exports = router;