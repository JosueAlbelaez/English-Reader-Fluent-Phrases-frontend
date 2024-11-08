import React from 'react';
import { usePDF } from '../../context/PDFContext';
import { 
  ZoomIn, 
  ZoomOut, 
  ChevronLeft, 
  ChevronRight,
  Play,
  Pause,
  Download
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

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 10, 50));

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => prev + 1); // Asumiendo que validamos el máximo en otro lugar
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