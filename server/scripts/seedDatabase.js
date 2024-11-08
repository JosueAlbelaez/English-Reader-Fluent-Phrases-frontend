// scripts/seedDatabase.js
const mongoose = require('mongoose');
const Book = require('./models/book');
require('dotenv').config();

const booksData = [
  {
    title: "Introducción a la Programación",
    author: "Juan Pérez",
    category: "Tecnología",
    image: "https://via.placeholder.com/400x200?text=Programming",
    content: [
      {
        pageNumber: 1,
        text: "Capítulo 1: Fundamentos de programación"
      },
      {
        pageNumber: 2,
        text: "La programación es el proceso de crear un conjunto de instrucciones..."
      }
    ]
  },
  {
    title: "Historia del Arte",
    author: "María González",
    category: "Humanidades",
    image: "https://via.placeholder.com/400x200?text=Art+History",
    content: [
      {
        pageNumber: 1,
        text: "Capítulo 1: Arte prehistórico"
      },
      {
        pageNumber: 2,
        text: "El arte prehistórico comprende todas las obras realizadas..."
      }
    ]
  },
  {
    title: "Biología Celular",
    author: "Carlos Rodríguez",
    category: "Historias Cortas",
    image: "https://via.placeholder.com/400x200?text=Biology",
    content: [
      {
        pageNumber: 1,
        text: "Capítulo 1: La célula"
      },
      {
        pageNumber: 2,
        text: "La célula es la unidad básica de la vida..."
      }
    ]
  }
];

const seedDatabase = async () => {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Conectado a MongoDB');

    // Limpiar la colección existente
    await Book.deleteMany({});
    console.log('Colección de libros limpiada');

    // Insertar los nuevos datos
    const insertedBooks = await Book.insertMany(booksData);
    console.log(`${insertedBooks.length} libros insertados`);

    console.log('Datos de prueba insertados exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('Error al sembrar la base de datos:', error);
    process.exit(1);
  }
};

seedDatabase();