import React, { useEffect, useState } from 'react';
import { Volume2, X } from 'lucide-react';
import axios from 'axios';

const TranslationModal = ({ word, position, onClose }) => {
  const [translation, setTranslation] = useState('');
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const translateWord = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|es`
        );
        
        if (response.data && response.data.responseData) {
          setTranslation(response.data.responseData.translatedText);
        }
      } catch (error) {
        console.error('Translation error:', error);
        setTranslation('Error en traducción');
      } finally {
        setLoading(false);
      }
    };

    if (word) {
      translateWord();
    }

    return () => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
    };
  }, [word]);

  const handleSpeak = () => {
    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    
    utterance.onend = () => {
      setIsPlaying(false);
    };

    utterance.onerror = () => {
      setIsPlaying(false);
    };

    setIsPlaying(true);
    window.speechSynthesis.cancel(); // Cancelar cualquier reproducción previa
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700"
      style={{
        top: `${Math.min(position.y, window.innerHeight - 200)}px`,
        left: `${Math.min(position.x, window.innerWidth - 300)}px`,
        minWidth: '200px',
        maxWidth: '300px'
      }}
    >
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">
              {word}
            </h3>
            {!loading && (
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                {translation}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
        ) : (
          <div className="mt-3 flex justify-end">
            <button
              onClick={handleSpeak}
              className={`flex items-center gap-2 px-3 py-1 rounded-md transition-colors ${
                isPlaying
                  ? 'bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-200'
                  : 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800'
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span className="text-sm">
                {isPlaying ? 'Reproduciendo...' : 'Escuchar'}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TranslationModal;