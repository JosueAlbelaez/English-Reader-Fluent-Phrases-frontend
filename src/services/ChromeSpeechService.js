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
   this.currentRate = 1.0;
   this.androidSpeech = null;
   this.currentText = '';
   this.pausedTime = 0;
   this.startTime = 0;
   this.pausedPosition = 0;
   this.isAndroidChrome = this.isMobile && this.isChrome && /Android/.test(navigator.userAgent);

   if (this.isMobile) {
     this.initializeMobileSpeech();
   }
 }

 async initializeMobileSpeech() {
   try {
     // Para Android Chrome, usamos directamente speechSynthesis
     if (this.isAndroidChrome) {
       this.androidSpeech = window.speechSynthesis;
     } else {
       this.mobileSpeech = new Speech();
       await this.mobileSpeech.init({
         volume: 1,
         lang: 'en-US',
         rate: 1,
         pitch: 1,
         splitSentences: false
       });
     }
     console.log("Speech está listo");
   } catch (error) {
     console.error("Error inicializando speech:", error);
   }
 }

 async speak(text, startPosition = 0, rate = 1.0) {
   try {
     this.text = text;
     this.currentPosition = startPosition;
     this.isPaused = false;
     this.currentRate = rate;
     this.currentText = text.slice(startPosition);
     this.startTime = Date.now();
     this.pausedPosition = startPosition;

     if (this.isAndroidChrome) {
       // Usar SpeechSynthesis nativo para Android Chrome
       this.androidSpeech.cancel();
       
       const utterance = new SpeechSynthesisUtterance(this.currentText);
       utterance.lang = 'en-US';
       utterance.rate = rate;
       
       utterance.onend = () => {
         if (!this.isPaused && this.onEndCallback) {
           this.onEndCallback();
         }
       };

       this.utterance = utterance;
       this.androidSpeech.speak(utterance);
       
     } else if (this.isMobile && this.mobileSpeech) {
       await this.mobileSpeech.speak({
         text: this.currentText,
         queue: false,
         rate: rate,
         listeners: {
           onend: () => {
             if (!this.isPaused && this.onEndCallback) {
               this.onEndCallback();
             }
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
   } catch (error) {
     console.error('Error en speak:', error);
     throw error;
   }
 }

 calculatePausedPosition() {
   const elapsedTime = Date.now() - this.startTime;
   const wordsPerMinute = 160 * this.currentRate; // Promedio de palabras por minuto
   const charactersPerMinute = wordsPerMinute * 5; // Estimación de 5 caracteres por palabra
   const charactersPerMillisecond = charactersPerMinute / (60 * 1000);
   const estimatedPosition = Math.floor(elapsedTime * charactersPerMillisecond);
   
   return Math.min(this.currentText.length, this.pausedPosition + estimatedPosition);
 }

 pause() {
   try {
     this.isPaused = true;
     if (this.isAndroidChrome) {
       this.pausedPosition = this.calculatePausedPosition();
       this.androidSpeech.pause();
       this.pausedTime = Date.now();
     } else if (this.isMobile && this.mobileSpeech) {
       this.mobileSpeech.pause();
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
       if (this.isAndroidChrome) {
         const remainingText = this.currentText.slice(this.pausedPosition);
         this.androidSpeech.cancel();
         
         const utterance = new SpeechSynthesisUtterance(remainingText);
         utterance.lang = 'en-US';
         utterance.rate = this.currentRate;
         
         utterance.onend = () => {
           if (!this.isPaused && this.onEndCallback) {
             this.onEndCallback();
           }
         };

         this.utterance = utterance;
         this.androidSpeech.speak(utterance);
         this.startTime = Date.now() - this.pausedTime;
         
       } else if (this.isMobile && this.mobileSpeech) {
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
       this.isPaused = false;
     }
   } catch (error) {
     console.error('Error en resume:', error);
   }
 }

 stop() {
   try {
     if (this.isAndroidChrome) {
       this.androidSpeech.cancel();
       this.pausedPosition = 0;
     } else if (this.isMobile && this.mobileSpeech) {
       this.mobileSpeech.cancel();
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
     this.startTime = 0;
     this.pausedTime = 0;
   } catch (error) {
     console.error('Error en stop:', error);
   }
 }

 // El resto de métodos se mantienen igual...
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