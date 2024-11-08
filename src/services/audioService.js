class AudioService {
    constructor() {
      this.utterance = null;
      this.isPlaying = false;
      this.currentPosition = 0;
      this.onProgressCallback = null;
    }
  
    play(text, startPosition = 0, rate = 1.0) {
      // Cancel any existing speech
      window.speechSynthesis.cancel();
      
      // Create new utterance from the specified position
      this.utterance = new SpeechSynthesisUtterance(text.slice(startPosition));
      this.utterance.lang = 'en-US';
      this.utterance.rate = rate;
      
      // Set up event handlers
      this.utterance.onboundary = (event) => {
        this.currentPosition = startPosition + event.charIndex;
        if (this.onProgressCallback) {
          const progress = (this.currentPosition / text.length) * 100;
          this.onProgressCallback(progress);
        }
      };
  
      this.utterance.onend = () => {
        this.isPlaying = false;
        this.currentPosition = 0;
        if (this.onProgressCallback) {
          this.onProgressCallback(0);
        }
      };
  
      this.utterance.onpause = () => {
        this.currentPosition = this.utterance.charIndex || this.currentPosition;
      };
  
      // Start speaking
      window.speechSynthesis.speak(this.utterance);
      this.isPlaying = true;
    }
  
    pause() {
      if (this.isPlaying) {
        window.speechSynthesis.pause();
        this.isPlaying = false;
      }
    }
  
    resume() {
      if (!this.isPlaying && this.utterance) {
        window.speechSynthesis.resume();
        this.isPlaying = true;
      }
    }
  
    stop() {
      window.speechSynthesis.cancel();
      this.isPlaying = false;
      this.currentPosition = 0;
      this.utterance = null;
    }
  
    setOnProgress(callback) {
      this.onProgressCallback = callback;
    }
  
    getCurrentPosition() {
      return this.currentPosition;
    }
  
    isActive() {
      return this.isPlaying;
    }
  }
  
  export default new AudioService();