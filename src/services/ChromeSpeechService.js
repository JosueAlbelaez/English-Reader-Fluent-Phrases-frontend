import Speech from 'speak-tts';

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
   this.currentRate = 1.0;
   this.lastPosition = 0;
   this.mobileVoice = null;

   if (this.isMobile) {
     this.initializeMobileVoice();
   }
 }

 async initializeMobileVoice() {
   try {
     // Cargar ResponsiveVoice dinámicamente
     const script = document.createElement('script');
     script.src = `https://code.responsivevoice.org/responsivevoice.js?key=${import.meta.env.VITE_RESPONSIVE_VOICE_KEY}`;
     script.async = true;
     
     script.onload = () => {
       this.mobileVoice = window.responsiveVoice;
       this.mobileVoice.init();
       console.log("Mobile voice está listo");
     };
     
     document.head.appendChild(script);
   } catch (error) {
     console.error("Error inicializando mobile voice:", error);
   }
 }

 async speak(text, startPosition = 0, rate = 1.0) {
   try {
     this.text = text;
     this.currentPosition = startPosition;
     this.lastPosition = startPosition;
     this.isPaused = false;
     this.currentRate = rate;

     if (this.isMobile && this.mobileVoice) {
       // Asegurarse de que no haya una reproducción previa
       this.mobileVoice.cancel();
       
       // Preparar el texto desde la posición actual
       const textToSpeak = text.slice(startPosition);
       
       this.mobileVoice.speak(textToSpeak, "US English Female", {
         rate: rate,
         pitch: 1,
         volume: 1,
         onstart: () => {
           console.log('Iniciando lectura móvil');
         },
         onend: () => {
           if (!this.isPaused && this.onEndCallback) {
             this.onEndCallback();
           }
         },
         onpause: () => {
           this.lastPosition = this.currentPosition;
           console.log('Lectura pausada en:', this.lastPosition);
         },
         onresume: () => {
           console.log('Reanudando desde:', this.lastPosition);
         }
       });

     } else {
       // Mantener el comportamiento original para desktop que funciona perfectamente
       window.speechSynthesis.cancel();
       if (this.keepAliveInterval) {
         clearInterval(this.keepAliveInterval);
       }

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
   } catch (error) {
     console.error('Error en speak:', error);
     throw error;
   }
 }

 pause() {
   try {
     if (this.isMobile && this.mobileVoice) {
       if (this.mobileVoice.isPlaying()) {
         this.mobileVoice.pause();
         this.isPaused = true;
       }
     } else {
       window.speechSynthesis.pause();
       if (this.onWordCallback) {
         this.onWordCallback(null);
       }
       if (this.keepAliveInterval) {
         clearInterval(this.keepAliveInterval);
       }
       this.isPaused = true;
     }
   } catch (error) {
     console.error('Error en pause:', error);
   }
 }

 resume() {
   try {
     if (this.isMobile && this.mobileVoice) {
       if (this.isPaused) {
         // Reanudar desde la última posición conocida
         const remainingText = this.text.slice(this.lastPosition);
         this.mobileVoice.speak(remainingText, "US English Female", {
           rate: this.currentRate,
           pitch: 1,
           volume: 1,
           onend: () => {
             if (!this.isPaused && this.onEndCallback) {
               this.onEndCallback();
             }
           }
         });
         this.isPaused = false;
       }
     } else {
       window.speechSynthesis.resume();
       if (this.isChrome) {
         this.keepAliveInterval = setInterval(() => {
           if (window.speechSynthesis.speaking && !this.isPaused) {
             window.speechSynthesis.pause();
             window.speechSynthesis.resume();
           }
         }, 14000);
       }
       this.isPaused = false;
     }
   } catch (error) {
     console.error('Error en resume:', error);
   }
 }

 stop() {
   try {
     if (this.isMobile && this.mobileVoice) {
       this.mobileVoice.cancel();
       this.isPaused = false;
       this.lastPosition = 0;
     } else {
       window.speechSynthesis.cancel();
       if (this.onWordCallback) {
         this.onWordCallback(null);
       }
       if (this.keepAliveInterval) {
         clearInterval(this.keepAliveInterval);
       }
     }
     this.currentPosition = 0;
     this.utterance = null;
     this.isPaused = false;
   } catch (error) {
     console.error('Error en stop:', error);
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