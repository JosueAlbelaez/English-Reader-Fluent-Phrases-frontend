import { useState, useCallback } from 'react';

export const useSpeech = () => {
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState(null);

  const speak = useCallback((text) => {
    if (!('speechSynthesis' in window)) {
      setError('Speech synthesis not supported');
      return;
    }

    try {
      setSpeaking(true);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = (err) => {
        setError(err.message);
        setSpeaking(false);
      };
      speechSynthesis.speak(utterance);
    } catch (err) {
      setError(err.message);
      setSpeaking(false);
    }
  }, []);

  const stop = useCallback(() => {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
      setSpeaking(false);
    }
  }, []);

  return {
    speaking,
    error,
    speak,
    stop,
  };
};