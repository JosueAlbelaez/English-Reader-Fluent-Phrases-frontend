import React, { useState } from 'react';
import { useBook } from '../context/BookContext';
import { useTheme } from '../context/ThemeContext';
import CategorySelector from './CategorySelector';

const BookList = () => {
  const { books, loadBook, loading, error } = useBook();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const { darkMode } = useTheme();

  const filteredBooks = selectedCategory
    ? books.filter(book => book.category === selectedCategory)
    : books;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-red-600 dark:text-red-400">{error}</div>
      </div>
    );
  }

  if (!books || books.length === 0) {
    return (
      <div className="container mx-auto px-2 py-8">
        <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">
          Libros Disponibles
        </h1>
        <div className="text-center text-gray-600 dark:text-gray-400">
          No hay libros disponibles en este momento
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">
        Libros Disponibles
      </h1>

      <CategorySelector 
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      {filteredBooks.length === 0 ? (
        <div className="text-center text-gray-600 dark:text-gray-400">
          No hay libros disponibles en esta categoría
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBooks.map((book) => (
            <div
              key={book._id}
              onClick={() => loadBook(book._id)}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden transition-transform hover:scale-105 cursor-pointer"
            >
              <img
                src={book.image || 'https://via.placeholder.com/400x200?text=Book+Cover'}
                alt={book.title}
                className="w-full h-48 object-cover"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'https://via.placeholder.com/400x200?text=Book+Cover';
                }}
              />
              <div className="p-4">
                <p className="text-sm text-blue-500 dark:text-blue-400 mb-2">
                  {book.category}
                </p>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {book.title}
                </h2>
                <p className="text-gray-600 dark:text-gray-300">
                  por {book.author}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BookList;