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
   this.mobileWordData = null;
   this.currentWordTimer = null;
   this.pausedWordIndex = 0;

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
   const words = text.slice(startPosition).split(/\s+/);
   const wordData = [];
   let currentPos = startPosition;

   for (let word of words) {
     if (word.trim()) {
       const start = text.indexOf(word, currentPos);
       const end = start + word.length;
       const duration = this.calculateWordDuration(word);
       wordData.push({ word, start, end, duration });
       currentPos = end + 1;
     }
   }
   return wordData;
 }

 calculateWordDuration(word) {
   // Base duration for each word (milliseconds)
   const baseDuration = 200;
   // Additional time per character
   const charDuration = 50;
   return baseDuration + (word.length * charDuration);
 }

 scheduleWordHighlighting(wordData, startIndex = 0, rate = 1.0) {
   let accumulatedTime = 0;
   
   for (let i = startIndex; i < wordData.length; i++) {
     const word = wordData[i];
     const adjustedDuration = word.duration / rate;

     const timer = setTimeout(() => {
       if (!this.isPaused) {
         if (this.onWordCallback) {
           this.onWordCallback({
             word: word.word,
             start: word.start,
             end: word.end
           });
         }

         if (this.onProgressCallback) {
           const progress = (word.end / this.text.length) * 100;
           this.onProgressCallback(Math.min(progress, 100));
         }

         // Schedule removing highlight
         setTimeout(() => {
           if (!this.isPaused && this.onWordCallback) {
             this.onWordCallback(null);
           }
         }, adjustedDuration * 0.9); // Slightly less than full duration
       }
     }, accumulatedTime);

     this.currentWordTimer = timer;
     accumulatedTime += adjustedDuration;
   }

   // Set end callback
   setTimeout(() => {
     if (!this.isPaused && this.onEndCallback) {
       this.onEndCallback();
     }
   }, accumulatedTime);
 }

 async speak(text, startPosition = 0, rate = 1.0) {
   try {
     this.text = text;
     this.currentPosition = startPosition;
     this.isPaused = false;

     if (this.isMobile && this.mobileSpeech) {
       // Clear any existing timers
       if (this.currentWordTimer) {
         clearTimeout(this.currentWordTimer);
       }

       // Preprocess text into words with timing data
       this.mobileWordData = this.preprocessText(text, startPosition);
       this.pausedWordIndex = 0;

       // Start speech
       await this.mobileSpeech.speak({
         text: text.slice(startPosition),
         rate: rate,
         listeners: {
           onstart: () => {
             // Schedule word highlighting
             this.scheduleWordHighlighting(this.mobileWordData, 0, rate);
           },
           onend: () => {
             if (!this.isPaused && this.onWordCallback) {
               this.onWordCallback(null);
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

 pause() {
   try {
     this.isPaused = true;
     if (this.isMobile && this.mobileSpeech) {
       this.mobileSpeech.pause();
       if (this.currentWordTimer) {
         clearTimeout(this.currentWordTimer);
       }
       // Store current word index for resuming
       if (this.mobileWordData) {
         const currentTime = Date.now();
         for (let i = 0; i < this.mobileWordData.length; i++) {
           if (currentTime <= this.mobileWordData[i].scheduledTime) {
             this.pausedWordIndex = i;
             break;
           }
         }
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
         if (this.mobileWordData) {
           // Resume highlighting from saved position
           this.scheduleWordHighlighting(
             this.mobileWordData,
             this.pausedWordIndex,
             this.mobileSpeech.rate || 1.0
           );
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
       if (this.currentWordTimer) {
         clearTimeout(this.currentWordTimer);
       }
       this.pausedWordIndex = 0;
       this.mobileWordData = null;
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