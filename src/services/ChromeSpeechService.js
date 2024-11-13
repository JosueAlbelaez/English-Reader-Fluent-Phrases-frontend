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
   this.lastPosition = 0;
   this.currentSegmentIndex = 0;
   this.segments = [];

   if (this.isMobile) {
     this.initializeMobileSpeech();
     this.setupMobileEventListeners();
   }
 }

 setupMobileEventListeners() {
   document.addEventListener('visibilitychange', () => {
     if (document.hidden && this.isMobile && this.mobileSpeech) {
       this.stop();
     }
   });

   window.addEventListener('beforeunload', () => {
     if (this.isMobile && this.mobileSpeech) {
       this.stop();
     }
   });

   window.addEventListener('pagehide', () => {
     if (this.isMobile && this.mobileSpeech) {
       this.stop();
     }
   });

   // Nuevo: Manejar el estado de la app
   window.addEventListener('focus', () => {
     if (this.isMobile && this.mobileSpeech && this.isPaused) {
       this.stop();
     }
   });
 }

 async initializeMobileSpeech() {
   try {
     this.mobileSpeech = new Speech();
     await this.mobileSpeech.init({
       volume: 1,
       lang: 'en-US',
       rate: 1,
       pitch: 1,
       splitSentences: false,
       listeners: {
         onvoiceschanged: (voices) => {
           const englishVoice = voices.find(voice => 
             voice.lang === 'en-US' && voice.name.includes('Google US English')
           ) || voices.find(voice => 
             voice.lang === 'en-US'
           );
           
           if (englishVoice) {
             this.mobileSpeech.setVoice(englishVoice.name);
           }
         }
       }
     });

     // Forzar configuración en inglés
     await this.mobileSpeech.setLanguage('en-US');
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
     this.lastPosition = startPosition;

     if (this.isMobile && this.mobileSpeech) {
       await this.mobileSpeech.cancel();
       await this.mobileSpeech.setLanguage('en-US');
       await this.mobileSpeech.setRate(rate);

       // Mejorado: División de texto en segmentos más grandes
       const textToSpeak = text.slice(startPosition);
       this.segments = this.splitTextIntoSegments(textToSpeak, 500);
       this.currentSegmentIndex = 0;

       const speakNextSegment = async () => {
         if (this.currentSegmentIndex < this.segments.length && !this.isPaused) {
           const segment = this.segments[this.currentSegmentIndex];
           
           await this.mobileSpeech.speak({
             text: segment,
             queue: false,
             listeners: {
               onstart: () => {
                 this.lastPosition = startPosition + 
                   this.segments.slice(0, this.currentSegmentIndex).join('').length;
               },
               onend: () => {
                 if (!this.isPaused) {
                   this.currentSegmentIndex++;
                   if (this.currentSegmentIndex < this.segments.length) {
                     speakNextSegment();
                   } else {
                     if (this.onEndCallback) this.onEndCallback();
                   }
                 }
               },
               onboundary: (event) => {
                 if (event.name === 'word' && this.onWordCallback) {
                   const wordInfo = this.getCurrentWord(segment, event.charIndex);
                   if (wordInfo) {
                     this.onWordCallback(wordInfo);
                   }
                 }
               }
             }
           });
         }
       };

       await speakNextSegment();
     } else {
       // Código original para desktop sin modificaciones
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

 splitTextIntoSegments(text, maxLength = 500) {
   const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
   const segments = [];
   let currentSegment = '';

   for (const sentence of sentences) {
     if (currentSegment.length + sentence.length <= maxLength) {
       currentSegment += sentence;
     } else {
       if (currentSegment) segments.push(currentSegment.trim());
       currentSegment = sentence;
     }
   }

   if (currentSegment) segments.push(currentSegment.trim());
   return segments;
 }

 pause() {
   if (this.isMobile && this.mobileSpeech) {
     try {
       this.mobileSpeech.pause();
       this.isPaused = true;
       // Guardar la posición actual
       this.lastPosition += this.segments
         .slice(0, this.currentSegmentIndex)
         .join('')
         .length;
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
         // Reanudar desde la última posición conocida
         this.speak(this.text, this.lastPosition, this.currentRate);
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
       this.lastPosition = 0;
       this.currentSegmentIndex = 0;
       this.segments = [];
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