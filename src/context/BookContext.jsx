import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import axios from 'axios';

const BookContext = createContext();

export const BookProvider = ({ children }) => {
  const [books, setBooks] = useState([]);
  const [currentBook, setCurrentBook] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [fontSize, setFontSize] = useState(16);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [audioPosition, setAudioPosition] = useState(0);

  const loadBooks = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Iniciando carga de libros...'); // Debug log
      const response = await axios.get('http://localhost:5000/api/books');
      console.log('Respuesta de la API:', response.data); // Debug log
      if (response.data.success) {
        setBooks(response.data.data);
        console.log('Libros cargados:', response.data.data); // Debug log
      }
      setError(null);
    } catch (err) {
      console.error('Error loading books:', err);
      setError('Error loading books');
    } finally {
      setLoading(false);
    }
  }, []);

  // Añadido: Cargar libros cuando el componente se monta
  useEffect(() => {
    console.log('BookProvider montado - cargando libros...'); // Debug log
    loadBooks();
  }, [loadBooks]);

  const loadBook = useCallback(async (bookId) => {
    try {
      setLoading(true);
      const response = await axios.get(`http://localhost:5000/api/books/${bookId}`);
      if (response.data.success) {
        setCurrentBook(response.data.data);
        setCurrentPage(1);
        setAudioPosition(0);
      }
    } catch (err) {
      console.error('Error loading book:', err);
      setError('Error loading book');
    } finally {
      setLoading(false);
    }
  }, []);

  const nextPage = useCallback(() => {
    if (currentBook && currentPage < currentBook.content.length) {
      setCurrentPage(prev => prev + 1);
      setAudioPosition(0); // Reset audio position on page change
    }
  }, [currentBook, currentPage]);

  const previousPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      setAudioPosition(0); // Reset audio position on page change
    }
  }, [currentPage]);

  // Añadido: Debug log para el estado actual
  useEffect(() => {
    console.log('Estado actual de books:', books);
  }, [books]);

  const value = {
    books,
    currentBook,
    currentPage,
    fontSize,
    loading,
    error,
    audioPosition,
    setBooks,
    setCurrentBook,
    setCurrentPage,
    setFontSize,
    setAudioPosition,
    loadBooks,
    loadBook,
    nextPage,
    previousPage,
  };

  return (
    <BookContext.Provider value={value}>
      {children}
    </BookContext.Provider>
  );
};

export const useBook = () => {
  const context = useContext(BookContext);
  if (!context) {
    throw new Error('useBook must be used within a BookProvider');
  }
  return context;
};