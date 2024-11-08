import React, { createContext, useContext, useState, useEffect } from 'react';

const PDFContext = createContext();

export const PDFProvider = ({ children }) => {
  const [pdfData, setPdfData] = useState(() => {
    // Intentar cargar el último PDF del localStorage
    const pdfs = Object.keys(localStorage)
      .filter(key => key.startsWith('pdf_'))
      .map(key => JSON.parse(localStorage.getItem(key)))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    return pdfs[0] || null;
  });
  
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [selectedText, setSelectedText] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isReading, setIsReading] = useState(false);

  // Guardar PDF actual en localStorage cuando cambie
  useEffect(() => {
    if (pdfData && pdfData.id) {
      localStorage.setItem(`pdf_${pdfData.id}`, JSON.stringify(pdfData));
    }
  }, [pdfData]);

  const value = {
    pdfData,
    setPdfData,
    currentPage,
    setCurrentPage,
    zoom,
    setZoom,
    selectedText,
    setSelectedText,
    searchQuery,
    setSearchQuery,
    isReading,
    setIsReading,
  };

  return (
    <PDFContext.Provider value={value}>
      {children}
    </PDFContext.Provider>
  );
};

export const usePDF = () => {
  const context = useContext(PDFContext);
  if (!context) {
    throw new Error('usePDF must be used within a PDFProvider');
  }
  return context;
};