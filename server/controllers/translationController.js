const axios = require('axios');

// Diccionario de traducciones de ejemplo
const translations = {
  hello: 'hola',
  world: 'mundo',
  book: 'libro',
  read: 'leer',
  write: 'escribir',
  page: 'página',
  chapter: 'capítulo',
  story: 'historia',
  author: 'autor',
  title: 'título',
  // Añade más traducciones según necesites
};

exports.translateWord = async (req, res) => {
  try {
    const { word } = req.body;
    
    if (!word) {
      return res.status(400).json({
        success: false,
        message: 'No word provided',
      });
    }

    // Obtener traducción del diccionario
    const translatedWord = translations[word.toLowerCase()] || word;

    // Simular un pequeño retraso para mostrar el loading state
    await new Promise(resolve => setTimeout(resolve, 300));

    return res.json({
      success: true,
      data: {
        original: word,
        translation: translatedWord
      }
    });

  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error translating word', 
      error: error.message 
    });
  }
};