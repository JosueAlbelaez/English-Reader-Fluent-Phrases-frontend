class SpeechService {
  constructor() {
    this.utterance = null;
    this.currentPosition = 0;
    this.onProgressCallback = null;
    this.onEndCallback = null;
    this.onWordCallback = null; // Nuevo: callback para palabras
    this.text = '';
    this.isPaused = false;
    this.isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    this.currentWordInfo = null; // Nuevo: información de la palabra actual
  }

  speak(text, startPosition = 0, rate = 1.0) {
    this.text = text;
    this.currentPosition = startPosition;
    this.isPaused = false;

    // Cancelar cualquier reproducción anterior
    window.speechSynthesis.cancel();

    // Crear nueva utterance desde la posición indicada
    this.utterance = new SpeechSynthesisUtterance(text.slice(startPosition));
    this.utterance.lang = 'en-US';
    this.utterance.rate = rate;

    // Configurar eventos
    this.utterance.onboundary = (event) => {
      if (event.name === 'word') {
        this.currentPosition = startPosition + (event.charIndex || 0);
        
        // Obtener información de la palabra actual
        const currentWordInfo = this.getCurrentWord(this.text, event.charIndex);
        this.currentWordInfo = currentWordInfo;

        // Notificar sobre la palabra actual
        if (this.onWordCallback) {
          this.onWordCallback(currentWordInfo);
        }

        // Notificar sobre el progreso
        if (this.onProgressCallback) {
          const progress = (this.currentPosition / text.length) * 100;
          this.onProgressCallback(progress);
        }
      }
    };

    this.utterance.onend = () => {
      if (!this.isPaused && this.onEndCallback) {
        // Limpiar el resaltado al terminar
        if (this.onWordCallback) {
          this.onWordCallback(null);
        }
        this.currentWordInfo = null;
        this.onEndCallback();
      }
    };

    // Solución específica para Chrome
    if (this.isChrome) {
      setInterval(() => {
        if (window.speechSynthesis.speaking && !this.isPaused) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }, 14000);
    }

    // Iniciar reproducción
    window.speechSynthesis.speak(this.utterance);
    return this.utterance;
  }

  getCurrentWord(text, charIndex) {
    if (!text || charIndex === undefined) return null;

    const beforeIndex = text.slice(0, charIndex);
    const afterIndex = text.slice(charIndex);
    
    // Encontrar el inicio de la palabra actual
    const startMatch = beforeIndex.match(/\S+$/);
    const start = startMatch ? charIndex - startMatch[0].length : charIndex;
    
    // Encontrar el final de la palabra actual
    const endMatch = afterIndex.match(/^\S+/);
    const end = endMatch ? charIndex + endMatch[0].length : charIndex;
    
    return {
      word: text.slice(start, end),
      start,
      end
    };
  }

  pause() {
    this.isPaused = true;
    window.speechSynthesis.pause();
    // Limpiar el resaltado al pausar
    if (this.onWordCallback) {
      this.onWordCallback(null);
    }
  }

  resume() {
    if (this.isPaused) {
      this.isPaused = false;
      window.speechSynthesis.resume();
      // Restaurar el resaltado de la palabra actual si existe
      if (this.onWordCallback && this.currentWordInfo) {
        this.onWordCallback(this.currentWordInfo);
      }
    } else {
      // Si no está pausado, empezar desde la última posición conocida
      this.speak(this.text, this.currentPosition, this.utterance?.rate || 1.0);
    }
  }

  stop() {
    this.isPaused = false;
    window.speechSynthesis.cancel();
    this.currentPosition = 0;
    this.utterance = null;
    this.currentWordInfo = null;
    // Limpiar el resaltado al detener
    if (this.onWordCallback) {
      this.onWordCallback(null);
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

  // Nuevo método para establecer el callback de palabras
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

export default new SpeechService();