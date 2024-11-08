import { useState, useCallback } from 'react';
import axios from 'axios';

export const useTranslation = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const translateWord = useCallback(async (word) => {
    try {
      setLoading(true);
      const response = await axios.post('http://localhost:5000/api/translation/translate', {
        word,
      });
      return response.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    translateWord,
  };
};