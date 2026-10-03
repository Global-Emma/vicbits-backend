const express = require('express');
const { getPublicContent, createContactInquiry } = require('../controllers/publicController');

const router = express.Router();

router.get('/content', getPublicContent);
router.post('/contact', createContactInquiry);

module.exports = router;
