const Book = require('../models/Book');

// Get all books
exports.getBooks = async (req, res) => {
  try {
    console.log('Fetching all books...');
    const books = await Book.find({});
    console.log('Books found:', books);
    
    res.status(200).json({
      success: true,
      data: books
    });
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching books',
      error: error.message
    });
  }
};

// Get a single book
exports.getBookById = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }
    res.status(200).json({
      success: true,
      data: book
    });
  } catch (error) {
    console.error('Error fetching book:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching book',
      error: error.message
    });
  }
};

// Get a specific page
exports.getBookPage = async (req, res) => {
  try {
    const { id, pageNumber } = req.params;
    const book = await Book.findById(id);
    
    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    const page = book.content.find(p => p.pageNumber === parseInt(pageNumber));
    
    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Page not found'
      });
    }

    res.status(200).json({
      success: true,
      data: page
    });
  } catch (error) {
    console.error('Error fetching page:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching page',
      error: error.message
    });
  }
};

// Download book as PDF
exports.downloadBookPDF = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    
    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    // Por ahora solo enviaremos el contenido como JSON
    res.status(200).json({
      success: true,
      data: book
    });
  } catch (error) {
    console.error('Error downloading book:', error);
    res.status(500).json({
      success: false,
      message: 'Error downloading book',
      error: error.message
    });
  }
};