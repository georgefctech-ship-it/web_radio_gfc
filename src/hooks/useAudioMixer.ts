import { useState, useRef, useCallback } from 'react';

export interface Vignette {
  id: string;
  name: string;
  url: string;
}

export const useAudioMixer = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micGainRef = useRef<GainNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const [isInitialized, setIsInitialized] = useState(false);
  const [micVolume, setMicVolume] = useState(1);
  const [masterVolume, setMasterVolume] = useState(1);
  const [isMicActive, setIsMicActive] = useState(false);

  const initialize = useCallback(async () => {
    if (audioContextRef.current) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    audioContextRef.current = ctx;

    // Master Gain
    const masterGain = ctx.createGain();
    masterGain.gain.value = masterVolume;
    masterGainRef.current = masterGain;

    // Destination for streaming
    const dest = ctx.createMediaStreamDestination();
    destinationRef.current = dest;

    // Analyser for VU meter
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    // Connections: Master -> Analyser -> Destination & Audio Out (for monitoring)
    masterGain.connect(analyser);
    analyser.connect(dest);
    analyser.connect(ctx.destination); // Monitor locally

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    setIsInitialized(true);
  }, [masterVolume]);

  const toggleMic = useCallback(async () => {
    if (!audioContextRef.current) await initialize();
    const ctx = audioContextRef.current!;
    
    // Ensure context is running (crucial for mobile)
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    if (isMicActive) {
      micStreamRef.current?.getTracks().forEach(t => t.stop());
      micNodeRef.current?.disconnect();
      micGainRef.current?.disconnect();
      setIsMicActive(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
        
        const source = ctx.createMediaStreamSource(stream);
        micNodeRef.current = source;

        const gain = ctx.createGain();
        gain.gain.value = micVolume;
        micGainRef.current = gain;

        source.connect(gain);
        gain.connect(masterGainRef.current!);
        
        setIsMicActive(true);
      } catch (err) {
        console.error("Failed to access microphone:", err);
        throw err;
      }
    }
  }, [initialize, isMicActive, micVolume]);

  const updateMicVolume = useCallback((val: number) => {
    setMicVolume(val);
    if (micGainRef.current) {
      micGainRef.current.gain.setTargetAtTime(val, audioContextRef.current!.currentTime, 0.05);
    }
  }, []);

  const updateMasterVolume = useCallback((val: number) => {
    setMasterVolume(val);
    if (masterGainRef.current) {
      masterGainRef.current.gain.setTargetAtTime(val, audioContextRef.current!.currentTime, 0.05);
    }
  }, []);

  const playVignette = useCallback(async (url: string) => {
    if (!audioContextRef.current) await initialize();
    const ctx = audioContextRef.current!;

    // Ensure context is running
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    try {
      let arrayBuffer: ArrayBuffer;

      if (url.startsWith('data:')) {
        // Handle data URL
        const base64 = url.split(',')[1];
        const binaryString = window.atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        arrayBuffer = bytes.buffer;
      } else {
        // Handle regular URL
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Erro ao buscar áudio: ${response.status} ${response.statusText}`);
        }
        
        const contentType = response.headers.get('Content-Type');
        if (contentType && !contentType.includes('audio') && !contentType.includes('application/octet-stream')) {
          console.warn(`Unexpected content type: ${contentType}`);
          // We still try to decode, but this is a red flag (e.g. HTML error page)
        }
        
        arrayBuffer = await response.arrayBuffer();
      }

      if (arrayBuffer.byteLength === 0) {
        throw new Error("O arquivo de áudio está vazio.");
      }

      // Use the newer promise-based decodeAudioData if available
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer).catch(err => {
        console.error("decodeAudioData failed:", err);
        throw new Error("Unable to decode audio data. The file might be corrupted or in an unsupported format.");
      });

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      const gain = ctx.createGain();
      gain.gain.value = 1.0; // Vignette volume

      source.connect(gain);
      gain.connect(masterGainRef.current!);
      
      source.start(0);
      
      // Cleanup
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
      };
    } catch (err: any) {
      console.error("Failed to play vignette:", err);
      // Re-throw or handle as needed. For now, we'll just log it better.
      throw err; 
    }
  }, [initialize]);

  const getMixedStream = useCallback(() => {
    return destinationRef.current?.stream || null;
  }, []);

  const getAnalyser = useCallback(() => {
    return analyserRef.current;
  }, []);

  return {
    initialize,
    toggleMic,
    isMicActive,
    micVolume,
    updateMicVolume,
    masterVolume,
    updateMasterVolume,
    playVignette,
    getMixedStream,
    getAnalyser,
    isInitialized
  };
};
