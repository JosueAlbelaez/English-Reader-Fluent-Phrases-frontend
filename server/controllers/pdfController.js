const PDFDocument = require('pdfkit');
const Book = require('../models/Book');

exports.getBooks = async (req, res) => {
  try {
    console.log('Fetching books...');
    const books = await Book.find({}).select('title author image');
    console.log('Books found:', books);
    
    res.json({
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

exports.getBookById = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    res.json({
      success: true,
      data: book
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching book',
      error: error.message
    });
  }
};

exports.downloadBookPDF = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    // Crear nuevo documento PDF
    const doc = new PDFDocument({
      size: 'A4',
      margins: {
        top: 50,
        bottom: 50,
        left: 50,
        right: 50
      }
    });

    // Configurar headers para la descarga
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${book.title.replace(/\s+/g, '_')}.pdf"`);

    // Pipe el PDF directamente a la respuesta
    doc.pipe(res);

    // Añadir título
    doc.fontSize(24)
       .font('Helvetica-Bold')
       .text(book.title, {
         align: 'center'
       });

    // Añadir autor
    doc.fontSize(16)
       .font('Helvetica')
       .moveDown()
       .text(`by ${book.author}`, {
         align: 'center'
       })
       .moveDown(2);

    // Añadir contenido
    doc.fontSize(12)
       .font('Helvetica');

    book.content.forEach((page, index) => {
      if (index > 0) {
        doc.addPage();
      }
      
      doc.text(page.text, {
        align: 'justify',
        lineGap: 5
      });
    });

    // Finalizar el PDF
    doc.end();

  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating PDF',
      error: error.message
    });
  }
};