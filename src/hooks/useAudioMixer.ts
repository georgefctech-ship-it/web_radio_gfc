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

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      const gain = ctx.createGain();
      gain.gain.value = 1.0; // Vignette volume

      source.connect(gain);
      gain.connect(masterGainRef.current!);
      
      source.start(0);
    } catch (err) {
      console.error("Failed to play vignette:", err);
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
