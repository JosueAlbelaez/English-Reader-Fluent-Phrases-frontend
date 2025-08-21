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
  const lastMoveTimeRef = useRef(0);
  const scrollTimeoutRef = useRef(null);
  const renderTimeoutRef = useRef(null);
  const isRenderingRef = useRef(false);
  const selectionModeRef = useRef('word'); // 'word' o 'sentence'
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
  
  // Función para dibujar la página con optimización de renderizado
  const drawPage = useCallback(() => {
    // Evitar múltiples renderizados simultáneos
    if (isRenderingRef.current) return;
    isRenderingRef.current = true;
    
    if (!canvasRef.current || !pageLayoutRef.current.isLayoutCalculated) {
      isRenderingRef.current = false;
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Usar una técnica de doble buffer para evitar parpadeos
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = canvas.width;
    offscreenCanvas.height = canvas.height;
    const offscreenCtx = offscreenCanvas.getContext('2d');
    
    offscreenCtx.clearRect(0, 0, canvas.width, canvas.height);

    // Configurar el estilo de texto
    offscreenCtx.font = `${fontSize}px Arial`;
    offscreenCtx.textBaseline = 'bottom';
    
    // Color del texto según el tema
    offscreenCtx.fillStyle = darkMode ? '#FFFFFF' : '#000000';

    // Dibujar solo las palabras visibles para mejorar el rendimiento
    const visibleWords = pageLayoutRef.current.words.filter(wordInfo => 
      wordInfo.y >= scrollPosition - 100 && 
      wordInfo.y <= scrollPosition + canvas.height + 100
    );

    // Dibujar todas las palabras visibles
    visibleWords.forEach((wordInfo) => {
      const originalIndex = pageLayoutRef.current.words.indexOf(wordInfo);
      
      // Verificar si la palabra está siendo resaltada por la reproducción
      const isHighlighted = highlightedWordInfo && 
        wordInfo.start >= highlightedWordInfo.start && 
        wordInfo.end <= highlightedWordInfo.end;

      // Verificar si la palabra está en el rango seleccionado
      const isSelected = 
        originalIndex >= selectedWordRange.first && 
        originalIndex <= selectedWordRange.last && 
        selectedWordRange.first !== -1;

      // Aplicar estilo según el estado
      if (isHighlighted) {
        // Palabra resaltada por reproducción
        offscreenCtx.fillStyle = darkMode ? '#FFD700' : '#FFD700';
        offscreenCtx.fillText(wordInfo.word, wordInfo.x, wordInfo.y - scrollPosition);
        offscreenCtx.fillStyle = darkMode ? '#FFFFFF' : '#000000';
      } else if (isSelected) {
        // Palabra seleccionada por el usuario
        offscreenCtx.fillStyle = darkMode ? '#4CAF50' : '#4CAF50';
        offscreenCtx.fillText(wordInfo.word, wordInfo.x, wordInfo.y - scrollPosition);
        offscreenCtx.fillStyle = darkMode ? '#FFFFFF' : '#000000';
      } else {
        // Palabra normal
        offscreenCtx.fillText(wordInfo.word, wordInfo.x, wordInfo.y - scrollPosition);
      }
    });
    
    // Copiar el contenido del canvas offscreen al canvas visible
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(offscreenCanvas, 0, 0);
    
    isRenderingRef.current = false;
  }, [fontSize, darkMode, scrollPosition, highlightedWordInfo, selectedWordRange]);

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
    
    // Evitar recálculos innecesarios
    if (pageLayoutRef.current.isLayoutCalculated && 
        pageLayoutRef.current.fontSize === fontSize &&
        pageLayoutRef.current.canvasWidth === canvas.width) {
      return;
    }
    
    // Guardar el tamaño de fuente y ancho del canvas para comparaciones futuras
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
      isLayoutCalculated: true,
      fontSize: fontSize,
      canvasWidth: canvas.width
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
        requestAnimationFrame(drawPage);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [calculatePageLayout, drawPage]);

  // Resetear la altura del canvas cuando cambia la página o el tamaño de fuente
  useEffect(() => {
    setCanvasHeight(1200);
    pageLayoutRef.current.isLayoutCalculated = false;
    // Resetear la posición de scroll al cambiar de página
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
      setScrollPosition(0);
    }
    
    // Esperar a que se actualice el estado y luego dibujar la página
    setTimeout(() => {
      calculatePageLayout();
      requestAnimationFrame(drawPage);
    }, 100);
  }, [currentPage, fontSize, calculatePageLayout, drawPage]);

  // Función para convertir coordenadas de pantalla a coordenadas del canvas
  const calculateCanvasCoordinates = (clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    // Ajustar las coordenadas Y considerando el scrollPosition
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height) + scrollPosition
    };
  };

  // Función para encontrar la palabra en una posición específica
  const findWordAtPositionInCanvas = (x, y) => {
    return wordPositions.find(pos => 
      x >= pos.x && 
      x <= pos.x + pos.width &&
      y >= pos.y - pos.height &&
      y <= pos.y
    );
  };

  // Función para calcular la distancia entre dos puntos
  const getDistance = (point1, point2) => {
    if (!point1 || !point2) return 0;
    return Math.sqrt(
      Math.pow(point2.x - point1.x, 2) + 
      Math.pow(point2.y - point1.y, 2)
    );
  };

  // Manejador para clic en una sola palabra
  const handleWordClick = (clientX, clientY) => {
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
  const handleMouseDown = (e) => {
    // Verificar si se está presionando la tecla Shift para permitir selección nativa
    if (e.shiftKey) return;
    
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
  const handleMouseMove = (e) => {
    // Si se está presionando Shift, permitir selección nativa
    if (e.shiftKey) return;
    
    if (!isSelecting || !selectionStart) return;

    const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
    
    // Usar debounce para reducir actualizaciones excesivas
    if (Date.now() - (lastMoveTime || 0) < 50) return;
    setLastMoveTime(Date.now());
    
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
  const handleMouseUp = (e) => {
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
  const handleCanvasTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    const { x, y } = getCanvasCoordinates(touch.clientX, touch.clientY);
    const touchedWord = findWordAtPosition(x, y);
    
    // Guardar la posición inicial y la palabra tocada
    setTouchStartPosition({
      clientX: touch.clientX,
      clientY: touch.clientY,
      word: touchedWord,
      time: Date.now()
    });
    
    // Si encontramos una palabra, iniciar potencial selección
    if (touchedWord) {
      setSelectionStart(touchedWord);
      const startIndex = wordPositions.findIndex(w => w === touchedWord);
      setSelectedWordRange({ first: startIndex, last: startIndex });
    }
    
    setIsScrolling(false);
  };

  const handleCanvasTouchMove = (e) => {
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
    const scrollThreshold = 15; // Aumentar el umbral para mejor detección
    
    // Si el movimiento supera el umbral, considerarlo como scroll o selección
    if (distance > scrollThreshold) {
      // Verificar si el movimiento es más vertical que horizontal
      const deltaY = Math.abs(touch.clientY - touchStartPosition.clientY);
      const deltaX = Math.abs(touch.clientX - touchStartPosition.clientX);
      
      if (deltaY > deltaX * 1.2) { // Si es más vertical, es scroll
        if (!isScrolling) {
          setIsScrolling(true);
          
          // Si estábamos seleccionando, cancelar la selección
          if (isSelecting) {
            setIsSelecting(false);
            setSelectionStart(null);
            setSelectedWordRange({ first: -1, last: -1 });
          }
        }
        return;
      } else if (!isSelecting && touchStartPosition.word) {
        // Si es más horizontal y tenemos una palabra inicial, iniciar selección
        setIsSelecting(true);
        // Prevenir el comportamiento por defecto para evitar scroll durante selección
        e.preventDefault();
      }
    }
    
    // Si no es scroll y tenemos una palabra inicial, actualizar la selección
    if (touchStartPosition.word && !isScrolling) {
      const { x, y } = getCanvasCoordinates(touch.clientX, touch.clientY);
      const currentWord = findWordAtPosition(x, y);
      
      if (currentWord) {
        setIsSelecting(true);
        const startIndex = wordPositions.findIndex(w => w === touchStartPosition.word);
        const currentIndex = wordPositions.findIndex(w => w === currentWord);
        
        // Asegurar que el orden sea correcto (inicio a fin)
        const [first, last] = startIndex <= currentIndex 
          ? [startIndex, currentIndex] 
          : [currentIndex, startIndex];
        
        setSelectedWordRange({ first, last });
        
        // Forzar redibujado para mostrar la selección en tiempo real
        requestAnimationFrame(drawPage);
        
        // Prevenir el comportamiento por defecto solo durante la selección
        e.preventDefault();
      }
    }
  };

  const handleCanvasTouchEnd = (e) => {
    // Si no hay posición inicial o estamos scrolling, no hacer nada
    if (!touchStartPosition || isScrolling) {
      setIsScrolling(false);
      setTouchStartPosition(null);
      return;
    }
    
    const now = Date.now();
    const touchDuration = now - touchStartPosition.time;
    
    // Si fue un toque rápido (menos de 300ms) y no nos movimos mucho, tratarlo como un tap
    if (touchDuration < 300 && !isSelecting) {
      handleSingleWordClick(touchStartPosition.clientX, touchStartPosition.clientY);
    } else if (isSelecting) {
      // Si estábamos seleccionando, finalizar la selección
      const lastTouch = e.changedTouches[0];
      const { x, y } = getCanvasCoordinates(lastTouch.clientX, lastTouch.clientY);
      const endWord = findWordAtPosition(x, y);
      
      if (endWord && touchStartPosition.word && endWord !== touchStartPosition.word) {
        // Selección de frase
        const startIndex = wordPositions.findIndex(w => w === touchStartPosition.word);
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
          x: lastTouch.clientX,
          y: lastTouch.clientY
        });
        
        // Mantener el resaltado hasta que se cierre el modal
        setSelectedWordRange({ first, last });
      }
    }
    
    // Resetear estados
    setIsSelecting(false);
    setTouchStartPosition(null);
    setIsScrolling(false);
  };





  const handlePageInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleGoToPage();
    }
  };
  
  // Estado para rastrear el último tiempo de movimiento del mouse
  const [lastMoveTime, setLastMoveTime] = useState(0);









  // Función para convertir coordenadas de pantalla a coordenadas del canvas
  const getCanvasCoordinates = (clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    // Ajustar las coordenadas Y considerando el scrollPosition
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

  // Función para encontrar frases completas
  const findSentenceAtPosition = (x, y) => {
    // Primero encontramos la palabra en la posición
    const word = findWordAtPosition(x, y);
    if (!word) return null;
    
    // Encontrar el índice de la palabra
    const wordIndex = pageLayoutRef.current.words.findIndex(w => 
      w.x === word.x && w.y === word.y && w.word === word.word
    );
    
    if (wordIndex === -1) return null;
    
    // Buscar el inicio de la frase (punto anterior o inicio del texto)
    let startIndex = wordIndex;
    while (startIndex > 0) {
      const prevWord = pageLayoutRef.current.words[startIndex - 1].word;
      if (prevWord.endsWith('.') || prevWord.endsWith('!') || prevWord.endsWith('?')) {
        break;
      }
      startIndex--;
    }
    
    // Buscar el final de la frase (siguiente punto o final del texto)
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

  // Manejador para doble clic para seleccionar frases completas
  const handleDoubleClick = (e) => {
    const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
    const sentence = findSentenceAtPosition(x, y);
    
    if (sentence) {
      // Seleccionar toda la frase
      setSelectedWordRange({ first: sentence.startIndex, last: sentence.endIndex });
      
      // Construir la frase seleccionada
      const selectedWords = sentence.words.map(w => w.word);
      const phrase = selectedWords.join(' ');
      
      setSelectedWord(phrase);
      setModalPosition({
        x: e.clientX,
        y: e.clientY
      });
      
      // Forzar redibujado para mostrar la selección
      requestAnimationFrame(drawPage);
    }
  };

  // Manejador para iniciar la selección (mouse) con optimización
  const handleCanvasMouseDown = (e) => {
    // Si es doble clic, manejarlo de forma diferente
    if (e.detail === 2) {
      handleDoubleClick(e);
      return;
    }
    
    const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
    const clickedWord = findWordAtPosition(x, y);

    if (clickedWord) {
      setIsSelecting(true);
      setSelectionStart(clickedWord);
      const startIndex = pageLayoutRef.current.words.findIndex(w => 
        w.x === clickedWord.x && w.y === clickedWord.y && w.word === clickedWord.word
      );
      setSelectedWordRange({ first: startIndex, last: startIndex });
    }
  };

  // Manejador para movimiento del mouse durante la selección con throttling
  const handleCanvasMouseMove = (e) => {
    // No hacer nada si no estamos en modo selección
    if (!isSelecting || !selectionStart) return;
    
    // Limitar la frecuencia de actualizaciones para evitar parpadeos
    if (Date.now() - lastMoveTimeRef.current < 50) return;
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
        // Asegurar que el orden sea correcto (inicio a fin)
        const [first, last] = startIndex <= currentIndex 
          ? [startIndex, currentIndex] 
          : [currentIndex, startIndex];
        
        setSelectedWordRange({ first, last });
        
        // Forzar redibujado para mostrar la selección en tiempo real
        requestAnimationFrame(drawPage);
      }
    }
  };

  // Manejador para finalizar la selección (mouse)
  const handleCanvasMouseUp = (e) => {
    if (!isSelecting || !selectionStart) {
      // Si no estamos seleccionando, tratar como clic simple
      handleSingleWordClick(e.clientX, e.clientY);
      return;
    }

    const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
    const endWord = findWordAtPosition(x, y);

    if (endWord && selectionStart !== endWord) {
      // Selección de múltiples palabras
      const startIndex = pageLayoutRef.current.words.findIndex(w => 
        w.x === selectionStart.x && w.y === selectionStart.y && w.word === selectionStart.word
      );
      const endIndex = pageLayoutRef.current.words.findIndex(w => 
        w.x === endWord.x && w.y === endWord.y && w.word === endWord.word
      );
      
      if (startIndex !== -1 && endIndex !== -1) {
        // Asegurar que el orden sea correcto (inicio a fin)
        const [first, last] = startIndex <= endIndex 
          ? [startIndex, endIndex] 
          : [endIndex, startIndex];
        
        // Construir la frase seleccionada
        const selectedWords = pageLayoutRef.current.words.slice(first, last + 1).map(w => w.word);
        const phrase = selectedWords.join(' ');
        
        setSelectedWord(phrase);
        setModalPosition({
          x: e.clientX,
          y: e.clientY
        });
        
        // Mantener el resaltado hasta que se cierre el modal
        setSelectedWordRange({ first, last });
      }
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
    // Si hay más de un toque, permitir comportamiento nativo (zoom, etc.)
    if (e.touches.length !== 1) return;
    
    // Almacenar el tiempo del toque para distinguir entre tap y selección
    const touch = e.touches[0];
    const touchTime = Date.now();
    
    // Si el último toque fue hace menos de 300ms, considerarlo como doble tap
    if (touchTime - lastTouchTime < 300) {
      // Permitir selección nativa en doble tap
      return;
    }
    
    setLastTouchTime(touchTime);
    
    const { x, y } = getCanvasCoordinates(touch.clientX, touch.clientY);
    const touchedWord = findWordAtPosition(x, y);
    
    // Guardar la posición inicial y la palabra tocada
    setTouchStartPosition({
      clientX: touch.clientX,
      clientY: touch.clientY,
      word: touchedWord,
      time: touchTime
    });
    
    // No iniciar selección inmediatamente, esperar a ver si es scroll o selección
    setIsScrolling(false);
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
    const scrollThreshold = 15; // Aumentar el umbral para mejor detección
    
    // Si el movimiento supera el umbral, considerarlo como scroll o selección
    if (distance > scrollThreshold) {
      // Verificar si el movimiento es más vertical que horizontal
      const deltaY = Math.abs(touch.clientY - touchStartPosition.clientY);
      const deltaX = Math.abs(touch.clientX - touchStartPosition.clientX);
      
      if (deltaY > deltaX * 1.2) { // Si es más vertical, es scroll
        if (!isScrolling) {
          setIsScrolling(true);
          
          // Si estábamos seleccionando, cancelar la selección
          if (isSelecting) {
            setIsSelecting(false);
            setSelectionStart(null);
            setSelectedWordRange({ first: -1, last: -1 });
          }
        }
        return;
      } else if (!isSelecting && touchStartPosition.word) {
        // Si es más horizontal y tenemos una palabra inicial, iniciar selección
        setIsSelecting(true);
        // Prevenir el comportamiento por defecto para evitar scroll durante selección
        e.preventDefault();
      }
    }
    
    // Si no es scroll y tenemos una palabra inicial, actualizar la selección
    if (touchStartPosition.word && !isScrolling) {
      const { x, y } = getCanvasCoordinates(touch.clientX, touch.clientY);
      const currentWord = findWordAtPosition(x, y);
      
      if (currentWord) {
        setIsSelecting(true);
        const startIndex = wordPositions.findIndex(w => w === touchStartPosition.word);
        const currentIndex = wordPositions.findIndex(w => w === currentWord);
        
        // Asegurar que el orden sea correcto (inicio a fin)
        const [first, last] = startIndex <= currentIndex 
          ? [startIndex, currentIndex] 
          : [currentIndex, startIndex];
        
        setSelectedWordRange({ first, last });
        
        // Forzar redibujado para mostrar la selección en tiempo real
        requestAnimationFrame(drawPage);
        
        // Prevenir el comportamiento por defecto solo durante la selección
        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = (e) => {
    // Si no hay posición inicial o estamos scrolling, no hacer nada
    if (!touchStartPosition || isScrolling) {
      setIsScrolling(false);
      setTouchStartPosition(null);
      return;
    }
    
    const now = Date.now();
    const touchDuration = now - touchStartPosition.time;
    
    // Si fue un toque rápido (menos de 300ms) y no nos movimos mucho, tratarlo como un tap
    if (touchDuration < 300 && !isSelecting) {
      handleSingleWordClick(touchStartPosition.clientX, touchStartPosition.clientY);
    } else if (isSelecting) {
      // Si estábamos seleccionando, finalizar la selección
      const lastTouch = e.changedTouches[0];
      const { x, y } = getCanvasCoordinates(lastTouch.clientX, lastTouch.clientY);
      const endWord = findWordAtPosition(x, y);
      
      if (endWord && touchStartPosition.word && endWord !== touchStartPosition.word) {
        // Selección de frase
        const startIndex = wordPositions.findIndex(w => w === touchStartPosition.word);
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
          x: lastTouch.clientX,
          y: lastTouch.clientY
        });
        
        // Mantener el resaltado hasta que se cierre el modal
        setSelectedWordRange({ first, last });
      }
    }
    
    // Resetear estados
    setIsSelecting(false);
    setTouchStartPosition(null);
    setIsScrolling(false);
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
    // Forzar redibujado para eliminar el resaltado
    requestAnimationFrame(drawPage);
  };

  // Función para alternar entre velocidad normal y lenta
  const toggleSpeed = () => {
    setIsSlow(prevIsSlow => !prevIsSlow);
    
    // Si está reproduciendo actualmente, detener y reiniciar con la nueva velocidad
    if (isPlaying) {
      ChromeSpeechService.stop();
      const rate = !isSlow ? 0.5 : 1.0; // Si isSlow es false, cambiará a true, por lo que usamos 0.5
      ChromeSpeechService.speak(currentPageText, 0, rate);
      setIsPlaying(true);
    }
  };

  // Función para reproducir o pausar el audio
  const handlePlayPause = () => {
    if (isPlaying) {
      ChromeSpeechService.pause();
      setIsPlaying(false);
    } else {
      const rate = isSlow ? 0.5 : 1.0;
      ChromeSpeechService.speak(currentPageText, 0, rate);
      setIsPlaying(true);
    }
  };

  // Función para detener la reproducción
  const handleStop = () => {
    ChromeSpeechService.stop();
    setIsPlaying(false);
    setProgress(0);
    setHighlightedWordInfo(null);
  };

 


  // Dibujar la página cuando cambian las posiciones de las palabras
  useEffect(() => {
    if (wordPositions.length > 0) {
      requestAnimationFrame(drawPage);
    }
  }, [wordPositions, drawPage]);

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
        onScroll={() => {
          if (containerRef.current) {
            // Cancelar cualquier renderizado pendiente
            if (renderTimeoutRef.current) {
              clearTimeout(renderTimeoutRef.current);
            }
            
            // Actualizar la posición de scroll inmediatamente
            setScrollPosition(containerRef.current.scrollTop);
            
            // Retrasar el renderizado para evitar múltiples actualizaciones
            renderTimeoutRef.current = setTimeout(() => {
              requestAnimationFrame(drawPage);
            }, fontSize > 24 ? 100 : 50); // Mayor retraso para tamaños grandes
          }
        }}
      >
        {/* Añadir un div con el texto real para permitir selección nativa */}
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
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onDoubleClick={isTouchDevice ? handleDoubleTap : undefined}
          className="w-full bg-white dark:bg-gray-900"
          width={800}
          height={canvasHeight}
          style={{ 
            transform: 'translateZ(0)', // Forzar aceleración por hardware
            touchAction: 'pan-y', // Permitir scroll vertical nativo en dispositivos táctiles
            cursor: 'text', // Mostrar cursor de texto para indicar que se puede seleccionar
            willChange: 'transform' // Optimizar para cambios frecuentes
          }}
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


}; // Close the BookReader component

export default BookReader;