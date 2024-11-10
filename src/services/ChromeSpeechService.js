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
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    this.keepAliveInterval = null;
    this.wordTimer = null;
    this.mobileWordTracker = null;
  }

  speak(text, startPosition = 0, rate = 1.0) {
    try {
      this.text = text;
      this.currentPosition = startPosition;
      this.isPaused = false;

      window.speechSynthesis.cancel();
      if (this.keepAliveInterval) {
        clearInterval(this.keepAliveInterval);
      }
      if (this.wordTimer) {
        clearInterval(this.wordTimer);
      }
      if (this.mobileWordTracker) {
        clearInterval(this.mobileWordTracker);
      }

      if (this.isMobile) {
        // Enfoque para móviles que mantiene la fluidez
        this.utterance = new SpeechSynthesisUtterance(text.slice(startPosition));
        this.utterance.lang = 'en-US';
        this.utterance.rate = rate;

        // Preparar el tracking de palabras
        const words = text.split(' ');
        let positions = [];
        let currentPos = 0;

        // Calcular las posiciones de cada palabra
        words.forEach(word => {
          const start = text.indexOf(word, currentPos);
          const end = start + word.length;
          positions.push({ word, start, end });
          currentPos = end;
        });

        // Calcular la duración aproximada de cada palabra
        const totalDuration = (text.length / rate) * 15; // Aproximadamente 15ms por carácter
        const timePerWord = totalDuration / words.length;

        let wordIndex = 0;
        this.utterance.onstart = () => {
          const startTime = Date.now();

          // Tracker para el resaltado de palabras
          this.mobileWordTracker = setInterval(() => {
            if (this.isPaused || wordIndex >= positions.length) {
              clearInterval(this.mobileWordTracker);
              return;
            }

            const elapsedTime = Date.now() - startTime;
            const expectedWordIndex = Math.floor(elapsedTime / timePerWord);

            if (expectedWordIndex !== wordIndex && expectedWordIndex < positions.length) {
              wordIndex = expectedWordIndex;
              const wordInfo = positions[wordIndex];
              
              if (this.onWordCallback) {
                this.onWordCallback(wordInfo);
              }

              if (this.onProgressCallback) {
                const progress = (wordInfo.end / text.length) * 100;
                this.onProgressCallback(Math.min(progress, 100));
              }
            }
          }, 50); // Actualizar cada 50ms para suavidad
        };

        this.utterance.onend = () => {
          clearInterval(this.mobileWordTracker);
          if (!this.isPaused) {
            if (this.onWordCallback) {
              this.onWordCallback(null);
            }
            if (this.onEndCallback) {
              this.onEndCallback();
            }
          }
        };

        window.speechSynthesis.speak(this.utterance);

      } else {
        // Comportamiento original para desktop que funciona bien
        this.utterance = new SpeechSynthesisUtterance(text.slice(startPosition));
        this.utterance.lang = 'en-US';
        this.utterance.rate = rate;

        this.utterance.onboundary = (event) => {
          try {
            if (event.name === 'word') {
              this.currentPosition = startPosition + (event.charIndex || 0);
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

        if (this.isChrome) {
          this.keepAliveInterval = setInterval(() => {
            if (window.speechSynthesis.speaking && !this.isPaused) {
              window.speechSynthesis.pause();
              window.speechSynthesis.resume();
            }
          }, 14000);
        }

        window.speechSynthesis.speak(this.utterance);
      }
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
      
      const beforeWords = beforeIndex.split(/\s+/);
      const currentWordStart = beforeIndex.length - (beforeWords[beforeWords.length - 1] || '').length;
      
      const afterWords = afterIndex.split(/\s+/);
      const currentWordLength = (afterWords[0] || '').length;
      const currentWordEnd = charIndex + currentWordLength;
      
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
      if (this.onWordCallback) {
        this.onWordCallback(null);
      }
      if (this.keepAliveInterval) {
        clearInterval(this.keepAliveInterval);
      }
      if (this.wordTimer) {
        clearInterval(this.wordTimer);
      }
      if (this.mobileWordTracker) {
        clearInterval(this.mobileWordTracker);
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
      if (this.onWordCallback) {
        this.onWordCallback(null);
      }
      if (this.keepAliveInterval) {
        clearInterval(this.keepAliveInterval);
      }
      if (this.wordTimer) {
        clearInterval(this.wordTimer);
      }
      if (this.mobileWordTracker) {
        clearInterval(this.mobileWordTracker);
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

  keepAlive() {
    if (this.isChrome && window.speechSynthesis.speaking && !this.isPaused) {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }
  }
}

export default new ChromeSpeechService();