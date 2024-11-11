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
    this.mobileHighlightInterval = null;
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
      if (this.mobileHighlightInterval) {
        clearInterval(this.mobileHighlightInterval);
      }
 
      if (this.isMobile) {
        // Nueva implementación para móviles
        this.utterance = new SpeechSynthesisUtterance(text.slice(startPosition));
        this.utterance.lang = 'en-US';
        this.utterance.rate = rate;
 
        // Pre-procesar palabras
        const words = text.slice(startPosition).split(/\s+/);
        const wordData = [];
        let pos = startPosition;
 
        for (let word of words) {
          if (word) {
            const start = text.indexOf(word, pos);
            const end = start + word.length;
            wordData.push({ word, start, end });
            pos = end;
          }
        }
 
        let currentWordIndex = 0;
        const baseDelay = 750 / rate; // Aumentado de 250 a 750 para un resaltado más lento
 
        this.utterance.onstart = () => {
          this.mobileHighlightInterval = setInterval(() => {
            if (!this.isPaused && currentWordIndex < wordData.length) {
              const currentWord = wordData[currentWordIndex];
              
              // Calcular delay basado en la longitud de la palabra
              const wordLength = currentWord.word.length;
              const wordDelay = baseDelay * (wordLength / 3);
              
              if (this.onWordCallback) {
                this.onWordCallback({
                  word: currentWord.word,
                  start: currentWord.start,
                  end: currentWord.end
                });
              }
 
              if (this.onProgressCallback) {
                const progress = (currentWord.end / text.length) * 100;
                this.onProgressCallback(Math.min(progress, 100));
              }
 
              currentWordIndex++;
              
              // Ajustar el intervalo según la longitud de la palabra
              if (this.mobileHighlightInterval) {
                clearInterval(this.mobileHighlightInterval);
              }
              
              this.mobileHighlightInterval = setInterval(() => {
                if (!this.isPaused && currentWordIndex < wordData.length) {
                  const nextWord = wordData[currentWordIndex];
                  const nextWordDelay = baseDelay * (nextWord.word.length / 3);
                  
                  if (this.onWordCallback) {
                    this.onWordCallback({
                      word: nextWord.word,
                      start: nextWord.start,
                      end: nextWord.end
                    });
                  }
 
                  if (this.onProgressCallback) {
                    const progress = (nextWord.end / text.length) * 100;
                    this.onProgressCallback(Math.min(progress, 100));
                  }
 
                  currentWordIndex++;
                }
              }, wordDelay);
            }
          }, baseDelay);
        };
 
        this.utterance.onend = () => {
          if (this.mobileHighlightInterval) {
            clearInterval(this.mobileHighlightInterval);
          }
          if (!this.isPaused) {
            if (this.onWordCallback) {
              this.onWordCallback(null);
            }
            if (this.onEndCallback) {
              this.onEndCallback();
            }
          }
        };
 
        this.utterance.onpause = () => {
          if (this.mobileHighlightInterval) {
            clearInterval(this.mobileHighlightInterval);
          }
        };
 
        this.utterance.onresume = () => {
          if (!this.isPaused && currentWordIndex < wordData.length) {
            const currentWord = wordData[currentWordIndex];
            const wordDelay = baseDelay * (currentWord.word.length / 3);
            
            this.mobileHighlightInterval = setInterval(() => {
              if (!this.isPaused && currentWordIndex < wordData.length) {
                const nextWord = wordData[currentWordIndex];
                const nextWordDelay = baseDelay * (nextWord.word.length / 3);
                
                if (this.onWordCallback) {
                  this.onWordCallback({
                    word: nextWord.word,
                    start: nextWord.start,
                    end: nextWord.end
                  });
                }
 
                if (this.onProgressCallback) {
                  const progress = (nextWord.end / text.length) * 100;
                  this.onProgressCallback(Math.min(progress, 100));
                }
 
                currentWordIndex++;
              }
            }, wordDelay);
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
      if (this.mobileHighlightInterval) {
        clearInterval(this.mobileHighlightInterval);
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
      if (this.mobileHighlightInterval) {
        clearInterval(this.mobileHighlightInterval);
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