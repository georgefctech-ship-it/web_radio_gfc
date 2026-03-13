import { useState, useEffect, useCallback, useRef } from 'react';

interface VoiceControlOptions {
  onCommand: (command: string, params?: string) => void;
  language?: string;
}

export function useVoiceControl({ onCommand, language = 'pt-BR' }: VoiceControlOptions) {
  const [isListening, setIsListening] = useState(false);
  const isListeningRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [recognition, setRecognition] = useState<any>(null);

  // Sync ref with state
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError('Speech Recognition not supported in this browser.');
      return;
    }

    const recog = new SpeechRecognition();
    recog.continuous = true;
    recog.interimResults = false;
    recog.lang = language;

    recog.onresult = (event: any) => {
      const last = event.results.length - 1;
      const text = event.results[last][0].transcript.toLowerCase().trim();
      console.log('Voice Command Received:', text);

      // Command logic
      const isEnglish = language.startsWith('en');

      if (text.includes('toque') || text.includes('tocar') || text.includes('play station') || text.includes('tune to')) {
        const stationName = text.replace(/toque|tocar|play station|tune to/g, '').trim();
        onCommand('play_station', stationName);
      } else if (text.includes('próxima') || text.includes('proxima') || text.includes('next')) {
        onCommand('next');
      } else if (text.includes('anterior') || text.includes('volta') || text.includes('previous') || text.includes('back')) {
        onCommand('previous');
      } else if (text.includes('mute') || text.includes('mudo') || text.includes('silêncio') || text.includes('silent')) {
        onCommand('mute');
      } else if (text.includes('play') || text.includes('tocar rádio') || text.includes('start')) {
        onCommand('play');
      } else if (text.includes('pause') || text.includes('parar') || text.includes('stop')) {
        onCommand('pause');
      } else if (text.includes('volume alto') || text.includes('aumentar volume') || text.includes('volume up') || text.includes('louder')) {
        onCommand('volume_up');
      } else if (text.includes('volume baixo') || text.includes('abaixar volume') || text.includes('volume down') || text.includes('quieter')) {
        onCommand('volume_down');
      } else if (text.includes('parar de ouvir') || text.includes('desligar microfone') || text.includes('stop listening') || text.includes('turn off microphone')) {
        isListeningRef.current = false;
        setIsListening(false);
        recog.stop();
      } else if (text.includes('ajuda') || text.includes('comandos') || text.includes('help') || text.includes('commands')) {
        onCommand('help');
      }
    };

    recog.onstart = () => {
      setIsListening(true);
      isListeningRef.current = true;
    };

    recog.onerror = (event: any) => {
      // Ignore 'no-speech' and 'aborted' errors as they are common and often transient
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }
      
      console.error('Speech Recognition Error:', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setIsListening(false);
        isListeningRef.current = false;
        setError('Permission denied or service not allowed.');
      }
    };

    recog.onend = () => {
      // Only restart if the user's intent is still to listen and it wasn't a fatal error
      if (isListeningRef.current) {
        setTimeout(() => {
          if (isListeningRef.current) {
            try {
              recog.start();
            } catch (e) {
              // If it's already started, this will fail silently which is fine
            }
          }
        }, 300); // Small delay before restart to avoid 'aborted' loops
      } else {
        setIsListening(false);
      }
    };

    setRecognition(recog);
  }, [language, onCommand]);

  const toggleListening = useCallback(() => {
    if (!recognition) return;

    if (isListeningRef.current) {
      isListeningRef.current = false;
      setIsListening(false);
      try {
        recognition.stop();
      } catch (e) {
        console.error('Failed to stop recognition:', e);
      }
    } else {
      isListeningRef.current = true;
      try {
        recognition.start();
        // setIsListening(true) will be handled by onstart
      } catch (e) {
        console.error('Failed to start recognition:', e);
        // If start fails, reset intent
        isListeningRef.current = false;
        setIsListening(false);
      }
    }
  }, [recognition]);

  return { isListening, toggleListening, error };
}
