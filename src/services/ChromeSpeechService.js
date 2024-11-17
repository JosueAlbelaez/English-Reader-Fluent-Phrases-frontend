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
       splitSentences: true, // Dividir en oraciones para mejor control
       listeners: {
         onvoiceschanged: (voices) => {
           // Intentar establecer una voz en inglés específica
           const englishVoice = voices.find(voice => 
             voice.lang.includes('en-US')
           );
           
           if (englishVoice) {
             this.mobileSpeech.setVoice(englishVoice.name);
           }
         }
       }
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
       // Asegurarse de que no haya una instancia previa hablando
       this.mobileSpeech.cancel();

       // Dividir el texto en oraciones más manejables
       const textToSpeak = text.slice(startPosition);
       
       await this.mobileSpeech.speak({
         text: textToSpeak,
         queue: false,
         rate: rate,
         listeners: {
           onstart: () => {
             console.log('Iniciando lectura móvil desde:', startPosition);
           },
           onend: () => {
             if (!this.isPaused && this.onEndCallback) {
               this.onEndCallback();
             }
           },
           onboundary: (event) => {
             if (!this.isPaused) {
               this.currentPosition = startPosition + (event.charIndex || 0);
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

 pause() {
   try {
     if (this.isMobile && this.mobileSpeech) {
       if (this.mobileSpeech.speaking()) {
         // Guardar la posición actual antes de pausar
         this.resumePosition = this.currentPosition;
         this.mobileSpeech.pause();
         this.isPaused = true;
         console.log('Audio pausado en posición:', this.resumePosition);
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
     if (this.isMobile && this.mobileSpeech && this.isPaused) {
       // Reanudar desde la última posición guardada
       const remainingText = this.text.slice(this.resumePosition);
       this.speak(this.text, this.resumePosition, this.currentRate);
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
     if (this.isMobile && this.mobileSpeech) {
       this.mobileSpeech.cancel();
       this.isPaused = false;
       this.resumePosition = 0;
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