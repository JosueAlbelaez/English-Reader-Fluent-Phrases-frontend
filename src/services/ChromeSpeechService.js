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
    this.lastWordIndex = 0;
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

      if (this.isMobile) {
        const words = text.slice(startPosition).split(/\s+/);
        let currentText = text.slice(startPosition);
        
        this.utterance = new SpeechSynthesisUtterance(currentText);
        this.utterance.lang = 'en-US';
        this.utterance.rate = rate;
        
        let lastProcessedIndex = -1;

        this.utterance.onboundary = (event) => {
          if (this.isPaused) return;
          
          if (event.name === 'word') {
            const charIndex = event.charIndex || 0;
            const currentTextUpToChar = currentText.slice(0, charIndex);
            const wordCount = currentTextUpToChar.trim().split(/\s+/).length;

            // Solo procesar si es una nueva palabra
            if (wordCount > 0 && wordCount !== lastProcessedIndex) {
              lastProcessedIndex = wordCount;
              const textUntilChar = text.slice(startPosition, startPosition + charIndex);
              const wordsUntilChar = textUntilChar.trim().split(/\s+/);
              const currentWord = wordsUntilChar[wordsUntilChar.length - 1];

              if (currentWord) {
                const start = text.indexOf(currentWord, startPosition);
                const end = start + currentWord.length;

                // Actualizar la posición actual para el manejo de pausa/resumen
                this.currentPosition = start;

                if (this.onWordCallback) {
                  this.onWordCallback({
                    word: currentWord,
                    start: start,
                    end: end
                  });
                }

                if (this.onProgressCallback) {
                  const progress = (charIndex / currentText.length) * 100;
                  this.onProgressCallback(Math.min(progress, 100));
                }
              }
            }
          }
        };

        this.utterance.onend = () => {
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
        // Mantener el comportamiento original para desktop que funciona perfectamente
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