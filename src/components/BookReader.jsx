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
  const containerRef = useRef(null);
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
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  // Estados para rastrear las palabras seleccionadas
  const [selectedWordRange, setSelectedWordRange] = useState({ first: -1, last: -1 });
  const [currentMousePosition, setCurrentMousePosition] = useState(null);
  // Estado para detectar si estamos en un dispositivo táctil
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  // Estado para controlar la altura del canvas
  const [canvasHeight, setCanvasHeight] = useState(1200);
  // Estados para mejorar la detección de gestos táctiles
  const [touchStartPosition, setTouchStartPosition] = useState(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [lastTouchTime, setLastTouchTime] = useState(0);
  // Estado para controlar la posición de visualización
  const [scrollPosition, setScrollPosition] = useState(0);
  
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

  // Detectar si estamos en un dispositivo táctil
  useEffect(() => {
    const detectTouch = () => {
      setIsTouchDevice(true);
      window.removeEventListener('touchstart', detectTouch);
    };
    
    window.addEventListener('touchstart', detectTouch);
    
    return () => {
      window.removeEventListener('touchstart', detectTouch);
    };
  }, []);

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

    // Calcular la altura necesaria para el canvas basado en la última palabra
    const lastWord = newWordPositions[newWordPositions.length - 1];
    const requiredHeight = lastWord ? lastWord.y + lineHeight * 2 : 1200;
    
    // Actualizar la altura del canvas si es necesario
    if (requiredHeight > canvasHeight) {
      setCanvasHeight(requiredHeight);
    }

    pageLayoutRef.current = {
      words: newWordPositions,
      isLayoutCalculated: true
    };
    setWordPositions(newWordPositions);
  }, [currentBook, currentPage, fontSize, canvasHeight]);

  // Ajustar el tamaño del canvas cuando cambia el tamaño de la ventana
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        canvasRef.current.width = containerWidth;
        pageLayoutRef.current.isLayoutCalculated = false;
        calculatePageLayout();
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [calculatePageLayout]);

  // Resetear la altura del canvas cuando cambia la página o el tamaño de fuente
  useEffect(() => {
    setCanvasHeight(1200);
    pageLayoutRef.current.isLayoutCalculated = false;
    // Resetear la posición de scroll al cambiar de página
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
      setScrollPosition(0);
    }
  }, [currentPage, fontSize]);

  // Manejar eventos de scroll para mantener el renderizado
  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        setScrollPosition(containerRef.current.scrollTop);
        // Forzar un re-renderizado del canvas durante el scroll
        drawPage();
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
    }

    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  const drawPage = useCallback(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!pageLayoutRef.current.isLayoutCalculated) {
      calculatePageLayout();
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.font = `${fontSize}px Arial`;
    pageLayoutRef.current.words.forEach((wordInfo, index) => {
      // Dibujar highlight para palabras seleccionadas
      if (selectedWordRange.first !== -1 && selectedWordRange.last !== -1) {
        if (index >= selectedWordRange.first && index <= selectedWordRange.last) {
          ctx.fillStyle = darkMode ? 'rgba(59, 130, 246, 0.5)' : 'rgba(253, 224, 71, 0.5)';
          ctx.fillRect(wordInfo.x, wordInfo.y - fontSize + 2, wordInfo.width, fontSize + 4);
        }
      }
      // Dibujar highlight para reproducción de audio
      else if (highlightedWordInfo && 
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
  }, [fontSize, darkMode, highlightedWordInfo, calculatePageLayout, selectedWordRange]);

  useEffect(() => {
    pageLayoutRef.current.isLayoutCalculated = false;
    calculatePageLayout();
  }, [calculatePageLayout, currentBook, currentPage, fontSize]);

  useEffect(() => {
    const animationFrameId = requestAnimationFrame(drawPage);
    return () => cancelAnimationFrame(animationFrameId);
  }, [drawPage, scrollPosition]); // Añadir scrollPosition como dependencia

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

  // Función para convertir coordenadas de pantalla a coordenadas del canvas
  const getCanvasCoordinates = (clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height) + scrollPosition
    };
  };

  // Función para encontrar la palabra en una posición específica
  const findWordAtPosition = (x, y) => {
    return wordPositions.find(pos => 
      x >= pos.x && 
      x <= pos.x + pos.width &&
      y >= pos.y - pos.height &&
      y <= pos.y
    );
  };

  // Función para calcular la distancia entre dos puntos
  const calculateDistance = (point1, point2) => {
    if (!point1 || !point2) return 0;
    return Math.sqrt(
      Math.pow(point2.x - point1.x, 2) + 
      Math.pow(point2.y - point1.y, 2)
    );
  };

  // Manejador para clic en una sola palabra
  const handleSingleWordClick = (clientX, clientY) => {
    const { x, y } = getCanvasCoordinates(clientX, clientY);
    const clickedWord = findWordAtPosition(x, y);

    if (clickedWord) {
      setSelectedWord(clickedWord.word);
      setModalPosition({
        x: clientX,
        y: clientY
      });
      // Limpiar selección
      setSelectedWordRange({ first: -1, last: -1 });
    }
  };

  // Manejador para iniciar la selección (mouse)
  const handleCanvasMouseDown = (e) => {
    const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
    const clickedWord = findWordAtPosition(x, y);

    if (clickedWord) {
      setIsSelecting(true);
      setSelectionStart(clickedWord);
      const startIndex = wordPositions.findIndex(w => w === clickedWord);
      setSelectedWordRange({ first: startIndex, last: startIndex });
    }
  };

  // Manejador para movimiento del mouse durante la selección
  const handleCanvasMouseMove = (e) => {
    if (!isSelecting || !selectionStart) return;

    const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
    setCurrentMousePosition({ x, y });

    const currentWord = findWordAtPosition(x, y);

    if (currentWord) {
      const startIndex = wordPositions.findIndex(w => w === selectionStart);
      const currentIndex = wordPositions.findIndex(w => w === currentWord);
      
      // Asegurar que el orden sea correcto (inicio a fin)
      const [first, last] = startIndex <= currentIndex 
        ? [startIndex, currentIndex] 
        : [currentIndex, startIndex];
      
      setSelectedWordRange({ first, last });
    }
  };

  // Manejador para finalizar la selección (mouse)
  const handleCanvasMouseUp = (e) => {
    if (!isSelecting || !selectionStart) {
      // Si no estamos seleccionando o no hay palabra inicial, tratar como clic simple
      handleSingleWordClick(e.clientX, e.clientY);
      return;
    }

    const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
    const endWord = findWordAtPosition(x, y);

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
      
      // Mantener el resaltado hasta que se cierre el modal
      setSelectedWordRange({ first, last });
    } else {
      // Si solo se seleccionó una palabra, tratarla como clic simple
      handleSingleWordClick(e.clientX, e.clientY);
    }
    
    // Resetear el estado de selección
    setIsSelecting(false);
    setSelectionStart(null);
    setCurrentMousePosition(null);
  };

  // Manejadores para eventos táctiles mejorados
  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    const { x, y } = getCanvasCoordinates(touch.clientX, touch.clientY);
    
    // Guardar la posición inicial del toque
    setTouchStartPosition({ x, y, clientX: touch.clientX, clientY: touch.clientY });
    setLastTouchTime(Date.now());
    
    // Inicialmente no estamos ni seleccionando ni haciendo scroll
    setIsSelecting(false);
    setIsScrolling(false);
    
    // No prevenir el comportamiento por defecto para permitir el scroll
  };

  const handleTouchMove = (e) => {
    if (e.touches.length !== 1 || !touchStartPosition) return;
    
    const touch = e.touches[0];
    const currentPosition = { 
      x: touch.clientX, 
      y: touch.clientY 
    };
    
    // Calcular la distancia movida
    const distance = calculateDistance(
      { x: touchStartPosition.clientX, y: touchStartPosition.clientY },
      currentPosition
    );
    
    // Umbral para considerar que es un scroll (en píxeles)
    const scrollThreshold = 10;
    
    // Si el movimiento supera el umbral, considerarlo como scroll
    if (distance > scrollThreshold) {
      if (!isScrolling) {
        setIsScrolling(true);
        
        // Si estábamos seleccionando, cancelar la selección
        if (isSelecting) {
          setIsSelecting(false);
          setSelectionStart(null);
          setSelectedWordRange({ first: -1, last: -1 });
        }
      }
      
      // No prevenir el comportamiento por defecto para permitir el scroll
      return;
    }
    
    // Si no es scroll y ya estamos seleccionando, actualizar la selección
    if (isSelecting && selectionStart && !isScrolling) {
      const { x, y } = getCanvasCoordinates(touch.clientX, touch.clientY);
      const currentWord = findWordAtPosition(x, y);
      
      if (currentWord) {
        const startIndex = wordPositions.findIndex(w => w === selectionStart);
        const currentIndex = wordPositions.findIndex(w => w === currentWord);
        
        // Asegurar que el orden sea correcto (inicio a fin)
        const [first, last] = startIndex <= currentIndex 
          ? [startIndex, currentIndex] 
          : [currentIndex, startIndex];
        
        setSelectedWordRange({ first, last });
        
        // Prevenir el comportamiento por defecto solo durante la selección
        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = (e) => {
    // Si estábamos haciendo scroll, no hacer nada más
    if (isScrolling) {
      setIsScrolling(false);
      setTouchStartPosition(null);
      return;
    }
    
    // Verificar si fue un toque rápido (tap)
    const touchDuration = Date.now() - lastTouchTime;
    const isTap = touchDuration < 300; // 300ms es un umbral común para un tap
    
    if (e.changedTouches.length === 1 && touchStartPosition && isTap) {
      const touch = e.changedTouches[0];
      const { x, y } = getCanvasCoordinates(touch.clientX, touch.clientY);
      const touchedWord = findWordAtPosition(x, y);
      
      // Si encontramos una palabra y fue un tap, mostrar la traducción
      if (touchedWord) {
        setSelectedWord(touchedWord.word);
        setModalPosition({
          x: touch.clientX,
          y: touch.clientY
        });
        setSelectedWordRange({ first: -1, last: -1 });
        
        // Prevenir el comportamiento por defecto solo para el tap en una palabra
        e.preventDefault();
      }
    } else if (isSelecting && selectionStart) {
      // Si estábamos seleccionando, finalizar la selección
      if (e.changedTouches.length === 1) {
        const touch = e.changedTouches[0];
        const { x, y } = getCanvasCoordinates(touch.clientX, touch.clientY);
        const endWord = findWordAtPosition(x, y);
        
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
            x: touch.clientX,
            y: touch.clientY
          });
          
          // Mantener el resaltado hasta que se cierre el modal
          setSelectedWordRange({ first, last });
          
          // Prevenir el comportamiento por defecto solo para la selección
          e.preventDefault();
        }
      }
    }
    
    // Resetear estados
    setIsSelecting(false);
    setSelectionStart(null);
    setTouchStartPosition(null);
  };

  // Iniciar selección en dispositivos táctiles con doble toque
  const handleDoubleTap = (e) => {
    if (e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    const { x, y } = getCanvasCoordinates(touch.clientX, touch.clientY);
    const touchedWord = findWordAtPosition(x, y);
    
    if (touchedWord) {
      setIsSelecting(true);
      setSelectionStart(touchedWord);
      const startIndex = wordPositions.findIndex(w => w === touchedWord);
      setSelectedWordRange({ first: startIndex, last: startIndex });
      
      // Prevenir el comportamiento por defecto para el doble toque
      e.preventDefault();
    }
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

  // Limpiar selección cuando se cierra el modal
  const handleCloseModal = () => {
    setSelectedWord(null);
    setSelectedWordRange({ first: -1, last: -1 });
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

      <div 
        ref={containerRef} 
        className="flex-1 overflow-auto p-4"
        onScroll={() => {
          if (containerRef.current) {
            setScrollPosition(containerRef.current.scrollTop);
          }
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onDoubleClick={isTouchDevice ? handleDoubleTap : undefined}
          className="w-full bg-white dark:bg-gray-900"
          width={800}
          height={canvasHeight}
          style={{ transform: 'translateZ(0)' }} // Forzar aceleración por hardware
        />
      </div>

      {selectedWord && (
        <TranslationModal
          word={selectedWord}
          position={modalPosition}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

export default BookReader;