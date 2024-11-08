export const createSpeechUtterance = (text, options = {}) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = options.lang || 'en-US';
    utterance.rate = options.rate || 0.9;
    utterance.pitch = options.pitch || 1;
    utterance.volume = options.volume || 1;
    return utterance;
  };
  
  export const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  export const calculateAudioPosition = (text, charIndex) => {
    return (charIndex / text.length) * 100;
  };
  
  export const getTextSegment = (text, position, length = 100) => {
    const start = Math.max(0, position - length / 2);
    const end = Math.min(text.length, position + length / 2);
    return text.slice(start, end);
  };
  
  export const findWordAtPosition = (text, position) => {
    const words = text.split(' ');
    let currentPosition = 0;
    
    for (const word of words) {
      const wordEnd = currentPosition + word.length;
      if (position >= currentPosition && position <= wordEnd) {
        return word;
      }
      currentPosition = wordEnd + 1; // +1 for the space
    }
    
    return null;
  };