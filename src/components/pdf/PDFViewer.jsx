import React, { useEffect, useRef } from 'react';
import PDFControls from './PDFControls';
import PDFPage from './PDFPage';
import AnnotationTools from '../annotations/AnnotationTools';
import { usePDF } from '../../context/PDFContext';
import { useSpeech } from '../../hooks/useSpeech';

const PDFViewer = () => {
  const { 
    pdfData, 
    currentPage, 
    zoom,
    isReading,
    setIsReading
  } = usePDF();
  const { speak, stop, speaking } = useSpeech();
  const containerRef = useRef(null);

  useEffect(() => {
    if (isReading) {
      speak(pdfData.text);
    } else {
      stop();
    }
    return () => stop();
  }, [isReading, pdfData, speak, stop]);

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, clientHeight, scrollHeight } = containerRef.current;
      // Implementar paginación infinita si es necesario
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <PDFControls />
      <AnnotationTools />
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="relative mt-4 overflow-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg"
        style={{ 
          height: `calc(100vh - 250px)`,
          minHeight: `${Math.max(500, (zoom / 100) * 1200)}px` // Aumentado de 400/600 a 500/800
        }}
      >
        <div 
          style={{ 
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top left',
            minHeight: `${Math.max(100, (zoom / 100) * 150)}%`, // Aumentado para más espacio vertical
            width: `${Math.max(100, (zoom / 100) * 120)}%`, // Aumentado para más espacio horizontal
            paddingBottom: `${Math.max(50, (zoom / 100) * 100)}px` // Padding adicional en la parte inferior
          }}
          className="transition-transform duration-200"
        >
          <PDFPage 
            text={pdfData.text} 
            pageNumber={currentPage}
          />
        </div>
      </div>
    </div>
  );
};

export default PDFViewer;