const express = require('express');
const router = express.Router();
const translationController = require('../controllers/translationController');

// Translate word
router.post('/translate', translationController.translateWord);

module.exports = router;