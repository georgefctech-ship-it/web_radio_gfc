import { useState, useRef, useCallback, useEffect } from 'react';
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
  
  const deck1GainRef = useRef<GainNode | null>(null);
  const deck1AnalyserRef = useRef<AnalyserNode | null>(null);
  const deck2GainRef = useRef<GainNode | null>(null);
  const deck2AnalyserRef = useRef<AnalyserNode | null>(null);
  
  const masterGainRef = useRef<GainNode | null>(null);
  const crossfaderNodeRef = useRef<GainNode | null>(null); // Not used directly, we use deck gains for crossfading
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const masterAnalyserRef = useRef<AnalyserNode | null>(null);

  const [isInitialized, setIsInitialized] = useState(false);
  const [micVolume, setMicVolume] = useState(1);
  const [masterVolume, setMasterVolume] = useState(1);
  const [isMicActive, setIsMicActive] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [crossfader, setCrossfader] = useState(0); // -1 (Deck 1) to 1 (Deck 2)
  const [isDucking, setIsDucking] = useState(true); // Talkover mode
  const [vignetteVolume, setVignetteVolume] = useState(1);
  const [isVignettePlaying, setIsVignettePlaying] = useState(false);
  
  const activeVignettesRef = useRef<Map<string, { source: AudioBufferSourceNode, gain: GainNode, deck: 'deck1' | 'deck2' }>>(new Map());

  const initialize = useCallback(async () => {
    if (audioContextRef.current) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    audioContextRef.current = ctx;

    // Master Gain
    const masterGain = ctx.createGain();
    masterGain.gain.value = masterVolume;
    masterGainRef.current = masterGain;

    // Deck 1 Gain & Analyser
    const d1Gain = ctx.createGain();
    d1Gain.gain.value = 1;
    deck1GainRef.current = d1Gain;
    const d1Analyser = ctx.createAnalyser();
    d1Analyser.fftSize = 256;
    deck1AnalyserRef.current = d1Analyser;
    d1Gain.connect(d1Analyser);
    d1Analyser.connect(masterGain);

    // Deck 2 Gain & Analyser
    const d2Gain = ctx.createGain();
    d2Gain.gain.value = 1;
    deck2GainRef.current = d2Gain;
    const d2Analyser = ctx.createAnalyser();
    d2Analyser.fftSize = 256;
    deck2AnalyserRef.current = d2Analyser;
    d2Gain.connect(d2Analyser);
    d2Analyser.connect(masterGain);

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
    
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    setIsInitialized(true);
  }, [masterVolume]);

  // Update Crossfader
  useEffect(() => {
    if (!deck1GainRef.current || !deck2GainRef.current) return;
    
    // Simple linear crossfade
    // crossfader: -1 -> Deck 1: 1, Deck 2: 0
    // crossfader: 0  -> Deck 1: 1, Deck 2: 1 (or 0.5/0.5, but for radio usually we want full volume in middle)
    // Actually, equal power crossfade is better
    const d1Vol = Math.cos((crossfader + 1) * 0.5 * Math.PI / 2);
    const d2Vol = Math.sin((crossfader + 1) * 0.5 * Math.PI / 2);
    
    deck1GainRef.current.gain.setTargetAtTime(d1Vol, audioContextRef.current!.currentTime, 0.1);
    deck2GainRef.current.gain.setTargetAtTime(d2Vol, audioContextRef.current!.currentTime, 0.1);
  }, [crossfader]);

  // Ducking Logic
  useEffect(() => {
    if (!isInitialized || !isDucking) return;
    if (!deck1GainRef.current || !deck2GainRef.current) return;

    const ctx = audioContextRef.current!;
    const duckVolume = isMicActive ? 0.2 : 1.0;
    
    // Apply ducking on top of crossfader
    const d1Base = Math.cos((crossfader + 1) * 0.5 * Math.PI / 2);
    const d2Base = Math.sin((crossfader + 1) * 0.5 * Math.PI / 2);

    deck1GainRef.current.gain.setTargetAtTime(d1Base * duckVolume, ctx.currentTime, 0.3);
    deck2GainRef.current.gain.setTargetAtTime(d2Base * duckVolume, ctx.currentTime, 0.3);
  }, [isMicActive, isDucking, isInitialized, crossfader]);

  const toggleMic = useCallback(async () => {
    if (!audioContextRef.current) await initialize();
    const ctx = audioContextRef.current!;
    
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
  }, []);

  const stopAllVignettes = useCallback(() => {
    activeVignettesRef.current.forEach(({ source }) => {
      try {
        source.stop();
      } catch (e) {}
    });
    activeVignettesRef.current.clear();
    setIsVignettePlaying(false);
    socket.emit('vignette:end');
  }, []);

  const playVignette = useCallback(async (url: string, deck: 'deck1' | 'deck2' = 'deck1', loop: boolean = false) => {
    if (!audioContextRef.current) await initialize();
    const ctx = audioContextRef.current!;

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    try {
      let arrayBuffer: ArrayBuffer;
      if (url.startsWith('data:')) {
        const base64 = url.split(',')[1];
        const binaryString = window.atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
        arrayBuffer = bytes.buffer;
      } else {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Erro: ${response.status}`);
        arrayBuffer = await response.arrayBuffer();
      }

      let audioBuffer: AudioBuffer;
      try {
        audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      } catch (err) {
        // Fallback PCM logic...
        const numSamples = Math.floor(arrayBuffer.byteLength / 2);
        const pcmData = new Int16Array(arrayBuffer, 0, numSamples);
        audioBuffer = ctx.createBuffer(1, numSamples, 24000);
        const channelData = audioBuffer.getChannelData(0);
        for (let i = 0; i < numSamples; i++) channelData[i] = pcmData[i] / 32768.0;
      }

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.loop = loop;

      const targetGain = deck === 'deck1' ? deck1GainRef.current! : deck2GainRef.current!;
      source.connect(targetGain);
      
      const vignetteId = Math.random().toString(36).substring(7);
      activeVignettesRef.current.set(vignetteId, { source, gain: targetGain, deck });

      socket.emit('vignette:start', { url, deck, loop });
      source.start(0);
      setIsVignettePlaying(true);
      
      source.onended = () => {
        if (!source.loop) {
          activeVignettesRef.current.delete(vignetteId);
          if (activeVignettesRef.current.size === 0) {
            socket.emit('vignette:end');
            setIsVignettePlaying(false);
          }
          source.disconnect();
        }
      };

      return { id: vignetteId, source };
    } catch (err) {
      console.error("Failed to play vignette:", err);
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
      try { masterAnalyserRef.current.disconnect(audioContextRef.current.destination); } catch (e) {}
    }
  }, [isMonitoring]);

  const getAnalyser = useCallback((type: 'mic' | 'deck1' | 'deck2' | 'master' = 'master') => {
    if (type === 'mic') return micAnalyserRef.current;
    if (type === 'deck1') return deck1AnalyserRef.current;
    if (type === 'deck2') return deck2AnalyserRef.current;
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
    isVignettePlaying,
    crossfader,
    setCrossfader,
    isDucking,
    setIsDucking
  };
};
