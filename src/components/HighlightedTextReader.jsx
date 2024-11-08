// HighlightedTextReader.jsx
import React, { useState, useEffect } from 'react';
import ChromeSpeechService from '../services/ChromeSpeechService';

const HighlightedTextReader = ({ text }) => {
  const [highlightedWord, setHighlightedWord] = useState(null);

  useEffect(() => {
    // Configurar el callback para el resaltado de palabras
    console.log('Configurando callback de palabras');
    ChromeSpeechService.setOnWord((wordInfo) => {
      console.log('Palabra actual:', wordInfo);
      setHighlightedWord(wordInfo);
    });

    return () => {
      ChromeSpeechService.setOnWord(null);
    };
  }, []);

  const renderText = () => {
    if (!highlightedWord) {
      return <p className="text-gray-800 dark:text-gray-200">{text}</p>;
    }

    const { start, end } = highlightedWord;
    const beforeWord = text.slice(0, start);
    const word = text.slice(start, end);
    const afterWord = text.slice(end);

    return (
      <p className="text-gray-800 dark:text-gray-200">
        {beforeWord}
        <span className="bg-yellow-200 dark:bg-yellow-600 transition-colors duration-200">
          {word}
        </span>
        {afterWord}
      </p>
    );
  };

  return (
    <div className="prose dark:prose-invert max-w-none">
      {renderText()}
    </div>
  );
};

export default HighlightedTextReader;