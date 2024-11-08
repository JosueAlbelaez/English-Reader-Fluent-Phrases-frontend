const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const pdfController = require('../controllers/pdfController');

// Upload new PDF
router.post('/upload', upload.single('pdf'), pdfController.uploadPDF);

module.exports = router;