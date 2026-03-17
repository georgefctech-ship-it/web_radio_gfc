import { useState, useRef, useCallback } from 'react';
import { socket } from '../lib/socket';

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
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const vignetteGainRef = useRef<GainNode | null>(null);
  const vignetteAnalyserRef = useRef<AnalyserNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const masterAnalyserRef = useRef<AnalyserNode | null>(null);

  const [isInitialized, setIsInitialized] = useState(false);
  const [micVolume, setMicVolume] = useState(1);
  const [masterVolume, setMasterVolume] = useState(1);
  const [isMicActive, setIsMicActive] = useState(false);
  const [isVignettePlaying, setIsVignettePlaying] = useState(false);
  const [vignetteVolume, setVignetteVolume] = useState(1);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const activeVignettesRef = useRef<Map<string, { source: AudioBufferSourceNode, gain: GainNode }>>(new Map());

  const initialize = useCallback(async () => {
    if (audioContextRef.current) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    audioContextRef.current = ctx;

    // Master Gain
    const masterGain = ctx.createGain();
    masterGain.gain.value = masterVolume;
    masterGainRef.current = masterGain;

    // Vignette Gain & Analyser
    const vGain = ctx.createGain();
    vGain.gain.value = vignetteVolume;
    vignetteGainRef.current = vGain;
    
    const vAnalyser = ctx.createAnalyser();
    vAnalyser.fftSize = 256;
    vignetteAnalyserRef.current = vAnalyser;
    vGain.connect(vAnalyser);
    vAnalyser.connect(masterGain);

    // Destination for streaming
    const dest = ctx.createMediaStreamDestination();
    destinationRef.current = dest;

    // Master Analyser for VU meter
    const masterAnalyser = ctx.createAnalyser();
    masterAnalyser.fftSize = 256;
    masterAnalyserRef.current = masterAnalyser;

    // Connections: Master -> Analyser -> Destination
    masterGain.connect(masterAnalyser);
    masterAnalyser.connect(dest);
    
    // Monitoring is handled separately to allow toggling
    if (isMonitoring) {
      masterAnalyser.connect(ctx.destination);
    }

    console.log("[AudioMixer] Initialized. Stream tracks:", dest.stream.getTracks().length);
    dest.stream.getTracks().forEach(t => console.log(`[AudioMixer] Track: ${t.kind}, ID: ${t.id}, Enabled: ${t.enabled}`));

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

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        micAnalyserRef.current = analyser;

        source.connect(gain);
        gain.connect(analyser);
        analyser.connect(masterGainRef.current!);
        
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

  const updateVignetteVolume = useCallback((val: number) => {
    setVignetteVolume(val);
    if (vignetteGainRef.current) {
      vignetteGainRef.current.gain.setTargetAtTime(val, audioContextRef.current!.currentTime, 0.05);
    }
  }, []);

  const stopAllVignettes = useCallback(() => {
    activeVignettesRef.current.forEach(({ source }) => {
      try {
        source.stop();
      } catch (e) {
        // Source might already be stopped
      }
    });
    activeVignettesRef.current.clear();
    setIsVignettePlaying(false);
    socket.emit('vignette:end');
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
      let audioBuffer: AudioBuffer;
      try {
        audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      } catch (err: any) {
        console.warn(`decodeAudioData failed (size: ${arrayBuffer.byteLength} bytes), attempting raw PCM fallback:`, err);
        
        // Fallback: Try to treat as raw 16-bit PCM 24kHz (Gemini TTS default)
        try {
          if (arrayBuffer.byteLength < 2) {
            throw new Error("Buffer too small for PCM data");
          }
          
          // Ensure we don't try to read past the end of the buffer if it has an odd length
          const numSamples = Math.floor(arrayBuffer.byteLength / 2);
          const pcmData = new Int16Array(arrayBuffer, 0, numSamples);
          
          audioBuffer = ctx.createBuffer(1, numSamples, 24000);
          const channelData = audioBuffer.getChannelData(0);
          for (let i = 0; i < numSamples; i++) {
            // Convert 16-bit PCM to float [-1.0, 1.0]
            channelData[i] = pcmData[i] / 32768.0;
          }
          console.log("Raw PCM fallback successful, samples:", numSamples);
        } catch (fallbackErr: any) {
          console.error("Raw PCM fallback also failed:", fallbackErr);
          throw new Error(`Unable to decode audio data (size: ${arrayBuffer.byteLength} bytes): ${fallbackErr.message || "Unknown error"}`);
        }
      }

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      source.connect(vignetteGainRef.current!);
      
      const vignetteId = Math.random().toString(36).substring(7);
      activeVignettesRef.current.set(vignetteId, { source, gain: vignetteGainRef.current! });

      setIsVignettePlaying(true);
      console.log("[AudioMixer] Emitting vignette:start", url);
      socket.emit('vignette:start', { url });
      
      source.start(0);
      
      // Cleanup
      source.onended = () => {
        activeVignettesRef.current.delete(vignetteId);
        if (activeVignettesRef.current.size === 0) {
          console.log("[AudioMixer] Emitting vignette:end");
          socket.emit('vignette:end');
          setIsVignettePlaying(false);
        }
        source.disconnect();
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

  const toggleMonitoring = useCallback(() => {
    if (!audioContextRef.current || !masterAnalyserRef.current) return;
    
    const newState = !isMonitoring;
    setIsMonitoring(newState);
    
    if (newState) {
      masterAnalyserRef.current.connect(audioContextRef.current.destination);
    } else {
      try {
        masterAnalyserRef.current.disconnect(audioContextRef.current.destination);
      } catch (e) {
        // Might not be connected
      }
    }
  }, [isMonitoring]);

  const getAnalyser = useCallback((type: 'mic' | 'vignette' | 'master' = 'master') => {
    if (type === 'mic') return micAnalyserRef.current;
    if (type === 'vignette') return vignetteAnalyserRef.current;
    return masterAnalyserRef.current;
  }, []);

  return {
    initialize,
    toggleMic,
    isMicActive,
    micVolume,
    updateMicVolume,
    masterVolume,
    updateMasterVolume,
    vignetteVolume,
    updateVignetteVolume,
    stopAllVignettes,
    playVignette,
    getMixedStream,
    getAnalyser,
    toggleMonitoring,
    isMonitoring,
    isInitialized,
    isVignettePlaying
  };
};
