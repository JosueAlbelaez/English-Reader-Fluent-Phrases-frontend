import axios from 'axios';

// Verificación y fallback para la URL base
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const TRANSLATE_API_URL = 'https://libretranslate.de/translate';

// Log para debugging
console.log("API Base URL:", API_BASE_URL);

// Configuración de axios con manejo de errores
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor para manejo global de errores
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.message);
    if (error.response) {
      console.error('Error status:', error.response.status);
      console.error('Error data:', error.response.data);
    }
    return Promise.reject(error);
  }
);

// Book Services
export const getBooks = async () => {
  try {
    const response = await api.get('/books');
    return response.data;
  } catch (error) {
    console.error('Error fetching books:', error);
    throw error;
  }
};

export const getBookById = async (id) => {
  if (!id) throw new Error('Book ID is required');
  try {
    const response = await api.get(`/books/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching book ${id}:`, error);
    throw error;
  }
};

export const downloadBookPDF = async (bookId) => {
  if (!bookId) throw new Error('Book ID is required');
  try {
    const response = await api.get(`/books/${bookId}/download`, {
      responseType: 'blob',
      headers: {
        'Accept': 'application/pdf'
      }
    });
    return response.data;
  } catch (error) {
    console.error(`Error downloading book ${bookId}:`, error);
    throw error;
  }
};

// Translation Service
export const translateWord = async (word) => {
  if (!word) throw new Error('Word is required');
  try {
    const response = await axios.post(TRANSLATE_API_URL, {
      q: word,
      source: "en",
      target: "es",
      format: "text"
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error(`Translation error for word "${word}":`, error);
    throw error;
  }
};

export default {
  getBooks,
  getBookById,
  downloadBookPDF,
  translateWord
};