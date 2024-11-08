class ChromeSpeechService {
  constructor() {
    this.utterance = null;
    this.currentPosition = 0;
    this.onProgressCallback = null;
    this.onEndCallback = null;
    this.onWordCallback = null;
    this.text = '';
    this.isPaused = false;
    this.isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    this.keepAliveInterval = null;
  }

  speak(text, startPosition = 0, rate = 1.0) {
    try {
      this.text = text;
      this.currentPosition = startPosition;
      this.isPaused = false;

      // Cancelar cualquier reproducción anterior
      window.speechSynthesis.cancel();
      if (this.keepAliveInterval) {
        clearInterval(this.keepAliveInterval);
      }

      // Crear nueva utterance desde la posición indicada
      this.utterance = new SpeechSynthesisUtterance(text.slice(startPosition));
      this.utterance.lang = 'en-US';
      this.utterance.rate = rate;

      // Configurar eventos
      this.utterance.onboundary = (event) => {
        try {
          if (event.name === 'word') {
            this.currentPosition = startPosition + (event.charIndex || 0);
            
            // Obtener información de la palabra actual
            const wordInfo = this.getCurrentWord(text, this.currentPosition);
            
            if (wordInfo && this.onWordCallback) {
              this.onWordCallback(wordInfo);
            }

            if (this.onProgressCallback) {
              const progress = (this.currentPosition / text.length) * 100;
              this.onProgressCallback(Math.min(progress, 100));
            }
          }
        } catch (error) {
          console.error('Error en onboundary:', error);
        }
      };

      this.utterance.onend = () => {
        try {
          if (!this.isPaused) {
            // Limpiar el resaltado al terminar
            if (this.onWordCallback) {
              this.onWordCallback(null);
            }
            
            if (this.onEndCallback) {
              this.onEndCallback();
            }

            if (this.keepAliveInterval) {
              clearInterval(this.keepAliveInterval);
            }
          }
        } catch (error) {
          console.error('Error en onend:', error);
        }
      };

      // Solución específica para Chrome
      if (this.isChrome) {
        this.keepAliveInterval = setInterval(() => {
          if (window.speechSynthesis.speaking && !this.isPaused) {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
          }
        }, 14000);
      }

      // Iniciar reproducción
      window.speechSynthesis.speak(this.utterance);
      return this.utterance;
    } catch (error) {
      console.error('Error en speak:', error);
      throw error;
    }
  }

  getCurrentWord(text, charIndex) {
    try {
      if (!text || typeof charIndex !== 'number') return null;

      const beforeIndex = text.slice(0, charIndex);
      const afterIndex = text.slice(charIndex);
      
      // Encontrar el inicio de la palabra actual
      const beforeWords = beforeIndex.split(/\s+/);
      const currentWordStart = beforeIndex.length - (beforeWords[beforeWords.length - 1] || '').length;
      
      // Encontrar el final de la palabra actual
      const afterWords = afterIndex.split(/\s+/);
      const currentWordLength = (afterWords[0] || '').length;
      const currentWordEnd = charIndex + currentWordLength;
      
      // Obtener la palabra completa
      const word = text.slice(currentWordStart, currentWordEnd);
      
      if (!word.trim()) return null;
      
      return {
        word: word.trim(),
        start: currentWordStart,
        end: currentWordEnd
      };
    } catch (error) {
      console.error('Error en getCurrentWord:', error);
      return null;
    }
  }

  pause() {
    try {
      this.isPaused = true;
      window.speechSynthesis.pause();
      // Limpiar el resaltado al pausar
      if (this.onWordCallback) {
        this.onWordCallback(null);
      }
      if (this.keepAliveInterval) {
        clearInterval(this.keepAliveInterval);
      }
    } catch (error) {
      console.error('Error en pause:', error);
    }
  }

  resume() {
    try {
      if (this.isPaused) {
        this.isPaused = false;
        window.speechSynthesis.resume();
        if (this.isChrome) {
          this.keepAliveInterval = setInterval(() => {
            if (window.speechSynthesis.speaking && !this.isPaused) {
              window.speechSynthesis.pause();
              window.speechSynthesis.resume();
            }
          }, 14000);
        }
      } else {
        this.speak(this.text, this.currentPosition, this.utterance?.rate || 1.0);
      }
    } catch (error) {
      console.error('Error en resume:', error);
    }
  }

  stop() {
    try {
      this.isPaused = false;
      window.speechSynthesis.cancel();
      this.currentPosition = 0;
      this.utterance = null;
      // Limpiar el resaltado al detener
      if (this.onWordCallback) {
        this.onWordCallback(null);
      }
      if (this.keepAliveInterval) {
        clearInterval(this.keepAliveInterval);
      }
    } catch (error) {
      console.error('Error en stop:', error);
    }
  }

  getCurrentPosition() {
    return this.currentPosition;
  }

  setOnProgress(callback) {
    this.onProgressCallback = callback;
  }

  setOnEnd(callback) {
    this.onEndCallback = callback;
  }

  setOnWord(callback) {
    this.onWordCallback = callback;
  }

  // Método específico para Chrome para mantener la síntesis activa
  keepAlive() {
    if (this.isChrome && window.speechSynthesis.speaking && !this.isPaused) {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }
  }
}

export default new ChromeSpeechService();