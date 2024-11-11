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
       splitSentences: true,
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

       // Preparar el texto y las palabras para el seguimiento
       const textToSpeak = text.slice(startPosition);
       const words = textToSpeak.split(/\s+/);
       let currentPos = startPosition;
       const wordPositions = words.map(word => {
         const start = text.indexOf(word, currentPos);
         const end = start + word.length;
         currentPos = end;
         return { word, start, end };
       });

       let currentWordIndex = 0;

       // Configurar la velocidad
       this.mobileSpeech.setRate(rate);

       // Configurar los listeners
       this.mobileSpeech.setLanguage('en-US');
       
       // Dividir en oraciones para mejor control
       const sentences = textToSpeak.match(/[^.!?]+[.!?]+/g) || [textToSpeak];
       
       const speakNextSentence = async (index) => {
         if (index >= sentences.length || this.isPaused) return;

         const sentence = sentences[index];
         const sentenceStart = text.indexOf(sentence, currentPos);
         
         await this.mobileSpeech.speak({
           text: sentence,
           queue: false,
           listeners: {
             onstart: () => {
               console.log("Iniciando oración:", index + 1);
             },
             onboundary: (event) => {
               if (!this.isPaused) {
                 const charIndex = sentenceStart + (event.charIndex || 0);
                 const wordInfo = wordPositions.find(wp => 
                   charIndex >= wp.start && charIndex <= wp.end
                 );

                 if (wordInfo && this.onWordCallback) {
                   this.onWordCallback({
                     word: wordInfo.word,
                     start: wordInfo.start,
                     end: wordInfo.end
                   });
                   this.currentPosition = wordInfo.start;
                 }

                 if (this.onProgressCallback) {
                   const progress = (charIndex / text.length) * 100;
                   this.onProgressCallback(Math.min(progress, 100));
                 }
               }
             },
             onend: () => {
               if (!this.isPaused) {
                 currentPos = sentenceStart + sentence.length;
                 speakNextSentence(index + 1);
               }
             },
             onerror: (error) => {
               console.error("Error en speech:", error);
             }
           }
         });
       };

       await speakNextSentence(0);

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