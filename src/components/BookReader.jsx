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
  Square
} from 'lucide-react';
import TranslationModal from './translation/TranslationModal';
import AudioProgressBar from './ui/AudioProgressBar';
import ChromeSpeechService from '../services/ChromeSpeechService';

const BookReader = () => {
  // Referencias
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const pageLayoutRef = useRef({
    words: [],
    isLayoutCalculated: false
  });
  const lastMoveTimeRef = useRef(0);
  const renderTimeoutRef = useRef(null);
  const isRenderingRef = useRef(false);
  const touchStartRef = useRef(null);
  const touchTimeoutRef = useRef(null);
  const isTouchSelectionRef = useRef(false);
  // Referencias adicionales para evitar parpadeo
  const selectionRenderRef = useRef(null);
  const isActivelySelectingRef = useRef(false);

  // Estados principales
  const [selectedWord, setSelectedWord] = useState(null);
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSlow, setIsSlow] = useState(false);
  const [progress, setProgress] = useState(0);
  const [highlightedWordInfo, setHighlightedWordInfo] = useState(null);
  const [wordPositions, setWordPositions] = useState([]);
  const [pageInputValue, setPageInputValue] = useState('');
  
  // Estados de selección
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectedWordRange, setSelectedWordRange] = useState({ first: -1, last: -1 });
  const [currentMousePosition, setCurrentMousePosition] = useState(null);
  
  // Estados de dispositivo y UI
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [canvasHeight, setCanvasHeight] = useState(1200);
  const [touchStartPosition, setTouchStartPosition] = useState(null);
  const [isScrolling, setIsScrolling] = useState(false);
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

  // =========================
  // FUNCIONES UTILITARIAS
  // =========================

  // Función para convertir coordenadas de pantalla a coordenadas del canvas
  const getCanvasCoordinates = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height) + scrollPosition
    };
  }, [scrollPosition]);

  // Función para encontrar la palabra en una posición específica
  const findWordAtPosition = useCallback((x, y) => {
    if (!pageLayoutRef.current.words) return null;
    
    return pageLayoutRef.current.words.find(wordInfo => {
      const wordWidth = wordInfo.width || 0;
      const wordHeight = fontSize * 1.2;
      
      return (
        x >= wordInfo.x &&
        x <= wordInfo.x + wordWidth &&
        y >= wordInfo.y - wordHeight &&
        y <= wordInfo.y
      );
    });
  }, [fontSize]);

  // Función para calcular la distancia entre dos puntos
  const calculateDistance = useCallback((point1, point2) => {
    if (!point1 || !point2) return 0;
    return Math.sqrt(
      Math.pow(point2.x - point1.x, 2) + 
      Math.pow(point2.y - point1.y, 2)
    );
  }, []);

  // Función para encontrar frases completas
  const findSentenceAtPosition = useCallback((x, y) => {
    const word = findWordAtPosition(x, y);
    if (!word) return null;
    
    const wordIndex = pageLayoutRef.current.words.findIndex(w => 
      w.x === word.x && w.y === word.y && w.word === word.word
    );
    
    if (wordIndex === -1) return null;
    
    // Buscar el inicio de la frase
    let startIndex = wordIndex;
    while (startIndex > 0) {
      const prevWord = pageLayoutRef.current.words[startIndex - 1].word;
      if (prevWord.endsWith('.') || prevWord.endsWith('!') || prevWord.endsWith('?')) {
        break;
      }
      startIndex--;
    }
    
    // Buscar el final de la frase
    let endIndex = wordIndex;
    while (endIndex < pageLayoutRef.current.words.length - 1) {
      const currentWord = pageLayoutRef.current.words[endIndex].word;
      if (currentWord.endsWith('.') || currentWord.endsWith('!') || currentWord.endsWith('?')) {
        break;
      }
      endIndex++;
    }
    
    return {
      startIndex,
      endIndex,
      words: pageLayoutRef.current.words.slice(startIndex, endIndex + 1)
    };
  }, [findWordAtPosition]);

  // Función para obtener el texto seleccionado
  const getSelectedText = useCallback(() => {
    if (selectedWordRange.first === -1 || !pageLayoutRef.current.words) return '';
    
    return pageLayoutRef.current.words
      .slice(selectedWordRange.first, selectedWordRange.last + 1)
      .map(w => w.word)
      .join(' ');
  }, [selectedWordRange]);

  // =========================
  // RENDERIZADO Y LAYOUT
  // =========================

  // Función para dibujar la página con optimización de renderizado
  const drawPage = useCallback(() => {
    if (isRenderingRef.current) return;
    isRenderingRef.current = true;
    
    if (!canvasRef.current || !pageLayoutRef.current.isLayoutCalculated) {
      isRenderingRef.current = false;
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Usar doble buffer para evitar parpadeos
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = canvas.width;
    offscreenCanvas.height = canvas.height;
    const offscreenCtx = offscreenCanvas.getContext('2d');
    
    offscreenCtx.clearRect(0, 0, canvas.width, canvas.height);
    offscreenCtx.font = `${fontSize}px Arial`;
    offscreenCtx.textBaseline = 'bottom';
    offscreenCtx.fillStyle = darkMode ? '#FFFFFF' : '#000000';

    // Dibujar solo las palabras visibles
    const visibleWords = pageLayoutRef.current.words.filter(wordInfo => 
      wordInfo.y >= scrollPosition - 100 && 
      wordInfo.y <= scrollPosition + canvas.height + 100
    );

    visibleWords.forEach((wordInfo) => {
      const originalIndex = pageLayoutRef.current.words.indexOf(wordInfo);
      
      const isHighlighted = highlightedWordInfo && 
        wordInfo.start >= highlightedWordInfo.start && 
        wordInfo.end <= highlightedWordInfo.end;

      const isSelected = 
        originalIndex >= selectedWordRange.first && 
        originalIndex <= selectedWordRange.last && 
        selectedWordRange.first !== -1;

      if (isHighlighted) {
        offscreenCtx.fillStyle = '#FFD700';
        offscreenCtx.fillText(wordInfo.word, wordInfo.x, wordInfo.y - scrollPosition);
        offscreenCtx.fillStyle = darkMode ? '#FFFFFF' : '#000000';
      } else if (isSelected) {
        offscreenCtx.fillStyle = '#4CAF50';
        offscreenCtx.fillText(wordInfo.word, wordInfo.x, wordInfo.y - scrollPosition);
        offscreenCtx.fillStyle = darkMode ? '#FFFFFF' : '#000000';
      } else {
        offscreenCtx.fillText(wordInfo.word, wordInfo.x, wordInfo.y - scrollPosition);
      }
    });
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(offscreenCanvas, 0, 0);
    
    isRenderingRef.current = false;
  }, [fontSize, darkMode, scrollPosition, highlightedWordInfo, selectedWordRange]);

  // Calcular el layout de la página
  const calculatePageLayout = useCallback(() => {
    if (!currentBook?.content || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (pageLayoutRef.current.isLayoutCalculated && 
        pageLayoutRef.current.fontSize === fontSize &&
        pageLayoutRef.current.canvasWidth === canvas.width) {
      return;
    }
    
    pageLayoutRef.current.fontSize = fontSize;
    pageLayoutRef.current.canvasWidth = canvas.width;
    
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
    words.forEach((word) => {
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

    const lastWord = newWordPositions[newWordPositions.length - 1];
    const requiredHeight = lastWord ? lastWord.y + lineHeight * 2 : 1200;
    
    if (requiredHeight > canvasHeight) {
      setCanvasHeight(requiredHeight);
    }

    pageLayoutRef.current = {
      words: newWordPositions,
      isLayoutCalculated: true,
      fontSize: fontSize,
      canvasWidth: canvas.width
    };
    setWordPositions(newWordPositions);
  }, [currentBook, currentPage, fontSize, canvasHeight]);

  // =========================
  // MANEJADORES DE EVENTOS MOUSE
  // =========================

  // Manejador para clic en una sola palabra
  const handleSingleWordClick = useCallback((clientX, clientY) => {
    const { x, y } = getCanvasCoordinates(clientX, clientY);
    const clickedWord = findWordAtPosition(x, y);

    if (clickedWord) {
      setSelectedWord(clickedWord.word);
      setModalPosition({ x: clientX, y: clientY });
      setSelectedWordRange({ first: -1, last: -1 });
    }
  }, [getCanvasCoordinates, findWordAtPosition]);

  // Manejador para doble clic
  const handleDoubleClick = useCallback((e) => {
    const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
    const sentence = findSentenceAtPosition(x, y);
    
    if (sentence) {
      setSelectedWordRange({ first: sentence.startIndex, last: sentence.endIndex });
      
      const selectedWords = sentence.words.map(w => w.word);
      const phrase = selectedWords.join(' ');
      
      setSelectedWord(phrase);
      setModalPosition({ x: e.clientX, y: e.clientY });
      
      requestAnimationFrame(drawPage);
    }
  }, [getCanvasCoordinates, findSentenceAtPosition, drawPage]);

  // Manejador mouse down
  const handleCanvasMouseDown = useCallback((e) => {
    if (e.detail === 2) {
      handleDoubleClick(e);
      return;
    }
    
    const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
    const clickedWord = findWordAtPosition(x, y);

    if (clickedWord) {
      isActivelySelectingRef.current = true;
      setIsSelecting(true);
      setSelectionStart(clickedWord);
      const startIndex = pageLayoutRef.current.words.findIndex(w => 
        w.x === clickedWord.x && w.y === clickedWord.y && w.word === clickedWord.word
      );
      setSelectedWordRange({ first: startIndex, last: startIndex });
    }
  }, [getCanvasCoordinates, findWordAtPosition, handleDoubleClick]);

  // Manejador mouse move
  const handleCanvasMouseMove = useCallback((e) => {
    if (!isSelecting || !selectionStart) return;
    
    // Throttling más agresivo durante selección activa
    if (Date.now() - lastMoveTimeRef.current < 150) return;
    lastMoveTimeRef.current = Date.now();
    
    const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
    setCurrentMousePosition({ x, y });

    const currentWord = findWordAtPosition(x, y);

    if (currentWord) {
      const startIndex = pageLayoutRef.current.words.findIndex(w => 
        w.x === selectionStart.x && w.y === selectionStart.y && w.word === selectionStart.word
      );
      const currentIndex = pageLayoutRef.current.words.findIndex(w => 
        w.x === currentWord.x && w.y === currentWord.y && w.word === currentWord.word
      );
      
      if (startIndex !== -1 && currentIndex !== -1) {
        const [first, last] = startIndex <= currentIndex 
          ? [startIndex, currentIndex] 
          : [currentIndex, startIndex];
        
        // Solo actualizar si hay cambio real en la selección
        if (selectedWordRange.first !== first || selectedWordRange.last !== last) {
          setSelectedWordRange({ first, last });
          
          // Cancelar renders anteriores y usar un delay más largo
          if (selectionRenderRef.current) {
            clearTimeout(selectionRenderRef.current);
          }
          
          // Delay más largo durante selección activa para reducir parpadeo
          selectionRenderRef.current = setTimeout(() => {
            if (isActivelySelectingRef.current) {
              drawPage();
            }
          }, 50);
        }
      }
    }
  }, [isSelecting, selectionStart, getCanvasCoordinates, findWordAtPosition, drawPage, selectedWordRange]);

  // Manejador mouse up
  const handleCanvasMouseUp = useCallback((e) => {
    // Marcar que ya no estamos seleccionando activamente
    isActivelySelectingRef.current = false;
    
    // Cancelar cualquier render pendiente de selección
    if (selectionRenderRef.current) {
      clearTimeout(selectionRenderRef.current);
      selectionRenderRef.current = null;
    }
    
    if (!isSelecting || !selectionStart) {
      handleSingleWordClick(e.clientX, e.clientY);
      return;
    }

    const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
    const endWord = findWordAtPosition(x, y);

    if (endWord && selectionStart !== endWord) {
      const startIndex = pageLayoutRef.current.words.findIndex(w => 
        w.x === selectionStart.x && w.y === selectionStart.y && w.word === selectionStart.word
      );
      const endIndex = pageLayoutRef.current.words.findIndex(w => 
        w.x === endWord.x && w.y === endWord.y && w.word === endWord.word
      );
      
      if (startIndex !== -1 && endIndex !== -1) {
        const [first, last] = startIndex <= endIndex 
          ? [startIndex, endIndex] 
          : [endIndex, startIndex];
        
        const selectedWords = pageLayoutRef.current.words.slice(first, last + 1).map(w => w.word);
        const phrase = selectedWords.join(' ');
        
        setSelectedWord(phrase);
        setModalPosition({ x: e.clientX, y: e.clientY });
        setSelectedWordRange({ first, last });
      }
    } else {
      handleSingleWordClick(e.clientX, e.clientY);
    }
    
    setIsSelecting(false);
    setSelectionStart(null);
    setCurrentMousePosition(null);
    
    // Render final inmediato al terminar selección
    drawPage();
  }, [isSelecting, selectionStart, getCanvasCoordinates, findWordAtPosition, handleSingleWordClick, drawPage]);

  // =========================
  // MANEJADORES DE EVENTOS TÁCTILES
  // =========================

  const handleCanvasTouchStart = useCallback((e) => {
    if (e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    const { x, y } = getCanvasCoordinates(touch.clientX, touch.clientY);
    const touchedWord = findWordAtPosition(x, y);
    
    setTouchStartPosition({
      clientX: touch.clientX,
      clientY: touch.clientY,
      word: touchedWord,
      time: Date.now()
    });
    
    if (touchedWord) {
      isActivelySelectingRef.current = true;
      setSelectionStart(touchedWord);
      const startIndex = pageLayoutRef.current.words.findIndex(w => 
        w.x === touchedWord.x && w.y === touchedWord.y && w.word === touchedWord.word
      );
      setSelectedWordRange({ first: startIndex, last: startIndex });
    }
    
    setIsScrolling(false);
  }, [getCanvasCoordinates, findWordAtPosition]);

  const handleCanvasTouchMove = useCallback((e) => {
    if (e.touches.length !== 1 || !touchStartPosition) return;
    
    const touch = e.touches[0];
    const currentPosition = { x: touch.clientX, y: touch.clientY };
    
    const distance = calculateDistance(
      { x: touchStartPosition.clientX, y: touchStartPosition.clientY },
      currentPosition
    );
    
    const scrollThreshold = 15;
    
    if (distance > scrollThreshold) {
      const deltaY = Math.abs(touch.clientY - touchStartPosition.clientY);
      const deltaX = Math.abs(touch.clientX - touchStartPosition.clientX);
      
      if (deltaY > deltaX * 1.2) {
        if (!isScrolling) {
          setIsScrolling(true);
          isActivelySelectingRef.current = false;
          
          if (isSelecting) {
            setIsSelecting(false);
            setSelectionStart(null);
            setSelectedWordRange({ first: -1, last: -1 });
          }
        }
        return;
      } else if (!isSelecting && touchStartPosition.word) {
        setIsSelecting(true);
        e.preventDefault();
      }
    }
    
    if (touchStartPosition.word && !isScrolling) {
      // Throttling más agresivo para táctil
      if (Date.now() - lastMoveTimeRef.current < 200) return;
      lastMoveTimeRef.current = Date.now();
      
      const { x, y } = getCanvasCoordinates(touch.clientX, touch.clientY);
      const currentWord = findWordAtPosition(x, y);
      
      if (currentWord) {
        setIsSelecting(true);
        const startIndex = pageLayoutRef.current.words.findIndex(w => 
          w.x === touchStartPosition.word.x && w.y === touchStartPosition.word.y && w.word === touchStartPosition.word.word
        );
        const currentIndex = pageLayoutRef.current.words.findIndex(w => 
          w.x === currentWord.x && w.y === currentWord.y && w.word === currentWord.word
        );
        
        const [first, last] = startIndex <= currentIndex 
          ? [startIndex, currentIndex] 
          : [currentIndex, startIndex];
        
        // Solo actualizar si hay cambio real en la selección
        if (selectedWordRange.first !== first || selectedWordRange.last !== last) {
          setSelectedWordRange({ first, last });
          
          // Cancelar renders anteriores
          if (selectionRenderRef.current) {
            clearTimeout(selectionRenderRef.current);
          }
          
          // Delay mayor para táctil para mejor estabilidad
          selectionRenderRef.current = setTimeout(() => {
            if (isActivelySelectingRef.current) {
              drawPage();
            }
          }, 75);
        }
        e.preventDefault();
      }
    }
  }, [touchStartPosition, isScrolling, isSelecting, calculateDistance, getCanvasCoordinates, findWordAtPosition, drawPage, selectedWordRange]);

  const handleCanvasTouchEnd = useCallback((e) => {
    // Marcar que ya no estamos seleccionando activamente
    isActivelySelectingRef.current = false;
    
    // Cancelar cualquier render pendiente de selección
    if (selectionRenderRef.current) {
      clearTimeout(selectionRenderRef.current);
      selectionRenderRef.current = null;
    }
    
    if (!touchStartPosition || isScrolling) {
      setIsScrolling(false);
      setTouchStartPosition(null);
      return;
    }
    
    const now = Date.now();
    const touchDuration = now - touchStartPosition.time;
    
    if (touchDuration < 300 && !isSelecting) {
      handleSingleWordClick(touchStartPosition.clientX, touchStartPosition.clientY);
    } else if (isSelecting) {
      const lastTouch = e.changedTouches[0];
      const { x, y } = getCanvasCoordinates(lastTouch.clientX, lastTouch.clientY);
      const endWord = findWordAtPosition(x, y);
      
      if (endWord && touchStartPosition.word && endWord !== touchStartPosition.word) {
        const startIndex = pageLayoutRef.current.words.findIndex(w => 
          w.x === touchStartPosition.word.x && w.y === touchStartPosition.word.y && w.word === touchStartPosition.word.word
        );
        const endIndex = pageLayoutRef.current.words.findIndex(w => 
          w.x === endWord.x && w.y === endWord.y && w.word === endWord.word
        );
        
        const [first, last] = startIndex <= endIndex 
          ? [startIndex, endIndex] 
          : [endIndex, startIndex];
        
        const selectedWords = pageLayoutRef.current.words.slice(first, last + 1).map(w => w.word);
        const phrase = selectedWords.join(' ');
        
        setSelectedWord(phrase);
        setModalPosition({ x: lastTouch.clientX, y: lastTouch.clientY });
        setSelectedWordRange({ first, last });
      }
    }
    
    setIsSelecting(false);
    setTouchStartPosition(null);
    setIsScrolling(false);
    
    // Render final inmediato al terminar selección
    drawPage();
  }, [touchStartPosition, isScrolling, isSelecting, handleSingleWordClick, getCanvasCoordinates, findWordAtPosition, drawPage]);

  // =========================
  // MANEJADORES DE AUDIO
  // =========================

  const toggleSpeed = useCallback(() => {
    setIsSlow(prevIsSlow => !prevIsSlow);
    
    if (isPlaying) {
      ChromeSpeechService.stop();
      const rate = !isSlow ? 0.5 : 1.0;
      ChromeSpeechService.speak(currentPageText, 0, rate);
      setIsPlaying(true);
    }
  }, [isSlow, isPlaying, currentPageText]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      ChromeSpeechService.pause();
      setIsPlaying(false);
    } else {
      const rate = isSlow ? 0.5 : 1.0;
      ChromeSpeechService.speak(currentPageText, 0, rate);
      setIsPlaying(true);
    }
  }, [isPlaying, isSlow, currentPageText]);

  const handleStop = useCallback(() => {
    ChromeSpeechService.stop();
    setIsPlaying(false);
    setProgress(0);
    setHighlightedWordInfo(null);
  }, []);

  // =========================
  // MANEJADORES DE UI
  // =========================

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
      
      setScrollPosition(containerRef.current.scrollTop);
      
      renderTimeoutRef.current = setTimeout(() => {
        requestAnimationFrame(drawPage);
      }, fontSize > 24 ? 100 : 50);
    }
  }, [drawPage, fontSize]);

  const handlePageInputChange = useCallback((e) => {
    setPageInputValue(e.target.value);
  }, []);

  const handleGoToPage = useCallback(() => {
    const pageNumber = parseInt(pageInputValue, 10);
    if (
      !isNaN(pageNumber) && 
      pageNumber >= 1 && 
      pageNumber <= (currentBook?.content?.length || 1)
    ) {
      setCurrentPage(pageNumber);
      setPageInputValue('');
    }
  }, [pageInputValue, currentBook, setCurrentPage]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      handleGoToPage();
    }
  }, [handleGoToPage]);

  const handleCloseModal = useCallback(() => {
    setSelectedWord(null);
    setSelectedWordRange({ first: -1, last: -1 });
    requestAnimationFrame(drawPage);
  }, [drawPage]);

  // =========================
  // EFECTOS
  // =========================

  // Detectar dispositivo táctil
  useEffect(() => {
    const detectTouch = () => {
      setIsTouchDevice(true);
      window.removeEventListener('touchstart', detectTouch);
    };
    
    window.addEventListener('touchstart', detectTouch);
    return () => window.removeEventListener('touchstart', detectTouch);
  }, []);

  // Configurar servicios de audio
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

  // Manejar redimensionamiento
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        canvasRef.current.width = containerWidth;
        pageLayoutRef.current.isLayoutCalculated = false;
        calculatePageLayout();
        requestAnimationFrame(drawPage);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculatePageLayout, drawPage]);

  // Resetear al cambiar página
  useEffect(() => {
    setCanvasHeight(1200);
    pageLayoutRef.current.isLayoutCalculated = false;
    
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
      setScrollPosition(0);
    }
    
    setTimeout(() => {
      calculatePageLayout();
      requestAnimationFrame(drawPage);
    }, 100);
  }, [currentPage, fontSize, calculatePageLayout, drawPage]);

  // Dibujar cuando cambian las posiciones
  useEffect(() => {
    if (wordPositions.length > 0) {
      requestAnimationFrame(drawPage);
    }
  }, [wordPositions, drawPage]);

  // =========================
  // RENDER
  // =========================

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
            
            <div className="flex items-center ml-4">
              <input
                type="text"
                value={pageInputValue}
                onChange={handlePageInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Go to page..."
                className="w-24 px-2 py-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
              />
              <button
                onClick={handleGoToPage}
                className="ml-2 px-2 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Go
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => setFontSize(prev => Math.max(12, prev - 2))}
              className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Minus className="w-5 h-5" />
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {fontSize}px
            </span>
            <button
              onClick={() => setFontSize(prev => Math.min(36, prev + 2))}
              className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleSpeed}
              className={`p-2 rounded ${isSlow ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              <Clock className="w-5 h-5" />
            </button>
            
            <button
              onClick={handlePlayPause}
              className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            
            <button
              onClick={handleStop}
              className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Square className="w-5 h-5" />
            </button>
          </div>
          
          <div className="w-1/2">
            <AudioProgressBar 
              progress={progress} 
              isPlaying={isPlaying}
            />
          </div>
        </div>
      </div>

      <div 
        ref={containerRef} 
        className="flex-1 overflow-auto p-4"
        onScroll={handleScroll}
      >
        {/* Div con texto real para permitir selección nativa */}
        <div 
          className="absolute opacity-0 pointer-events-none"
          style={{ 
            fontSize: `${fontSize}px`,
            fontFamily: 'Arial',
            color: darkMode ? '#FFFFFF' : '#000000',
            userSelect: 'text'
          }}
        >
          {currentPageText}
        </div>
        
        <canvas
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onTouchStart={handleCanvasTouchStart}
          onTouchMove={handleCanvasTouchMove}
          onTouchEnd={handleCanvasTouchEnd}
          className="w-full bg-white dark:bg-gray-900"
          width={800}
          height={canvasHeight}
          style={{ 
            transform: 'translateZ(0)',
            touchAction: 'pan-y',
            cursor: 'text',
            willChange: 'transform',
            WebkitTapHighlightColor: 'rgba(0,0,0,0)',
            userSelect: 'none'
          }}
        />
        
        {/* Capa invisible para selección nativa en dispositivos táctiles */}
        {selectedWordRange.first !== -1 && (
          <div 
            className="fixed top-0 left-0 opacity-0 pointer-events-none"
            aria-hidden="true"
          >
            {getSelectedText()}
          </div>
        )}
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