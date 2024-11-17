class TextToSpeech {
  constructor() {
    this.synth = window.speechSynthesis;
    this.voice = null;
    this.isPaused = false;
    this.resumePosition = 0;
    this.text = '';
    this.isMobile = /Mobi|Android/i.test(navigator.userAgent); // Detectar móvil
    this.init();
  }

  init() {
    const voicesChangedHandler = () => {
      const voices = this.synth.getVoices();
      // Seleccionar inglés de EE. UU. en móviles o mantener voz predeterminada en computadoras
      this.voice = this.isMobile
        ? voices.find((voice) => voice.lang === 'en-US') || voices[0]
        : voices[0];
    };

    this.synth.onvoiceschanged = voicesChangedHandler;
    if (this.synth.getVoices().length) voicesChangedHandler(); // Para navegadores donde las voces ya están cargadas
  }

  speak(text) {
    this.cancel(); // Cancelar cualquier síntesis en curso
    this.text = text;
    this.resumePosition = 0; // Reiniciar la posición
    this.isPaused = false;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = this.voice;
    utterance.lang = this.isMobile ? 'en-US' : this.voice.lang;

    utterance.onboundary = (event) => {
      if (!this.isPaused) {
        this.resumePosition = event.charIndex; // Guardar posición al hablar
      }
    };

    utterance.onend = () => {
      console.log('Lectura finalizada.');
      this.resumePosition = 0;
    };

    this.synth.speak(utterance);
  }

  pause() {
    if (!this.isPaused && this.synth.speaking) {
      this.synth.pause();
      this.isPaused = true;
      console.log('Pausado en posición:', this.resumePosition);
    }
  }

  resume() {
    if (this.isPaused) {
      this.isPaused = false;

      if (this.isMobile) {
        // Reanudar simulando fragmentos en móviles
        const remainingText = this.text.slice(this.resumePosition);
        console.log('Reanudando en móvil desde posición:', this.resumePosition);

        this.speak(remainingText); // Reiniciar desde el texto restante
      } else {
        // Reanudar normalmente en computadoras
        this.synth.resume();
        console.log('Reanudando en computadora desde posición:', this.resumePosition);
      }
    }
  }

  cancel() {
    this.synth.cancel();
    this.isPaused = false;
    this.resumePosition = 0;
  }
}
