
import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import Hls from 'hls.js';
import { radioService, type RadioStation } from '../services/radioService';

interface PlayerContextType {
  currentStation: RadioStation | null;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  audioLevel: number;
  setCurrentStation: (station: RadioStation) => void;
  setIsPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  setIsMuted: (muted: boolean) => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentStation, setCurrentStation] = useState<RadioStation | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
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
        const hls = new Hls();
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
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

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
      audioLevel,
      setCurrentStation,
      setIsPlaying,
      setVolume,
      setIsMuted,
      audioRef
    }}>
      {children}
      <audio 
        ref={audioRef} 
        crossOrigin="anonymous" 
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
