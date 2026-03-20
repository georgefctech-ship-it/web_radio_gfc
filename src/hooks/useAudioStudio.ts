import { useState, useEffect, useCallback, useRef } from 'react';
import { audioService, type AudioFile } from '../services/audioService';
import { useAudioMixer } from './useAudioMixer';

export const useAudioStudio = () => {
  const mixer = useAudioMixer();
  const [vignettes, setVignettes] = useState<AudioFile[]>([]);
  const [tracks, setTracks] = useState<AudioFile[]>([]);
  const [commercials, setCommercials] = useState<AudioFile[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTrack, setActiveTrack] = useState<string | null>(null);
  const [trackVolume, setTrackVolume] = useState(0.3); // Default low volume for BG music
  const [queue, setQueue] = useState<AudioFile[]>([]);

  const trackSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const data = await audioService.getAllStudioAudio();
    setVignettes(data.vignettes);
    setTracks(data.tracks);
    setCommercials(data.commercials);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const playInstantVignette = useCallback(async (url: string) => {
    await mixer.playVignette(url, 'deck1');
  }, [mixer]);

  const toggleTrack = useCallback(async (track: AudioFile) => {
    if (activeTrack === track.id) {
      // Stop
      if (trackSourceRef.current) {
        try {
          trackSourceRef.current.stop();
          trackSourceRef.current.disconnect();
        } catch (e) {}
        trackSourceRef.current = null;
      }
      setActiveTrack(null);
      return;
    }

    // Stop previous if any
    if (trackSourceRef.current) {
      try {
        trackSourceRef.current.stop();
        trackSourceRef.current.disconnect();
      } catch (e) {}
    }
    
    if (!mixer.isInitialized) await mixer.initialize();
    
    const result = await mixer.playVignette(track.url, 'deck2', true); // Loop = true
    if (result) {
      trackSourceRef.current = result.source;
      setActiveTrack(track.id);
    }
  }, [activeTrack, mixer]);

  const addToQueue = useCallback((commercial: AudioFile) => {
    setQueue(prev => [...prev, commercial]);
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  const playNextInQueue = useCallback(async () => {
    if (queue.length === 0) return;
    const next = queue[0];
    await mixer.playVignette(next.url, 'deck1');
    setQueue(prev => prev.slice(1));
  }, [queue, mixer]);

  const uploadVignette = useCallback(async (file: File | Blob, name: string) => {
    const url = await audioService.uploadFile('vinhetas', file, name);
    if (url) {
      await loadAll();
      return true;
    }
    return false;
  }, [loadAll]);

  const deleteVignette = useCallback(async (fileName: string) => {
    const success = await audioService.deleteFile('vinhetas', fileName);
    if (success) {
      await loadAll();
      return true;
    }
    return false;
  }, [loadAll]);

  return {
    vignettes,
    tracks,
    commercials,
    loading,
    queue,
    activeTrack,
    trackVolume,
    setTrackVolume,
    playInstantVignette,
    toggleTrack,
    addToQueue,
    removeFromQueue,
    clearQueue,
    playNextInQueue,
    uploadVignette,
    deleteVignette,
    refresh: loadAll,
    ...mixer
  };
};
