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
   this.mobileSpeech = null;
   this.wordTimers = []; // Para limpiar los timers de palabras
   this.lastWordIndex = 0;

   if (this.isMobile) {
     this.initializeMobileSpeech();
   }
 }

 async initializeMobileSpeech() {
   try {
     this.mobileSpeech = new Speech();
     const speechStatus = await this.mobileSpeech.init({
       volume: 1,
       lang: 'en-US',
       rate: 1,
       pitch: 1,
       splitSentences: false,
       listeners: {
         onboundary: this.handleWordBoundary.bind(this),
         onend: () => {
           this.clearWordTimers();
           if (this.onEndCallback && !this.isPaused) {
             this.onWordCallback(null);
             this.onEndCallback();
           }
         }
       }
     });

     if (speechStatus) {
       console.log("Speech está listo");
     }
   } catch (error) {
     console.error("Error inicializando speech:", error);
   }
 }

 clearWordTimers() {
   this.wordTimers.forEach(timer => clearTimeout(timer));
   this.wordTimers = [];
 }

 // Función para calcular la duración estimada de una palabra
 calculateWordDuration(word, rate) {
   const baseTime = 200; // Tiempo base en milisegundos
   const lengthFactor = word.length * 50; // 50ms por carácter
   return (baseTime + lengthFactor) / rate;
 }

 handleWordBoundary(event) {
   if (this.isPaused) return;

   const { charIndex, charLength } = event;
   if (charIndex !== undefined && charLength !== undefined) {
     const wordInfo = this.getCurrentWord(this.text, this.currentPosition + charIndex);
     
     if (wordInfo) {
       // Resaltar la palabra actual
       if (this.onWordCallback) {
         this.onWordCallback(wordInfo);
       }

       // Calcular duración de la palabra
       const duration = this.calculateWordDuration(wordInfo.word, this.mobileSpeech.rate || 1);

       // Programar el fin del resaltado
       const timer = setTimeout(() => {
         if (!this.isPaused && this.onWordCallback) {
           this.onWordCallback(null);
         }
       }, duration);

       this.wordTimers.push(timer);

       // Actualizar progreso
       if (this.onProgressCallback) {
         const progress = ((this.currentPosition + charIndex) / this.text.length) * 100;
         this.onProgressCallback(Math.min(progress, 100));
       }
     }
   }
 }

 async speak(text, startPosition = 0, rate = 1.0) {
   try {
     this.text = text;
     this.currentPosition = startPosition;
     this.isPaused = false;
     this.clearWordTimers();

     if (this.isMobile && this.mobileSpeech) {
       // Lógica móvil
       const textToSpeak = text.slice(startPosition);
       this.mobileSpeech.setRate(rate);
       
       await this.mobileSpeech.speak({
         text: textToSpeak,
         queue: false,
         listeners: {
           onstart: () => {
             console.log("Iniciando lectura móvil");
           },
           onend: () => {
             if (!this.isPaused) {
               this.clearWordTimers();
               if (this.onWordCallback) {
                 this.onWordCallback(null);
               }
               if (this.onEndCallback) {
                 this.onEndCallback();
               }
             }
           },
           onpause: () => {
             this.clearWordTimers();
           },
           onresume: () => {
             // La lectura continuará desde la última palabra
           },
           onerror: (error) => {
             console.error("Error en speech móvil:", error);
             this.clearWordTimers();
           }
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
     if (this.isMobile && this.mobileSpeech) {
       this.mobileSpeech.pause();
       this.clearWordTimers();
     } else {
       window.speechSynthesis.pause();
       if (this.onWordCallback) {
         this.onWordCallback(null);
       }
       if (this.keepAliveInterval) {
         clearInterval(this.keepAliveInterval);
       }
     }
   } catch (error) {
     console.error('Error en pause:', error);
   }
 }

 resume() {
   try {
     if (this.isPaused) {
       this.isPaused = false;
       if (this.isMobile && this.mobileSpeech) {
         this.mobileSpeech.resume();
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
       }
     }
   } catch (error) {
     console.error('Error en resume:', error);
   }
 }

 stop() {
   try {
     this.isPaused = false;
     this.clearWordTimers();
     if (this.isMobile && this.mobileSpeech) {
       this.mobileSpeech.cancel();
     } else {
       window.speechSynthesis.cancel();
     }
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