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
  const isActuallyListeningRef = useRef(false);
  const isStartingRef = useRef(false);
  const onCommandRef = useRef(onCommand);
  const lastRestartTimeRef = useRef(0);

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
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = language;

    recognition.onstart = () => {
      console.log('[VoiceControl] Started');
      setIsListening(true);
      isActuallyListeningRef.current = true;
      isStartingRef.current = false;
      setError(null);
    };

    recognition.onresult = (event: any) => {
      const last = event.results.length - 1;
      const text = event.results[last][0].transcript.toLowerCase().trim().replace(/[.,!?;:]/g, '');
      console.log('[VoiceControl] Result:', text);

      const cmd = onCommandRef.current;
      
      const isMatch = (keywords: string[]) => {
        const words = text.split(/\s+/);
        return keywords.some(k => words.includes(k));
      };

      if (text.includes('toque') || text.includes('tocar') || text.includes('sintonizar') || text.includes('tune to') || text.includes('coloca na') || text.includes('mudar para')) {
        const stationName = text.replace(/toque|tocar|sintonizar|tune to|rádio|radio|coloca na|mudar para/g, '').trim();
        if (stationName) cmd('play_station', stationName);
      } else if (isMatch(['próxima', 'proxima', 'next', 'seguinte', 'pular', 'passar', 'avançar', 'avanca', 'próximo', 'proximo', 'frente'])) {
        cmd('next');
      } else if (isMatch(['anterior', 'volta', 'previous', 'atrás', 'voltar', 'tras', 'trás'])) {
        cmd('previous');
      } else if (isMatch(['mute', 'mudo', 'silêncio', 'silent', 'desativar som', 'sem som'])) {
        cmd('mute');
      } else if (isMatch(['play', 'tocar', 'iniciar', 'start', 'continuar', 'ligar'])) {
        if (!text.includes('toque') && !text.includes('tocar ') && !text.includes('coloca na')) {
          cmd('play');
        }
      } else if (isMatch(['pause', 'parar', 'stop', 'pausar', 'interromper', 'pausa', 'desligar'])) {
        cmd('pause');
      } else if (isMatch(['volume alto', 'aumentar volume', 'mais alto', 'volume up', 'aumentar o som', 'aumentar'])) {
        cmd('volume_up');
      } else if (isMatch(['volume baixo', 'abaixar volume', 'mais baixo', 'volume down', 'abaixar o som', 'diminuir', 'abaixar'])) {
        cmd('volume_down');
      } else if (isMatch(['ajuda', 'comandos', 'help', 'commands', 'o que você faz'])) {
        cmd('help');
      }
    };

    recognition.onerror = (event: any) => {
      isStartingRef.current = false;
      
      if (event.error === 'no-speech' || event.error === 'audio-capture' || event.error === 'network' || event.error === 'aborted') {
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
      isActuallyListeningRef.current = false;
      setIsListening(false);
      
      if (isListeningIntentRef.current) {
        const now = Date.now();
        // Prevent restarting more than once every 1.5 seconds
        if (now - lastRestartTimeRef.current < 1500) {
          console.log('[VoiceControl] Restart throttled');
          setTimeout(() => {
            if (isListeningIntentRef.current) recognition.onend();
          }, 1000);
          return;
        }

        console.log('[VoiceControl] Auto-restarting...');
        lastRestartTimeRef.current = now;
        
        setTimeout(() => {
          if (isListeningIntentRef.current && !isStartingRef.current && !isActuallyListeningRef.current) {
            try {
              isStartingRef.current = true;
              recognition.start();
            } catch (e) {
              console.error('[VoiceControl] Failed to restart:', e);
              isStartingRef.current = false;
            }
          }
        }, 800); 
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
      console.log('[VoiceControl] Stopping listening intent...');
      isListeningIntentRef.current = false;
      setIsListening(false);
      isStartingRef.current = false;
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    } else {
      console.log('[VoiceControl] Starting listening intent...');
      isListeningIntentRef.current = true;
      if (!isStartingRef.current && !isActuallyListeningRef.current) {
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
