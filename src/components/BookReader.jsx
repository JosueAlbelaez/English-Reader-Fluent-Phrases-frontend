import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useBook } from '../context/BookContext';
import { useTheme } from '../context/ThemeContext';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Minus,
  Play,
  Pause,
  Clock,
  Square,
  CornerDownRight
} from 'lucide-react';
import TranslationModal from './translation/TranslationModal';
import AudioProgressBar from './ui/AudioProgressBar';
import ChromeSpeechService from '../services/ChromeSpeechService';

const BookReader = () => {
  const canvasRef = useRef(null);
  const pageLayoutRef = useRef({
    words: [],
    isLayoutCalculated: false
  });
  const [selectedWord, setSelectedWord] = useState(null);
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSlow, setIsSlow] = useState(false);
  const [progress, setProgress] = useState(0);
  const [highlightedWordInfo, setHighlightedWordInfo] = useState(null);
  const [wordPositions, setWordPositions] = useState([]);
  const [pageInputValue, setPageInputValue] = useState('');
  // Añadir estados faltantes para la selección de texto
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  const { darkMode } = useTheme();
  
  const {
    currentBook,
    currentPage,
    fontSize,
    setFontSize,
    nextPage,
    previousPage,
    setCurrentPage
  } = useBook();

  const currentPageText = currentBook?.content?.find(p => p.pageNumber === currentPage)?.text || '';

  useEffect(() => {
    ChromeSpeechService.setOnProgress(setProgress);
    
    ChromeSpeechService.setOnWord((wordInfo) => {
      if (wordInfo) {
        setHighlightedWordInfo(wordInfo);
      }
    });

    ChromeSpeechService.setOnEnd(() => {
      setIsPlaying(false);
      setProgress(0);
      setHighlightedWordInfo(null);
      if (currentPage < (currentBook?.content?.length || 1)) {
        nextPage();
      }
    });

    return () => {
      ChromeSpeechService.stop();
      setHighlightedWordInfo(null);
    };
  }, [currentPage, currentBook, nextPage]);

  const calculatePageLayout = useCallback(() => {
    if (!currentBook?.content || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pageContent = currentBook.content.find(p => p.pageNumber === currentPage);
    if (!pageContent) return;

    ctx.font = `${fontSize}px Arial`;
    const words = pageContent.text.split(' ');
    let x = 20;
    let y = 40;
    const lineHeight = fontSize * 1.5;
    const maxWidth = canvas.width - 40;
    const newWordPositions = [];

    let accumulatedText = '';
    words.forEach((word, index) => {
      const metrics = ctx.measureText(word + ' ');
      if (x + metrics.width > maxWidth) {
        x = 20;
        y += lineHeight;
      }

      const currentWordStart = accumulatedText.length;
      accumulatedText += word + ' ';
      const currentWordEnd = currentWordStart + word.length;

      newWordPositions.push({
        word,
        x,
        y,
        width: metrics.width,
        height: fontSize,
        start: currentWordStart,
        end: currentWordEnd
      });

      x += metrics.width + ctx.measureText(' ').width;
    });

    pageLayoutRef.current = {
      words: newWordPositions,
      isLayoutCalculated: true
    };
    setWordPositions(newWordPositions);
  }, [currentBook, currentPage, fontSize]);

  const drawPage = useCallback(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!pageLayoutRef.current.isLayoutCalculated) {
      calculatePageLayout();
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.font = `${fontSize}px Arial`;
    pageLayoutRef.current.words.forEach((wordInfo) => {
      // Dibujar highlight si corresponde
      if (highlightedWordInfo && 
          highlightedWordInfo.start !== undefined && 
          highlightedWordInfo.end !== undefined &&
          wordInfo.start >= highlightedWordInfo.start && 
          wordInfo.end <= highlightedWordInfo.end) {
        ctx.fillStyle = darkMode ? 'rgba(59, 130, 246, 0.5)' : 'rgba(253, 224, 71, 0.5)';
        ctx.fillRect(wordInfo.x, wordInfo.y - fontSize + 2, wordInfo.width, fontSize + 4);
      }

      // Dibujar la palabra
      ctx.fillStyle = darkMode ? '#FFFFFF' : '#000000';
      ctx.fillText(wordInfo.word, wordInfo.x, wordInfo.y);
    });
  }, [fontSize, darkMode, highlightedWordInfo, calculatePageLayout]);

  useEffect(() => {
    pageLayoutRef.current.isLayoutCalculated = false;
    calculatePageLayout();
  }, [calculatePageLayout, currentBook, currentPage, fontSize]);

  useEffect(() => {
    const animationFrameId = requestAnimationFrame(drawPage);
    return () => cancelAnimationFrame(animationFrameId);
  }, [drawPage]);

  const handlePlayPause = useCallback(() => {
    if (!currentPageText) return;

    if (isPlaying) {
      ChromeSpeechService.pause();
      setIsPlaying(false);
    } else {
      const currentPosition = ChromeSpeechService.getCurrentPosition();
      ChromeSpeechService.speak(currentPageText, currentPosition, isSlow ? 0.5 : 1.0);
      setIsPlaying(true);
    }
  }, [isPlaying, currentPageText, isSlow]);

  const handleStop = useCallback(() => {
    ChromeSpeechService.stop();
    setIsPlaying(false);
    setProgress(0);
    setHighlightedWordInfo(null);
  }, []);

  const toggleSpeed = useCallback(() => {
    const wasPlaying = isPlaying;
    if (wasPlaying) {
      ChromeSpeechService.stop();
      setIsPlaying(false);
    }
    setIsSlow(!isSlow);
    if (wasPlaying) {
      setTimeout(() => {
        ChromeSpeechService.speak(currentPageText, 0, !isSlow ? 0.5 : 1.0);
        setIsPlaying(true);
      }, 50);
    }
  }, [isPlaying, isSlow, currentPageText]);

  // Manejador para clic en una sola palabra
  const handleSingleWordClick = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    const clickedWord = wordPositions.find(pos => 
      x >= pos.x && 
      x <= pos.x + pos.width &&
      y >= pos.y - pos.height &&
      y <= pos.y
    );

    if (clickedWord) {
      setSelectedWord(clickedWord.word);
      setModalPosition({
        x: e.clientX,
        y: e.clientY
      });
    }
  };

  // Manejador para iniciar la selección
  const handleCanvasMouseDown = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    const clickedWord = wordPositions.find(pos => 
      x >= pos.x && 
      x <= pos.x + pos.width &&
      y >= pos.y - pos.height &&
      y <= pos.y
    );

    if (clickedWord) {
      setIsSelecting(true);
      setSelectionStart(clickedWord);
    }
  };

  // Manejador para finalizar la selección
  const handleCanvasMouseUp = (e) => {
    if (!isSelecting || !selectionStart) {
      // Si no estamos seleccionando o no hay palabra inicial, tratar como clic simple
      handleSingleWordClick(e);
      return;
    }

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    const endWord = wordPositions.find(pos => 
      x >= pos.x && 
      x <= pos.x + pos.width &&
      y >= pos.y - pos.height &&
      y <= pos.y
    );

    if (endWord && selectionStart !== endWord) {
      // Selección de frase
      const startIndex = wordPositions.findIndex(w => w === selectionStart);
      const endIndex = wordPositions.findIndex(w => w === endWord);
      
      // Asegurar que el orden sea correcto (inicio a fin)
      const [first, last] = startIndex <= endIndex 
        ? [startIndex, endIndex] 
        : [endIndex, startIndex];
      
      // Construir la frase seleccionada
      const selectedWords = wordPositions.slice(first, last + 1).map(w => w.word);
      const phrase = selectedWords.join(' ');
      
      setSelectedWord(phrase);
      setModalPosition({
        x: e.clientX,
        y: e.clientY
      });
    }
    
    // Resetear el estado de selección
    setIsSelecting(false);
    setSelectionStart(null);
  };

  const handlePageInputChange = (e) => {
    setPageInputValue(e.target.value);
  };

  const handleGoToPage = () => {
    const pageNumber = parseInt(pageInputValue, 10);
    if (
      !isNaN(pageNumber) && 
      pageNumber >= 1 && 
      pageNumber <= (currentBook?.content?.length || 1)
    ) {
      setCurrentPage(pageNumber);
      setPageInputValue('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleGoToPage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg shadow-lg">
      <div className="flex flex-col p-4 border-b dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={previousPage}
              disabled={currentPage === 1}
              className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-300">
              Page {currentPage} of {currentBook?.content?.length || 1}
            </span>
            <button
              onClick={nextPage}
              disabled={currentPage === (currentBook?.content?.length || 1)}
              className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
            
            {/* Campo para salto de página */}
            <div className="flex items-center ml-4">
              <input
                type="text"
                value={pageInputValue}
                onChange={handlePageInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ir a página..."
                className="w-24 px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
              <button
                onClick={handleGoToPage}
                className="p-2 ml-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Ir a página"
              >
                <CornerDownRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => setFontSize(prev => Math.max(12, prev - 2))}
              className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Minus className="w-6 h-6" />
            </button>
            
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {fontSize}px
            </span>
            
            <button
              onClick={() => setFontSize(prev => Math.min(36, prev + 2))}
              className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Plus className="w-6 h-6" />
            </button>

            <button
              onClick={toggleSpeed}
              className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                isSlow ? 'text-blue-500 dark:text-blue-400' : ''
              }`}
              title={isSlow ? "Normal Speed" : "Slow Speed (50%)"}
            >
              <Clock className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handlePlayPause}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 text-blue-500" />
            ) : (
              <Play className="w-6 h-6 text-gray-700 dark:text-gray-300 fill-current" />
            )}
          </button>

          <button
            onClick={handleStop}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Stop"
          >
            <Square className="w-6 h-6 text-gray-700 dark:text-gray-300 fill-current" />
          </button>

          <AudioProgressBar progress={progress} />
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-4">
        <canvas
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseUp={handleCanvasMouseUp}
          className="w-full h-full bg-white dark:bg-gray-900"
          width={800}
          height={1200}
        />
      </div>

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

export default BookReader;