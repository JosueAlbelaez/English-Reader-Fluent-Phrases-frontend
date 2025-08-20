import React, { useState } from 'react';
import { usePDF } from '../../context/PDFContext';
import { 
  ZoomIn, 
  ZoomOut, 
  ChevronLeft, 
  ChevronRight,
  Play,
  Pause,
  Download,
  CornerDownRight
} from 'lucide-react';

const PDFControls = () => {
  const { 
    zoom, 
    setZoom,
    currentPage,
    setCurrentPage,
    pdfData,
    isReading,
    setIsReading
  } = usePDF();
  
  const [pageInputValue, setPageInputValue] = useState('');

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 10, 50));

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => prev + 1); // Asumiendo que validamos el máximo en otro lugar
  };

  const handlePageInputChange = (e) => {
    // Solo permitir números
    const value = e.target.value.replace(/[^0-9]/g, '');
    setPageInputValue(value);
  };

  const handleGoToPage = () => {
    if (!pageInputValue) return;
    
    const pageNumber = parseInt(pageInputValue, 10);
    // Asumimos que pdfData.totalPages existe o podemos calcular el máximo de otra manera
    const maxPage = pdfData?.totalPages || 100; // Valor por defecto si no hay información
    
    if (pageNumber >= 1 && pageNumber <= maxPage) {
      setCurrentPage(pageNumber);
      setPageInputValue('');
    } else {
      // Opcional: mostrar un mensaje de error
      alert(`Por favor, ingrese un número de página válido (1-${maxPage})`);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleGoToPage();
    }
  };

  const handleDownload = async () => {
    // Implementar lógica de descarga con las anotaciones
    // Usar html2pdf o similar
  };

  return (
    <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
      <div className="flex items-center gap-2">
        <button
          onClick={handlePreviousPage}
          disabled={currentPage === 1}
          className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-sm">
          Page {currentPage}
        </span>
        <button
          onClick={handleNextPage}
          className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        
        {/* Nuevo campo para saltar a una página específica */}
        <div className="flex items-center ml-4">
          <input
            type="text"
            value={pageInputValue}
            onChange={handlePageInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ir a página..."
            className="w-24 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-l bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
          <button
            onClick={handleGoToPage}
            className="p-1 rounded-r border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <CornerDownRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleZoomOut}
          className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <span className="text-sm w-16 text-center">
          {zoom}%
        </span>
        <button
          onClick={handleZoomIn}
          className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsReading(!isReading)}
          className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          {isReading ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5" />
          )}
        </button>
        <button
          onClick={handleDownload}
          className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <Download className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default PDFControls;