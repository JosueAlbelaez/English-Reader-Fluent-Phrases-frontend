// Primero importamos React Native TTS
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
   
   // Configuración inicial de TTS para móviles
   if (this.isMobile) {
     Tts.setDefaultLanguage('en-US');
     Tts.setDefaultRate(0.5);
     
     // Eventos de TTS para móviles
     Tts.addEventListener('tts-start', () => {
       console.log('TTS iniciado');
     });

     Tts.addEventListener('tts-finish', () => {
       if (!this.isPaused && this.onEndCallback) {
         this.onWordCallback(null);
         this.onEndCallback();
       }
     });

     Tts.addEventListener('tts-cancel', () => {
       if (this.onWordCallback) {
         this.onWordCallback(null);
       }
     });

     // Evento especial para el progreso de palabras
     Tts.addEventListener('tts-progress', (event) => {
       if (!this.isPaused) {
         const { position, length } = event;
         // Encontrar la palabra actual basada en la posición
         const wordInfo = this.getCurrentWord(this.text, position);
         
         if (wordInfo && this.onWordCallback) {
           this.onWordCallback(wordInfo);
         }

         if (this.onProgressCallback) {
           const progress = (position / length) * 100;
           this.onProgressCallback(Math.min(progress, 100));
         }
       }
     });
   }
 }

 speak(text, startPosition = 0, rate = 1.0) {
   try {
     this.text = text;
     this.currentPosition = startPosition;
     this.isPaused = false;

     if (this.isMobile) {
       // Lógica para móviles usando React Native TTS
       Tts.stop();
       
       // Ajustar la velocidad de lectura
       Tts.setDefaultRate(rate);
       
       // Dividir el texto en frases para mejor control
       const sentences = text.slice(startPosition).match(/[^.!?]+[.!?]+/g) || [text.slice(startPosition)];
       
       const speakSentence = async (index) => {
         if (index < sentences.length && !this.isPaused) {
           await Tts.speak(sentences[index], {
             rate: rate,
             onStart: () => {
               console.log('Iniciando frase:', index);
             },
             onDone: () => {
               if (!this.isPaused) {
                 speakSentence(index + 1);
               }
             },
             onWord: ({ position, length }) => {
               if (!this.isPaused) {
                 const wordInfo = this.getCurrentWord(text, startPosition + position);
                 if (wordInfo && this.onWordCallback) {
                   this.onWordCallback(wordInfo);
                 }
               }
             }
           });
         }
       };

       speakSentence(0);

     } else {
       // Mantener el comportamiento original para desktop que funciona perfectamente
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
     } else {
       this.speak(this.text, this.currentPosition, this.utterance?.rate || 1.0);
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