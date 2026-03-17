import { useState, useEffect, useCallback, useRef } from 'react';

interface VoiceControlOptions {
  onCommand: (command: string, params?: string) => void;
  language?: string;
}

export function useVoiceControl({ onCommand, language = 'pt-BR' }: VoiceControlOptions) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const isListeningIntentRef = useRef(false);
  const isStartingRef = useRef(false);
  const onCommandRef = useRef(onCommand);

  // Keep onCommand ref up to date
  useEffect(() => {
    onCommandRef.current = onCommand;
  }, [onCommand]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError('Reconhecimento de voz não suportado neste navegador.');
      return;
    }

    const recognition = new SpeechRecognition();
    // Use continuous = false for more predictable behavior on mobile
    // We handle the restart manually in onend
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = language;

    recognition.onstart = () => {
      console.log('[VoiceControl] Started');
      setIsListening(true);
      isStartingRef.current = false;
      setError(null);
    };

    recognition.onresult = (event: any) => {
      const last = event.results.length - 1;
      const text = event.results[last][0].transcript.toLowerCase().trim();
      console.log('[VoiceControl] Result:', text);

      const cmd = onCommandRef.current;
      
      // Improved command matching with more synonyms
      if (text.includes('toque') || text.includes('tocar') || text.includes('sintonizar') || text.includes('tune to') || text.includes('coloca na') || text.includes('mudar para')) {
        const stationName = text.replace(/toque|tocar|sintonizar|tune to|rádio|radio|coloca na|mudar para/g, '').trim();
        if (stationName) cmd('play_station', stationName);
      } else if (text.includes('próxima') || text.includes('proxima') || text.includes('next') || text.includes('seguinte') || text.includes('pular') || text.includes('passar')) {
        cmd('next');
      } else if (text.includes('anterior') || text.includes('volta') || text.includes('previous') || text.includes('atrás') || text.includes('voltar')) {
        cmd('previous');
      } else if (text.includes('mute') || text.includes('mudo') || text.includes('silêncio') || text.includes('silent') || text.includes('desativar som') || text.includes('sem som')) {
        cmd('mute');
      } else if (text.includes('play') || text.includes('tocar') || text.includes('iniciar') || text.includes('start') || text.includes('continuar')) {
        // Only trigger 'play' if it's not a 'play_station' command
        if (!text.includes('toque') && !text.includes('tocar ') && !text.includes('coloca na')) {
          cmd('play');
        }
      } else if (text.includes('pause') || text.includes('parar') || text.includes('stop') || text.includes('pausar') || text.includes('interromper')) {
        cmd('pause');
      } else if (text.includes('volume alto') || text.includes('aumentar volume') || text.includes('mais alto') || text.includes('volume up') || text.includes('aumentar o som')) {
        cmd('volume_up');
      } else if (text.includes('volume baixo') || text.includes('abaixar volume') || text.includes('mais baixo') || text.includes('volume down') || text.includes('abaixar o som')) {
        cmd('volume_down');
      } else if (text.includes('ajuda') || text.includes('comandos') || text.includes('help') || text.includes('commands') || text.includes('o que você faz')) {
        cmd('help');
      }
    };

    recognition.onerror = (event: any) => {
      isStartingRef.current = false;
      
      if (event.error === 'no-speech' || event.error === 'audio-capture' || event.error === 'network' || event.error === 'aborted') {
        // These are common and should just trigger a restart if intent is true
        // We log them as info instead of error to avoid cluttering
        console.log(`[VoiceControl] Info (expected): ${event.error}`);
        return;
      }

      console.error('[VoiceControl] Error:', event.error);

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        isListeningIntentRef.current = false;
        setIsListening(false);
        setError('Permissão de microfone negada.');
      } else {
        setError(`Erro no reconhecimento de voz: ${event.error}`);
      }
    };

    recognition.onend = () => {
      console.log('[VoiceControl] Ended');
      isStartingRef.current = false;
      
      // Auto-restart if the user still wants to listen
      if (isListeningIntentRef.current) {
        setTimeout(() => {
          if (isListeningIntentRef.current && !isStartingRef.current) {
            try {
              isStartingRef.current = true;
              recognition.start();
            } catch (e) {
              console.error('[VoiceControl] Failed to restart:', e);
              isStartingRef.current = false;
            }
          }
        }, 400); // Slightly longer delay for mobile stability
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      isListeningIntentRef.current = false;
      try {
        recognition.stop();
      } catch (e) {}
    };
  }, [language]);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;

    if (isListeningIntentRef.current) {
      isListeningIntentRef.current = false;
      setIsListening(false);
      isStartingRef.current = false;
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    } else {
      isListeningIntentRef.current = true;
      if (!isStartingRef.current) {
        try {
          isStartingRef.current = true;
          recognitionRef.current.start();
        } catch (e) {
          console.error('[VoiceControl] Start failed:', e);
          isListeningIntentRef.current = false;
          isStartingRef.current = false;
          setIsListening(false);
          setError('Falha ao iniciar microfone. Tente novamente.');
        }
      }
    }
  }, []);

  return { isListening, toggleListening, error };
}
