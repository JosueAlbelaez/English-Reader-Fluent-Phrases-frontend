import Tts from 'react-native-tts';

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
   this.currentWordIndex = 0;
   this.ttsInitialized = false;

   if (this.isMobile) {
     this.initializeTts();
   }
 }

 async initializeTts() {
   if (!this.ttsInitialized) {
     try {
       await Tts.getInitStatus();
       Tts.setDefaultLanguage('en-US');
       Tts.setDefaultRate(0.75);
       Tts.setDefaultPitch(1.0);

       Tts.addEventListener('tts-start', () => {
         console.log('TTS iniciado');
         this.currentWordIndex = 0;
       });

       Tts.addEventListener('tts-finish', () => {
         if (!this.isPaused && this.onEndCallback) {
           this.onWordCallback(null);
           this.onEndCallback();
         }
       });

       Tts.addEventListener('tts-cancel', () => {
         this.onWordCallback(null);
       });

       this.ttsInitialized = true;
     } catch (error) {
       console.error('Error inicializando TTS:', error);
     }
   }
 }

 async speak(text, startPosition = 0, rate = 1.0) {
   try {
     this.text = text;
     this.currentPosition = startPosition;
     this.isPaused = false;

     if (this.isMobile) {
       if (!this.ttsInitialized) {
         await this.initializeTts();
       }

       Tts.stop();

       // Preprocesar el texto para identificar palabras y sus posiciones
       const words = text.slice(startPosition).split(/\s+/);
       const wordPositions = [];
       let currentPos = startPosition;

       for (const word of words) {
         if (word.trim()) {
           const start = text.indexOf(word, currentPos);
           const end = start + word.length;
           wordPositions.push({ word, start, end });
           currentPos = end;
         }
       }

       // Configurar la velocidad
       await Tts.setDefaultRate(rate);

       // Dividir el texto en frases más manejables
       const sentences = text.slice(startPosition).match(/[^.!?]+[.!?]+/g) || [text.slice(startPosition)];
       
       let currentSentenceIndex = 0;

       const speakNextSentence = async () => {
         if (currentSentenceIndex < sentences.length && !this.isPaused) {
           const currentSentence = sentences[currentSentenceIndex];
           
           await Tts.speak(currentSentence, {
             rate: rate,
             onStart: () => {
               console.log('Iniciando frase:', currentSentenceIndex + 1);
             },
             onProgress: (event) => {
               if (!this.isPaused) {
                 const { location, length } = event;
                 // Calcular la posición global en el texto
                 const globalPosition = startPosition + 
                   sentences.slice(0, currentSentenceIndex).join('').length + 
                   location;

                 // Encontrar la palabra actual
                 const currentWord = wordPositions.find(wp => 
                   globalPosition >= wp.start && globalPosition <= wp.end
                 );

                 if (currentWord && this.onWordCallback) {
                   this.onWordCallback({
                     word: currentWord.word,
                     start: currentWord.start,
                     end: currentWord.end
                   });
                   this.currentPosition = currentWord.start;
                 }

                 if (this.onProgressCallback) {
                   const progress = (globalPosition / text.length) * 100;
                   this.onProgressCallback(Math.min(progress, 100));
                 }
               }
             },
             onDone: () => {
               if (!this.isPaused) {
                 currentSentenceIndex++;
                 speakNextSentence();
               }
             },
             onError: (error) => {
               console.error('Error en TTS:', error);
             }
           });
         } else if (!this.isPaused && this.onEndCallback) {
           this.onWordCallback(null);
           this.onEndCallback();
         }
       };

       speakNextSentence();

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
     if (this.isMobile) {
       Tts.pause();
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
       if (this.isMobile) {
         Tts.resume();
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
     if (this.isMobile) {
       Tts.stop();
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