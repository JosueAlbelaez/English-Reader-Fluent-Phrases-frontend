require('dotenv').config();
const mongoose = require('mongoose');
const Book = require('../models/Book');

const checkData = async () => {
  try {
    // Conectar a MongoDB con el nombre correcto de la base de datos
    await mongoose.connect(process.env.MONGODB_URI, {
      serverApi: {
        version: '1',
        strict: true,
        deprecationErrors: true,
      }
    });

    console.log('Conectado a MongoDB');
    console.log('Base de datos actual:', mongoose.connection.db.databaseName);

    // Listar todas las colecciones
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Colecciones disponibles:', collections.map(c => c.name));

    // Verificar documentos en la colección books
    const books = await Book.find({});
    console.log('Libros encontrados:', books);

    // Si no hay libros, insertamos los datos de ejemplo
    if (books.length === 0) {
      console.log('No hay libros. Insertando datos de ejemplo...');
      
      const sampleBooks = [
        {
          title: "The Great Gatsby",
          author: "F. Scott Fitzgerald",
          image: "https://example.com/great-gatsby-cover.jpg",
          content: [
            {
              pageNumber: 1,
              text: "In my younger and more vulnerable years my father gave me some advice that I've been turning over in my mind ever since."
            },
            {
              pageNumber: 2,
              text: "In consequence, I'm inclined to reserve all judgments, a habit that has opened up many curious natures to me."
            }
          ]
        },
        {
          title: "Moby Dick",
          author: "Herman Melville",
          image: "https://example.com/moby-dick-cover.jpg",
          content: [
            {
              pageNumber: 1,
              text: "Call me Ishmael. Some years ago—never mind how long precisely—having little or no money in my purse."
            },
            {
              pageNumber: 2,
              text: "It is a way I have of driving off the spleen and regulating the circulation."
            }
          ]
        }
      ];

      try {
        const result = await Book.insertMany(sampleBooks);
        console.log('Datos de ejemplo insertados correctamente:', result);
      } catch (insertError) {
        console.error('Error al insertar datos:', insertError);
      }
      
      // Verificar los libros insertados
      const insertedBooks = await Book.find({});
      console.log('Libros después de la inserción:', insertedBooks);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Desconectado de MongoDB');
  }
};

checkData();