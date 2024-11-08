const express = require('express');
const router = express.Router();
const bookController = require('../controllers/bookController');

// Verificar que los controladores existan
console.log('Book Controller:', bookController);

// Get all books
router.get('/', bookController.getBooks);

// Get a single book by ID
router.get('/:id', bookController.getBookById);

// Get a specific page of a book
router.get('/:id/page/:pageNumber', bookController.getBookPage);

// Download book as PDF
router.get('/:id/download', bookController.downloadBookPDF);

module.exports = router;