import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';
const TRANSLATE_API_URL = 'https://libretranslate.de/translate';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

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
  try {
    const response = await api.get(`/books/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching book:', error);
    throw error;
  }
};

export const downloadBookPDF = async (bookId) => {
  try {
    const response = await api.get(`/books/${bookId}/download`, {
      responseType: 'blob'
    });
    return response.data;
  } catch (error) {
    console.error('Error downloading book:', error);
    throw error;
  }
};

// Translation Service
export const translateWord = async (word) => {
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
    console.error('Translation error:', error);
    throw error;
  }
};

export default {
  getBooks,
  getBookById,
  downloadBookPDF,
  translateWord
};