
import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import Hls from 'hls.js';
import { socket } from '../lib/socket';
import { radioService, type RadioStation } from '../services/radioService';

interface PlayerContextType {
  currentStation: RadioStation | null;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  isDucked: boolean;
  isVignetteMuted: boolean;
  audioLevel: number;
  setCurrentStation: (station: RadioStation) => void;
  setIsPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  setIsMuted: (muted: boolean) => void;
  setIsDucked: (ducked: boolean) => void;
  setIsVignetteMuted: (muted: boolean) => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentStation, setCurrentStation] = useState<RadioStation | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [isDucked, setIsDucked] = useState(false);
  const [isVignetteMuted, setIsVignetteMuted] = useState(false);
  const [wasPlayingBeforeVignette, setWasPlayingBeforeVignette] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);

  // Audio Logic
  useEffect(() => {
    if (!audioRef.current || !currentStation) return;
    const audio = audioRef.current;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHls = currentStation.url_resolved?.includes('.m3u8') || currentStation.hls === 1;
    if (isHls) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 60,
          maxBufferLength: 30,
          maxMaxBufferLength: 600,
          appendErrorMaxRetry: 5,
        });
        hls.loadSource(currentStation.url_resolved);
        hls.attachMedia(audio);
        hlsRef.current = hls;
      } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
        audio.src = currentStation.url_resolved;
      }
    } else {
      audio.src = currentStation.url_resolved;
    }

    if (isPlaying) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromiseRef.current = playPromise;
        playPromise.catch(() => setIsPlaying(false));
      }
    }
  }, [currentStation]);

  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;

    if (isPlaying) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromiseRef.current = playPromise;
        playPromise.catch(() => setIsPlaying(false));
      }
    } else {
      if (playPromiseRef.current) {
        playPromiseRef.current.then(() => audio.pause()).catch(() => audio.pause());
      } else {
        audio.pause();
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      const duckFactor = isDucked ? 0.2 : 1.0;
      const vignetteFactor = isVignetteMuted ? 0 : 1.0;
      audioRef.current.volume = (isMuted ? 0 : volume) * duckFactor * vignetteFactor;
    }
  }, [volume, isMuted, isDucked, isVignetteMuted]);

  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Handle Vignette Socket Events
  useEffect(() => {
    console.log("[Context] Setting up vignette socket listeners. Socket connected:", socket.connected);
    
    const onConnect = () => console.log("[Context] Socket connected");
    const onDisconnect = () => console.log("[Context] Socket disconnected");
    
    const handleVignetteStart = () => {
      console.log("[Context] Vignette START received. Current isPlaying:", isPlayingRef.current);
      setIsVignetteMuted(true);
      
      // If radio is playing, pause it and remember to resume
      if (isPlayingRef.current) {
        console.log("[Context] Pausing radio for vignette");
        setWasPlayingBeforeVignette(true);
        setIsPlaying(false);
      }
    };

    const handleVignetteEnd = () => {
      console.log("[Context] Vignette END received");
      setIsVignetteMuted(false);
      
      // If it was playing before, resume it
      setWasPlayingBeforeVignette(prev => {
        if (prev) {
          console.log("[Context] Resuming radio after vignette");
          setIsPlaying(true);
        }
        return false;
      });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('vignette:start', handleVignetteStart);
    socket.on('vignette:end', handleVignetteEnd);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('vignette:start', handleVignetteStart);
      socket.off('vignette:end', handleVignetteEnd);
    };
  }, []); // No dependencies, use ref for isPlaying

  // VU Meter Logic
  useEffect(() => {
    if (!isPlaying || !audioRef.current) {
      setAudioLevel(0);
      return;
    }

    let animationFrameId: number;

    const startAudioAnalysis = () => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        
        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') ctx.resume();

        if (!analyserRef.current) {
          analyserRef.current = ctx.createAnalyser();
          analyserRef.current.fftSize = 128;
          analyserRef.current.smoothingTimeConstant = 0.8;
        }

        const analyser = analyserRef.current;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        if (!sourceNodeRef.current && audioRef.current) {
          sourceNodeRef.current = ctx.createMediaElementSource(audioRef.current);
          sourceNodeRef.current.connect(analyser);
          analyser.connect(ctx.destination);
        }

        const updateLevel = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          const bassRange = Math.floor(bufferLength * 0.2);
          for (let i = 0; i < bassRange; i++) sum += dataArray[i];
          setAudioLevel((sum / bassRange) / 255);
          animationFrameId = requestAnimationFrame(updateLevel);
        };

        updateLevel();
      } catch (e) {
        console.error("VU Meter Error:", e);
      }
    };

    startAudioAnalysis();
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying]);

  return (
    <PlayerContext.Provider value={{
      currentStation,
      isPlaying,
      volume,
      isMuted,
      isDucked,
      isVignetteMuted,
      audioLevel,
      setCurrentStation,
      setIsPlaying,
      setVolume,
      setIsMuted,
      setIsDucked,
      setIsVignetteMuted,
      audioRef
    }}>
      {children}
      <audio 
        ref={audioRef} 
        crossOrigin="anonymous" 
        preload="auto"
        playsInline
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={(e) => {
          console.error("Audio element error:", e);
          if (currentStation && isPlaying) {
            setIsPlaying(false);
          }
        }}
      />
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}
