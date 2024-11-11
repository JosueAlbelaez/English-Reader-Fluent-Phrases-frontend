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
   this.wordPositions = [];
   this.currentWordIndex = 0;
   this.highlightInterval = null;

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
         onvoiceschanged: voices => {
           console.log("Voces disponibles:", voices);
         }
       }
     });

     if (speechStatus) {
       console.log("Speech está listo!");
     }
   } catch (error) {
     console.error("Error inicializando speech:", error);
   }
 }

 async speak(text, startPosition = 0, rate = 1.0) {
   try {
     this.text = text;
     this.currentPosition = startPosition;
     this.isPaused = false;

     if (this.isMobile && this.mobileSpeech) {
       // Detener cualquier reproducción anterior
       this.mobileSpeech.cancel();
       if (this.highlightInterval) {
         clearInterval(this.highlightInterval);
       }

       // Preparar el mapeo de palabras
       this.wordPositions = [];
       let currentPos = startPosition;
       const textToProcess = text.slice(startPosition);
       
       // Mejorado el algoritmo de separación de palabras
       const words = textToProcess.match(/\S+/g) || [];
       
       words.forEach(word => {
         const start = text.indexOf(word, currentPos);
         const end = start + word.length;
         this.wordPositions.push({ word, start, end });
         currentPos = end + 1;
       });

       this.currentWordIndex = 0;
       const startingWordIndex = this.wordPositions.findIndex(wp => wp.start >= startPosition);
       if (startingWordIndex !== -1) {
         this.currentWordIndex = startingWordIndex;
       }

       // Configurar la velocidad
       this.mobileSpeech.setRate(rate);

       // Función para resaltar palabras
       const highlightWords = () => {
         if (this.currentWordIndex < this.wordPositions.length && !this.isPaused) {
           const currentWord = this.wordPositions[this.currentWordIndex];
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
         }
       };

       // Iniciar la reproducción
       await this.mobileSpeech.speak({
         text: textToProcess,
         queue: false,
         listeners: {
           onstart: () => {
             // Iniciar el resaltado de palabras
             this.highlightInterval = setInterval(() => {
               if (!this.isPaused) {
                 highlightWords();
                 this.currentWordIndex++;
               }
             }, rate === 1 ? 300 : 450); // Ajustar intervalo según la velocidad
           },
           onend: () => {
             if (!this.isPaused) {
               if (this.highlightInterval) {
                 clearInterval(this.highlightInterval);
               }
               if (this.onWordCallback) {
                 this.onWordCallback(null);
               }
               if (this.onEndCallback) {
                 this.onEndCallback();
               }
               this.currentWordIndex = 0;
             }
           },
           onpause: () => {
             if (this.highlightInterval) {
               clearInterval(this.highlightInterval);
             }
           },
           onresume: () => {
             this.highlightInterval = setInterval(() => {
               if (!this.isPaused) {
                 highlightWords();
                 this.currentWordIndex++;
               }
             }, rate === 1 ? 300 : 450);
           },
           onerror: (error) => {
             console.error("Error en speech:", error);
             if (this.highlightInterval) {
               clearInterval(this.highlightInterval);
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
       if (this.highlightInterval) {
         clearInterval(this.highlightInterval);
       }
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
     if (this.isMobile && this.mobileSpeech) {
       this.mobileSpeech.cancel();
       if (this.highlightInterval) {
         clearInterval(this.highlightInterval);
       }
     } else {
       window.speechSynthesis.cancel();
     }
     this.currentPosition = 0;
     this.currentWordIndex = 0;
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