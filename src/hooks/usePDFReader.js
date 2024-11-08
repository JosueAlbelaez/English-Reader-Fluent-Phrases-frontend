import { useState, useCallback } from 'react';
import axios from 'axios';
import { usePDF } from '../context/PDFContext';

export const usePDFReader = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { setPdfData, setAnnotations } = usePDF();

  const uploadPDF = useCallback(async (file) => {
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('pdf', file);

      const response = await axios.post('http://localhost:5000/api/pdf/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setPdfData(response.data.data);
      setAnnotations(response.data.data.annotations || []);
      setError(null);
      return response.data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [setPdfData, setAnnotations]);

  const addAnnotation = useCallback(async (pdfId, annotation) => {
    try {
      const response = await axios.post(
        `http://localhost:5000/api/pdf/${pdfId}/annotations`,
        annotation
      );
      setAnnotations(response.data.annotations);
      return response.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [setAnnotations]);

  return {
    loading,
    error,
    uploadPDF,
    addAnnotation,
  };
};