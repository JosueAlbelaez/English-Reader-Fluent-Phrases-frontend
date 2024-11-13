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

   if (this.isMobile) {
     this.initializeMobileSpeech();
     this.setupMobileEventListeners();
   }
 }

 setupMobileEventListeners() {
   // Manejar cuando la página se oculta o cierra
   document.addEventListener('visibilitychange', () => {
     if (document.hidden && this.isMobile && this.mobileSpeech) {
       this.stop();
     }
   });

   // Manejar cuando la app se cierra o recarga
   window.addEventListener('beforeunload', () => {
     if (this.isMobile && this.mobileSpeech) {
       this.stop();
     }
   });

   // Manejar cuando el dispositivo se bloquea (solo para móviles)
   window.addEventListener('pagehide', () => {
     if (this.isMobile && this.mobileSpeech) {
       this.stop();
     }
   });
 }

 async initializeMobileSpeech() {
   try {
     this.mobileSpeech = new Speech();
     const voices = await this.mobileSpeech.init({
       volume: 1,
       lang: 'en-US',
       rate: 1,
       pitch: 1,
       splitSentences: true,
       listeners: {
         onvoiceschanged: (voices) => {
           // Intentar establecer una voz en inglés específica
           const englishVoice = voices.find(voice => 
             voice.lang.includes('en-US') && voice.name.includes('Google')
           ) || voices.find(voice => 
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
     this.isPaused = false;
     this.currentRate = rate;
     this.lastPosition = startPosition;

     if (this.isMobile && this.mobileSpeech) {
       // Asegurarse de que no haya una instancia previa hablando
       await this.mobileSpeech.cancel();

       // Forzar configuración de voz en inglés
       await this.mobileSpeech.setLanguage('en-US');
       await this.mobileSpeech.setRate(rate);

       // Dividir el texto en segmentos más pequeños
       const textToSpeak = text.slice(startPosition);
       const segments = this.splitTextIntoSegments(textToSpeak);

       // Función para hablar segmentos secuencialmente
       const speakSegments = async (index = 0) => {
         if (index < segments.length && !this.isPaused) {
           const segment = segments[index];
           await this.mobileSpeech.speak({
             text: segment,
             queue: false,
             listeners: {
               onend: () => {
                 if (!this.isPaused) {
                   // Actualizar la última posición
                   this.lastPosition = startPosition + 
                     segments.slice(0, index + 1).join('').length;
                   
                   if (index === segments.length - 1) {
                     // Último segmento
                     if (this.onEndCallback) this.onEndCallback();
                   } else {
                     // Continuar con el siguiente segmento
                     speakSegments(index + 1);
                   }
                 }
               }
             }
           });
         }
       };

       await speakSegments();

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

 splitTextIntoSegments(text, maxLength = 200) {
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