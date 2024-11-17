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
   this.resumePosition = 0;
   this.speaking = false;

   if (this.isMobile) {
     this.initializeMobileSpeech();
   }
 }

 async initializeMobileSpeech() {
   try {
     this.mobileSpeech = new Speech();
     await this.mobileSpeech.init({
       volume: 1,
       lang: 'en-US',
       rate: 1,
       pitch: 1,
       splitSentences: false
     });
     console.log("Speech está listo");
   } catch (error) {
     console.error("Error inicializando speech:", error);
   }
 }

 async speak(text, startPosition = 0, rate = 1.0) {
   try {
     this.text = text;
     this.currentPosition = startPosition;
     this.resumePosition = startPosition;
     this.isPaused = false;
     this.currentRate = rate;

     if (this.isMobile && this.mobileSpeech) {
       this.speaking = true;
       
       // Asegurar que se detenga cualquier lectura anterior
       await this.mobileSpeech.cancel();

       // Calcular el texto a leer desde la posición actual
       const textToSpeak = text.slice(this.resumePosition);
       
       await this.mobileSpeech.speak({
         text: textToSpeak,
         queue: false,
         rate: rate,
         listeners: {
           onstart: () => {
             console.log('Iniciando lectura desde posición:', this.resumePosition);
           },
           onend: () => {
             if (!this.isPaused && this.onEndCallback) {
               this.speaking = false;
               this.resumePosition = 0;
               this.onEndCallback();
             }
           },
           onpause: () => {
             console.log('Lectura pausada en posición:', this.resumePosition);
           },
           onresume: () => {
             console.log('Lectura resumida desde:', this.resumePosition);
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

 pause() {
   if (this.isMobile && this.mobileSpeech) {
     try {
       if (this.speaking) {
         // Obtener la posición aproximada basada en el tiempo transcurrido
         const elapsed = this.mobileSpeech.spoken ? this.mobileSpeech.elapsed() : 0;
         const approxCharsPerSecond = 15; // Aproximación de caracteres por segundo
         const approximatePosition = Math.floor(elapsed / 1000 * approxCharsPerSecond);
         
         this.resumePosition = this.currentPosition + approximatePosition;
         this.mobileSpeech.pause();
         this.isPaused = true;
         this.speaking = false;
         
         console.log('Pausa en posición aproximada:', this.resumePosition);
       }
     } catch (error) {
       console.error('Error al pausar en móvil:', error);
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
 }

 resume() {
   if (this.isMobile && this.mobileSpeech) {
     try {
       if (this.isPaused) {
         console.log('Intentando reanudar desde:', this.resumePosition);
         
         // Usar el método speak con la posición guardada
         this.speak(this.text, this.resumePosition, this.currentRate);
         
         this.isPaused = false;
         this.speaking = true;
       }
     } catch (error) {
       console.error('Error al reanudar en móvil:', error);
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
 }

 stop() {
   if (this.isMobile && this.mobileSpeech) {
     try {
       this.mobileSpeech.cancel();
       this.isPaused = false;
       this.speaking = false;
       this.resumePosition = 0;
     } catch (error) {
       console.error('Error al detener en móvil:', error);
     }
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