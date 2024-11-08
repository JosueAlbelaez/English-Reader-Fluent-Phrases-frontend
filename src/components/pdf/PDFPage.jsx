import React, { useState, useEffect } from 'react';
import { usePDF } from '../../context/PDFContext';
import TranslationModal from '../translation/TranslationModal';

const PDFPage = ({ text, pageNumber }) => {
  const [selectedWord, setSelectedWord] = useState(null);
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const { searchQuery, annotations } = usePDF();

  const handleWordClick = (e) => {
    const word = e.target.textContent;
    const rect = e.target.getBoundingClientRect();
    
    setSelectedWord(word);
    setModalPosition({
      x: rect.left + window.scrollX,
      y: rect.bottom + window.scrollY
    });
  };

  const highlightSearchQuery = (text) => {
    if (!searchQuery) return text;

    const regex = new RegExp(`(${searchQuery})`, 'gi');
    return text.split(regex).map((part, i) => 
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-500">
          {part}
        </mark>
      ) : part
    );
  };

  const renderText = () => {
    const words = text.split(' ');
    return words.map((word, index) => (
      <span
        key={`${word}-${index}`}
        onClick={handleWordClick}
        className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-0.5 rounded"
      >
        {highlightSearchQuery(word)}{' '}
      </span>
    ));
  };

  return (
    <div className="p-8 text-gray-800 dark:text-gray-200">
      {renderText()}
      {selectedWord && (
        <TranslationModal
          word={selectedWord}
          position={modalPosition}
          onClose={() => setSelectedWord(null)}
        />
      )}
    </div>
  );
};

export default PDFPage;