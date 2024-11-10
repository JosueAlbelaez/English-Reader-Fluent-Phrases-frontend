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
    this.chunkSize = this.isMobile ? 250 : Infinity;
    this.currentChunk = 0;
    this.lastHighlightedWord = null;
  }

  speak(text, startPosition = 0, rate = 1.0) {
    try {
      this.text = text;
      this.currentPosition = startPosition;
      this.isPaused = false;
      this.lastHighlightedWord = null;

      window.speechSynthesis.cancel();
      if (this.keepAliveInterval) {
        clearInterval(this.keepAliveInterval);
      }

      if (this.isMobile) {
        const chunks = this.chunkText(text.slice(startPosition));
        this.speakChunks(chunks, rate);
      } else {
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

  chunkText(text) {
    const words = text.split(' ');
    const chunks = [];
    let currentChunk = '';

    for (const word of words) {
      if ((currentChunk + ' ' + word).length <= this.chunkSize) {
        currentChunk += (currentChunk ? ' ' : '') + word;
      } else {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = word;
      }
    }
    if (currentChunk) chunks.push(currentChunk);
    return chunks;
  }

  speakChunks(chunks, rate) {
    let currentIndex = 0;
    let accumulatedLength = 0;
    const totalLength = this.text.length;
    const words = this.text.split(' ');
    let wordIndex = 0;

    const speakNextChunk = () => {
      if (currentIndex < chunks.length && !this.isPaused) {
        const chunk = chunks[currentIndex];
        const utterance = new SpeechSynthesisUtterance(chunk);
        utterance.lang = 'en-US';
        utterance.rate = rate;

        // Calcular la duración aproximada por palabra
        const wordsInChunk = chunk.split(' ').length;
        const estimatedDurationPerWord = (chunk.length / rate) / wordsInChunk;

        let wordTimer = null;
        let currentWordIndex = 0;

        const updateWord = () => {
          if (this.isPaused) return;

          const chunkWords = chunk.split(' ');
          if (currentWordIndex < chunkWords.length) {
            const word = chunkWords[currentWordIndex];
            const start = chunk.indexOf(word);
            const end = start + word.length;

            const globalStart = accumulatedLength + start;
            const globalEnd = accumulatedLength + end;

            if (this.onWordCallback) {
              const wordInfo = {
                word,
                start: globalStart,
                end: globalEnd
              };
              
              // Solo actualizar si es una palabra diferente
              if (!this.lastHighlightedWord || 
                  this.lastHighlightedWord.start !== wordInfo.start || 
                  this.lastHighlightedWord.end !== wordInfo.end) {
                this.lastHighlightedWord = wordInfo;
                this.onWordCallback(wordInfo);
              }
            }

            if (this.onProgressCallback) {
              const progress = (globalEnd / totalLength) * 100;
              this.onProgressCallback(Math.min(progress, 100));
            }

            currentWordIndex++;
            wordTimer = setTimeout(updateWord, estimatedDurationPerWord * 1000);
          }
        };

        utterance.onstart = () => {
          updateWord();
        };

        utterance.onend = () => {
          if (wordTimer) {
            clearTimeout(wordTimer);
          }

          if (!this.isPaused) {
            accumulatedLength += chunk.length + 1;
            currentIndex++;
            
            if (currentIndex < chunks.length) {
              speakNextChunk();
            } else {
              if (this.onWordCallback) {
                this.onWordCallback(null);
              }
              if (this.onEndCallback) {
                this.onEndCallback();
              }
            }
          }
        };

        utterance.onerror = (error) => {
          console.error('Error en utterance:', error);
          if (wordTimer) {
            clearTimeout(wordTimer);
          }
        };

        window.speechSynthesis.speak(utterance);
      }
    };

    speakNextChunk();
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
      this.lastHighlightedWord = null;
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