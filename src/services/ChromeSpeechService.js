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
   this.currentWordIndex = 0;
   this.words = [];
   this.currentRate = 1.0;

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

 preprocessText(text, startPosition) {
   const textSlice = text.slice(startPosition);
   let words = [];
   let currentPos = startPosition;
   
   const wordRegex = /\S+/g;
   let match;
   
   while ((match = wordRegex.exec(textSlice)) !== null) {
     const word = match[0];
     const start = startPosition + match.index;
     const end = start + word.length;
     
     words.push({
       word,
       start,
       end,
       duration: this.calculateWordDuration(word)
     });
   }
   
   return words;
 }

 calculateWordDuration(word) {
   const baseDuration = 200;
   const charDuration = 50;
   return baseDuration + (word.length * charDuration);
 }

 highlightCurrentWord() {
   if (this.words.length > this.currentWordIndex && !this.isPaused) {
     const currentWord = this.words[this.currentWordIndex];
     
     if (this.onWordCallback) {
       this.onWordCallback({
         word: currentWord.word,
         start: currentWord.start,
         end: currentWord.end
       });
     }

     if (this.onProgressCallback) {
       const progress = (currentWord.end / this.text.length) * 100;
       this.onProgressCallback(Math.min(progress, 100));
     }
   }
 }

 async speak(text, startPosition = 0, rate = 1.0) {
   try {
     this.text = text;
     this.currentPosition = startPosition;
     this.isPaused = false;
     this.currentRate = rate;
     this.currentWordIndex = 0;

     if (this.isMobile && this.mobileSpeech) {
       this.words = this.preprocessText(text, startPosition);
       
       await this.mobileSpeech.speak({
         text: text.slice(startPosition),
         queue: false,
         rate: rate,
         listeners: {
           onstart: () => {
             console.log("Iniciando lectura móvil");
             this.currentWordIndex = 0;
             // Iniciar el proceso de resaltado
             this.startHighlighting(rate);
           },
           onend: () => {
             if (!this.isPaused) {
               if (this.onWordCallback) {
                 this.onWordCallback(null);
               }
               if (this.onEndCallback) {
                 this.onEndCallback();
               }
             }
           },
           onpause: () => {
             console.log("Audio pausado");
           },
           onresume: () => {
             console.log("Audio resumido");
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

 startHighlighting(rate) {
   const updateHighlight = () => {
     if (!this.isPaused && this.currentWordIndex < this.words.length) {
       this.highlightCurrentWord();
       const currentWord = this.words[this.currentWordIndex];
       const duration = currentWord.duration / rate;
       
       this.currentWordIndex++;
       setTimeout(updateHighlight, duration);
     }
   };

   updateHighlight();
 }

 pause() {
   try {
     this.isPaused = true;
     if (this.isMobile && this.mobileSpeech) {
       this.mobileSpeech.pause();
       if (this.onWordCallback) {
         this.onWordCallback(null);
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
         // Reiniciar el resaltado desde la palabra actual
         this.startHighlighting(this.currentRate);
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
       this.currentWordIndex = 0;
       if (this.onWordCallback) {
         this.onWordCallback(null);
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