import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Radio, Play, Square, Volume2, Users, Settings, X, Activity, Plus, Trash2, Edit2, LogOut, Wand2, Loader2, Music2, Zap, RefreshCw, Power } from 'lucide-react';
import { socket } from '../lib/socket';
import { useNavigate, Link } from 'react-router-dom';
import { useAudioStudio } from '../hooks/useAudioStudio';
import { VUMeter } from '../components/VUMeter';
import { AudioVisualizer } from '../components/AudioVisualizer';
import { Chat } from '../components/Chat';
import { audioService, type AudioFile } from '../services/audioService';
import { usePlayer } from '../context/PlayerContext';
import { supabase } from '../lib/supabase';
import { GoogleGenAI, Modality } from "@google/genai";

export const LiveStudio: React.FC = () => {
  const navigate = useNavigate();
  const { setIsDucked, setIsVignetteMuted } = usePlayer();
  const {
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
    isStreaming,
    startStreaming,
    stopStreaming,
    crossfader,
    setCrossfader,
    isDucking,
    setIsDucking,
    vignettes,
    tracks,
    commercials,
    loading: studioLoading,
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
    uploadAudio,
    saveExternalAudio,
    deleteAudio,
    refresh: refreshStudio
  } = useAudioStudio();

  const [isOnAir, setIsOnAir] = useState(false);
  const [activeTab, setActiveTab] = useState<'diagnostics' | 'history' | 'listeners' | 'chat'>('chat');
  const [streamUrl, setStreamUrl] = useState('https://shaincast.caster.fm:2199/tunein/georgefc.pls');
  const [broadcastTitle, setBroadcastTitle] = useState('Rádio GFC - Ao Vivo');
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [programName, setProgramName] = useState('Programa GFC');
  const [presenterName, setPresenterName] = useState('George FC');
  const [socketStatus, setSocketStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [listeners, setListeners] = useState(0);
  const [latency, setLatency] = useState<number | null>(null);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isVignetteFormOpen, setIsVignetteFormOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [vignetteToDelete, setVignetteToDelete] = useState<AudioFile | null>(null);
  const [editingVignette, setEditingVignette] = useState<AudioFile | null>(null);
  const [vignetteForm, setVignetteForm] = useState({ 
    name: '', 
    url: '', 
    file: null as File | null,
    bucket: 'vinhetas' as 'vinhetas' | 'trilhas' | 'comerciais',
    mode: 'file' as 'file' | 'url'
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isGeneratingVignette, setIsGeneratingVignette] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('Diga com voz empolgada: RÁDIO GFC, a sua rádio na web!');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [supabaseStatus, setSupabaseStatus] = useState<'connected' | 'error' | 'checking'>('checking');
  const [serverStatus, setServerStatus] = useState<'online' | 'offline' | 'connecting'>('connecting');
  const [serverLatency, setServerLatency] = useState<number | null>(null);
  const [sessionHistory, setSessionHistory] = useState<{ id: string, time: string, event: string, type: 'info' | 'success' | 'warning' | 'error' }[]>([]);
  const [peerStats, setPeerStats] = useState<Record<string, { latency: number, status: string }>>({});
  const [icecastConfig, setIcecastConfig] = useState<{ server: string, port: string, mount: string, hasPassword: boolean } | null>(null);

  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});

  // Check Admin
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/admin');
        return;
      }
      setIsAdmin(true);
      setLoading(false);
    };
    checkAdmin();
  }, [navigate]);

  // Ducking Logic
  useEffect(() => {
    setIsDucked(isMicActive);
  }, [isMicActive, setIsDucked]);

  useEffect(() => {
    setIsVignetteMuted(isVignettePlaying);
  }, [isVignettePlaying, setIsVignetteMuted]);

  // Load Vignettes from Bucket
  useEffect(() => {
    refreshStudio();
  }, [refreshStudio]);

  // Socket and WebRTC Setup
  useEffect(() => {
    socket.on('listeners:count', (count: number) => setListeners(count));
    
    socket.on('live:error', (err: { message: string }) => {
      console.error("[Studio] Live Error:", err.message);
      setStatusMessage({ type: 'error', text: err.message });
      setIsOnAir(false);
      setTimeout(() => setStatusMessage(null), 5000);
    });
    
    // WebRTC Signaling for listeners
    const handleStreamRequest = async ({ listenerId }: { listenerId: string }) => {
      // Use a ref for isOnAir to avoid dependency cycle if needed, 
      // but here we can just check the current state if we use a stable listener
      // Actually, we need the latest isOnAir. We can use a ref for it.
    };

    // We'll use a more stable way to handle signaling
    return () => {
      // Don't close the shared socket
      socket.off('listeners:count');
    };
  }, []);

  // Ref for isOnAir and isVignettePlaying to be used in socket listeners without re-binding
  const isOnAirRef = useRef(isOnAir);
  const isVignettePlayingRef = useRef(isVignettePlaying);
  
  useEffect(() => {
    isOnAirRef.current = isOnAir;
  }, [isOnAir]);

  useEffect(() => {
    isVignettePlayingRef.current = isVignettePlaying;
  }, [isVignettePlaying]);

  const addHistoryEvent = (event: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setSessionHistory(prev => [
      { id: Math.random().toString(36).substr(2, 9), time: new Date().toLocaleTimeString(), event, type },
      ...prev.slice(0, 49)
    ]);
  };

  const forceReconnect = () => {
    console.log("[Studio] Forçando reconexão de todos os ouvintes...");
    socket.emit('live:start'); // Re-trigger live start to notify everyone
    addHistoryEvent("Comando de reconexão forçada enviado", "warning");
    setStatusMessage({ type: 'success', text: 'Sinal de reconexão enviado para todos os ouvintes' });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  useEffect(() => {
    const onStreamRequest = async ({ listenerId }: { listenerId: string }) => {
      // Allow stream if on air OR if a vignette is playing
      if (!isOnAirRef.current && !isVignettePlayingRef.current) {
        console.log(`[Studio] Ignorando pedido de stream de ${listenerId} (Estúdio Offline e sem vinheta)`);
        return;
      }
      
      const stream = getMixedStream();
      if (!stream) {
        console.warn("[Studio] Tentativa de stream sem mixer inicializado");
        return;
      }

      console.log(`[Studio] Enviando stream para ouvinte ${listenerId}. Tracks:`, stream.getTracks().length);
      addHistoryEvent(`Novo ouvinte solicitando conexão: ${listenerId.slice(0, 6)}...`, "info");
      
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      peerConnections.current[listenerId] = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.oniceconnectionstatechange = () => {
        console.log(`[WebRTC] Peer ${listenerId} state: ${pc.iceConnectionState}`);
        setPeerStats(prev => ({
          ...prev,
          [listenerId]: { ...prev[listenerId], status: pc.iceConnectionState }
        }));
        if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
          delete peerConnections.current[listenerId];
          setPeerStats(prev => {
            const next = { ...prev };
            delete next[listenerId];
            return next;
          });
          addHistoryEvent(`Ouvinte desconectado: ${listenerId.slice(0, 6)}...`, "warning");
        } else if (pc.iceConnectionState === 'connected') {
          addHistoryEvent(`Ouvinte conectado com sucesso: ${listenerId.slice(0, 6)}...`, "success");
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('webrtc:ice-candidate', {
            targetId: listenerId,
            candidate: event.candidate
          });
        }
      };

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit('webrtc:offer', {
          targetId: listenerId,
          offer
        });
      } catch (err) {
        console.error("[Studio] Erro ao criar oferta WebRTC:", err);
      }
    };

    const onAnswer = async ({ fromId, answer }: { fromId: string, answer: RTCSessionDescriptionInit }) => {
      const pc = peerConnections.current[fromId];
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          console.error("[Studio] Erro ao definir descrição remota:", err);
        }
      }
    };

    const onIceCandidate = async ({ fromId, candidate }: { fromId: string, candidate: RTCIceCandidateInit }) => {
      const pc = peerConnections.current[fromId];
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("[Studio] Erro ao adicionar ICE candidate:", err);
        }
      }
    };

    socket.on('webrtc:request-stream', onStreamRequest);
    socket.on('webrtc:answer', onAnswer);
    socket.on('webrtc:ice-candidate', onIceCandidate);

    return () => {
      socket.off('webrtc:request-stream', onStreamRequest);
      socket.off('webrtc:answer', onAnswer);
      socket.off('webrtc:ice-candidate', onIceCandidate);
    };
  }, [getMixedStream]);

  useEffect(() => {
    console.log("[Studio] Socket status:", socket.connected ? "Connected" : "Disconnected");
    setSocketStatus(socket.connected ? 'connected' : 'connecting');
    
    const onConnect = () => {
      console.log("[Studio] Socket connected");
      setSocketStatus('connected');
      if (isOnAirRef.current) {
        console.log("[Studio] Re-emitting live:start after reconnection");
        socket.emit('live:start');
      }
    };
    const onDisconnect = () => {
      console.log("[Studio] Socket disconnected");
      setSocketStatus('disconnected');
    };
    
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', (err) => {
      console.error("[Studio] Socket connection error:", err);
      setSocketStatus('disconnected');
    });
    
    // Latency monitoring
    const latencyInterval = setInterval(async () => {
      const connections = Object.entries(peerConnections.current);
      if (connections.length === 0) {
        setLatency(null);
        setPeerStats({});
        return;
      }

      try {
        let totalRtt = 0;
        let count = 0;
        const newPeerStats: Record<string, { latency: number, status: string }> = {};
        
        // Use Promise.all to fetch stats in parallel
        const statsPromises = connections.map(async ([id, pc]) => {
          try {
            const stats = await pc.getStats();
            let peerLatency = 0;
            stats.forEach(report => {
              if ((report.type === 'remote-candidate' || report.type === 'candidate-pair') && 
                  (report.roundTripTime || report.currentRoundTripTime)) {
                const rtt = report.roundTripTime || report.currentRoundTripTime;
                peerLatency = Math.round(rtt * 1000);
              }
            });
            return { id, latency: peerLatency, status: pc.iceConnectionState };
          } catch (e) {
            return { id, latency: 0, status: 'error' };
          }
        });

        const results = await Promise.all(statsPromises);
        results.forEach(res => {
          newPeerStats[res.id] = { latency: res.latency, status: res.status };
          if (res.latency > 0) {
            totalRtt += res.latency;
            count++;
          }
        });

        setPeerStats(newPeerStats);
        if (count > 0) {
          setLatency(Math.round(totalRtt / count));
        }
      } catch (err) {
        console.warn("[Studio] Error getting stats:", err);
      }
    }, 5000);
    
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      clearInterval(latencyInterval);
    };
  }, []);

  useEffect(() => {
    if (isOnAir) {
      addHistoryEvent("Transmissão AO VIVO iniciada", "success");
    } else {
      addHistoryEvent("Transmissão AO VIVO encerrada", "info");
    }
  }, [isOnAir]);

  useEffect(() => {
    if (isVignettePlaying) {
      addHistoryEvent("Executando vinheta", "info");
    }
  }, [isVignettePlaying]);

  const handleToggleOnAir = async () => {
    if (!isOnAir) {
      try {
        await initialize();
        
        // Automatically activate mic if not active
        if (!isMicActive) {
          await toggleMic();
        }
        
        // Start Icecast streaming
        startStreaming();

        // Broadcast via Supabase Realtime as requested
        const channel = supabase.channel('radio-studio');
        await channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.send({
              type: 'broadcast',
              event: 'comando_estudio',
              payload: { 
                acao: 'ENTRAR_NO_AR', 
                streamUrl,
                title: broadcastTitle,
                whatsapp,
                instagram,
                program: programName,
                presenter: presenterName
              }
            });
          }
        });

        setIsOnAir(true);
        setStatusMessage({ type: 'success', text: 'Você está no ar! Transmitindo para Icecast.' });
        setTimeout(() => setStatusMessage(null), 3000);
      } catch (err) {
        console.error("[Studio] Erro ao iniciar transmissão:", err);
        setStatusMessage({ type: 'error', text: 'Erro ao acessar microfone ou iniciar stream.' });
      }
    } else {
      // Stop Icecast streaming
      stopStreaming();

      // Broadcast stop signal
      const channel = supabase.channel('radio-studio');
      await channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.send({
            type: 'broadcast',
            event: 'comando_estudio',
            payload: { acao: 'SAIR_DO_AR' }
          });
        }
      });

      setIsOnAir(false);
      
      // Stop mic when stopping broadcast (optional, but cleaner)
      if (isMicActive) {
        await toggleMic();
      }
      
      Object.values(peerConnections.current).forEach(pc => pc.close());
      peerConnections.current = {};
    }
  };

  useEffect(() => {
    // Check Supabase
    const checkSupabase = async () => {
      try {
        const { error } = await supabase.from('vignettes').select('id').limit(1);
        setSupabaseStatus(error ? 'error' : 'connected');
      } catch (e) {
        setSupabaseStatus('error');
      }
    };
    checkSupabase();

    // Monitor Server Status & Latency
    const serverMonitor = setInterval(() => {
      const start = Date.now();
      socket.emit('ping', (resp: any) => {
        if (resp?.status === 'ok') {
          setServerStatus('online');
          setServerLatency(Date.now() - start);
        }
      });
    }, 5000);

    const onConnect = () => setServerStatus('online');
    const onDisconnect = () => setServerStatus('offline');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // Fetch Icecast Config for diagnostics
    fetch('/api/icecast-config')
      .then(res => res.json())
      .then(data => setIcecastConfig(data))
      .catch(err => console.error("Erro ao buscar config Icecast:", err));

    return () => {
      clearInterval(serverMonitor);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary"></div>
      </div>
    );
  }

  const handleSaveVignette = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGeneratingVignette(true);
    try {
      if (vignetteForm.mode === 'file') {
        if (!vignetteForm.file) {
          throw new Error("Por favor, selecione um arquivo.");
        }
        const success = await uploadAudio(vignetteForm.bucket, vignetteForm.file, vignetteForm.name);
        if (success) {
          setStatusMessage({ type: 'success', text: 'Arquivo enviado com sucesso!' });
        } else {
          throw new Error("Erro ao enviar arquivo para o storage.");
        }
      } else {
        if (!vignetteForm.url) {
          throw new Error("Por favor, insira a URL do áudio.");
        }
        const type = vignetteForm.bucket === 'vinhetas' ? 'vignette' : vignetteForm.bucket === 'trilhas' ? 'track' : 'commercial';
        const success = await saveExternalAudio(type, vignetteForm.name, vignetteForm.url);
        if (success) {
          setStatusMessage({ type: 'success', text: 'URL salva com sucesso!' });
        } else {
          throw new Error("Erro ao salvar URL no banco de dados.");
        }
      }
      setIsVignetteFormOpen(false);
      setVignetteForm({ name: '', url: '', file: null, bucket: 'vinhetas', mode: 'file' });
    } catch (err: any) {
      console.error('Save error:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Erro ao salvar áudio.' });
    } finally {
      setIsGeneratingVignette(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  const handleDeleteVignette = (vignette: AudioFile) => {
    setVignetteToDelete(vignette);
    setIsConfirmDeleteOpen(true);
  };

  const confirmDeleteVignette = async () => {
    if (!vignetteToDelete) return;
    const success = await deleteAudio(vignetteToDelete.type === 'track' ? 'trilhas' : vignetteToDelete.type === 'commercial' ? 'comerciais' : 'vinhetas', vignetteToDelete.fileName, vignetteToDelete.id);
    if (success) {
      setStatusMessage({ type: 'success', text: 'Arquivo excluído!' });
    } else {
      setStatusMessage({ type: 'error', text: 'Erro ao excluir arquivo.' });
    }
    setIsConfirmDeleteOpen(false);
    setVignetteToDelete(null);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleGenerateAiVignette = async () => {
    if (!aiPrompt.trim()) return;
    setIsGeneratingVignette(true);
    console.log("[Studio] Iniciando geração de vinheta com IA...");
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : null);
      
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY não encontrada.");
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: aiPrompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Fenrir' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const binaryString = atob(base64Audio);
        const pcmData = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          pcmData[i] = binaryString.charCodeAt(i);
        }
        
        const wavHeader = new ArrayBuffer(44);
        const view = new DataView(wavHeader);
        view.setUint32(0, 0x52494646, false); // "RIFF"
        view.setUint32(4, 36 + pcmData.length, true); // File size
        view.setUint32(8, 0x57415645, false); // "WAVE"
        view.setUint32(12, 0x666d7420, false); // "fmt "
        view.setUint32(16, 16, true); // Chunk size
        view.setUint16(20, 1, true); // Audio format (PCM)
        view.setUint16(22, 1, true); // Num channels (Mono)
        view.setUint32(24, 24000, true); // Sample rate
        view.setUint32(28, 24000 * 2, true); // Byte rate
        view.setUint16(32, 2, true); // Block align
        view.setUint16(34, 16, true); // Bits per sample
        view.setUint32(36, 0x64617461, false); // "data"
        view.setUint32(40, pcmData.length, true); // Data size
        
        const wavData = new Uint8Array(44 + pcmData.length);
        wavData.set(new Uint8Array(wavHeader), 0);
        wavData.set(pcmData, 44);
        
        const blob = new Blob([wavData], { type: 'audio/wav' });
        const name = aiPrompt.length > 20 ? aiPrompt.substring(0, 20) : aiPrompt;
        
        const success = await uploadAudio('vinhetas', blob, `${name}.wav`);
        if (success) {
          setStatusMessage({ type: 'success', text: 'Vinheta IA gerada e salva!' });
          setIsManageModalOpen(false);
        } else {
          throw new Error("Erro ao salvar vinheta gerada.");
        }
      }
    } catch (err: any) {
      console.error("[Studio] Erro ao gerar vinheta com IA:", err);
      setStatusMessage({ type: 'error', text: err.message || "Falha ao gerar áudio com IA." });
    } finally {
      setIsGeneratingVignette(false);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-2 sm:p-4 md:p-8 font-sans selection:bg-primary selection:text-white overflow-x-hidden">
      {/* Status Messages */}
      <AnimatePresence>
        {statusMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl ${
              statusMessage.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
            }`}
          >
            {statusMessage.text}
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8 sm:mb-12">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <button 
            onClick={() => navigate('/')}
            className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors"
            title="Sair do Estúdio"
          >
            <LogOut className="size-5 text-gray-400" />
          </button>
          <div className="size-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
            <Radio className="size-6 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black tracking-tighter uppercase truncate">Estúdio ao Vivo</h1>
            <p className="text-gray-500 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest truncate">Console de Transmissão Profissional</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 sm:gap-6 w-full sm:w-auto">
          <div className={`flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/10 ${
            socketStatus === 'connecting' ? 'animate-pulse' : ''
          }`}>
            <div className={`size-1.5 rounded-full ${
              socketStatus === 'connected' ? 'bg-emerald-500' : 
              socketStatus === 'connecting' ? 'bg-yellow-500' : 
              'bg-red-500'
            }`} />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              {socketStatus === 'connected' ? 'Online' : 
               socketStatus === 'connecting' ? 'Conectando' : 
               'Offline'}
            </span>
            {(socketStatus === 'disconnected' || socketStatus === 'connecting') && (
              <button 
                onClick={() => socket.disconnect().connect()}
                className="ml-1 p-1 hover:bg-white/10 rounded-full transition-colors"
                title="Reconectar"
              >
                <Zap className="size-2 text-primary" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsManageModalOpen(true)}
              className="p-3 bg-white/5 border border-white/10 rounded-2xl text-gray-400 hover:bg-white/10 hover:text-white transition-all"
              title="Configurações de Transmissão"
            >
              <Settings className="size-5" />
            </button>

            <button 
              onClick={toggleMonitoring}
              className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${
                isMonitoring 
                  ? 'bg-primary/20 border-primary text-primary' 
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
              }`}
              title={isMonitoring ? "Desativar Monitoramento Local" : "Ativar Monitoramento Local"}
            >
              <Volume2 className="size-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">
                {isMonitoring ? 'Monitorando' : 'Monitorar'}
              </span>
            </button>
            
            <button 
              onClick={stopAllVignettes}
              className="px-8 py-4 bg-red-600/20 text-red-500 border-2 border-red-500/50 rounded-3xl font-black uppercase tracking-[0.2em] text-xs hover:bg-red-600 hover:text-white hover:scale-105 active:scale-95 transition-all flex items-center gap-3 shadow-2xl shadow-red-600/20 group"
              title="PARAR TUDO (Pânico)"
            >
              <Zap className="size-5 fill-current group-hover:animate-bounce" />
              PÂNICO
            </button>

            <button 
              onClick={handleToggleOnAir}
              className={`px-6 sm:px-8 py-3 rounded-2xl font-black uppercase tracking-widest transition-all flex items-center gap-3 w-full sm:w-auto justify-center hover:scale-105 active:scale-95 ${
                isOnAir 
                  ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/40' 
                  : 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
              }`}
            >
              {isOnAir ? <Square className="size-4 fill-current" /> : <Power className="size-4" />}
              {isOnAir ? 'DESCONECTAR' : 'CONECTAR'}
            </button>
          </div>
        </div>
      </header>

      <main className="grid xl:grid-cols-[1fr_350px] gap-8">
        <div className="space-y-8">
          {/* Broadcast Dashboard (Inspired by Caster.fm) */}
          <section className="bg-[#1a1a1a] rounded-[40px] border border-white/10 p-6 sm:p-8 shadow-2xl overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50 opacity-50" />
            
            <div className="flex flex-col lg:flex-row gap-8 items-center">
              {/* Main Control */}
              <div className="flex flex-col items-center gap-4 min-w-[200px]">
                <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                  isOnAir ? 'bg-red-500/20 border-red-500 text-red-500 animate-pulse' : 'bg-white/5 border-white/10 text-gray-500'
                }`}>
                  <div className={`size-2 rounded-full ${isOnAir ? 'bg-red-500' : 'bg-gray-700'}`} />
                  {isOnAir ? 'ON AIR' : 'OFF AIR'}
                </div>

                <button 
                  onClick={handleToggleOnAir}
                  className={`w-48 h-24 rounded-3xl font-black uppercase tracking-[0.2em] text-sm transition-all flex flex-col items-center justify-center gap-2 shadow-2xl ${
                    isOnAir 
                      ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-600/30' 
                      : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/30'
                  }`}
                >
                  <Power className="size-6" />
                  {isOnAir ? 'Disconnect' : 'Connect'}
                </button>
              </div>

              {/* Status Indicators & VU Meters */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                <div className="bg-black/40 rounded-2xl p-4 border border-white/5 flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`size-10 rounded-xl flex items-center justify-center ${serverStatus === 'online' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
                      <Radio className="size-5" />
                    </div>
                    <div>
                      <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Server Status</p>
                      <p className={`text-xs font-black uppercase ${serverStatus === 'online' ? 'text-emerald-500' : 'text-red-500'}`}>
                        {serverStatus === 'online' ? 'Online' : 'Offline'}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-between items-end h-24 gap-1">
                    <VUMeter analyser={getAnalyser('deck1')} />
                    <VUMeter analyser={getAnalyser('deck2')} />
                    <VUMeter analyser={getAnalyser('mic')} />
                    <VUMeter analyser={getAnalyser('master')} />
                  </div>
                  <div className="flex justify-between text-[6px] font-black text-gray-500 uppercase tracking-tighter">
                    <span>D1</span>
                    <span>D2</span>
                    <span>MIC</span>
                    <span>MST</span>
                  </div>
                </div>

                <div className="bg-black/40 rounded-2xl p-4 border border-white/5 flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <div className="size-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
                      <Activity className="size-5" />
                    </div>
                    <div>
                      <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Health</p>
                      <p className="text-xs font-black uppercase text-primary">Excellent</p>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col justify-center gap-2">
                    <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Crossfader</p>
                    <input 
                      type="range" 
                      min="-1" 
                      max="1" 
                      step="0.01" 
                      value={crossfader}
                      onChange={(e) => setCrossfader(parseFloat(e.target.value))}
                      className="w-full accent-primary bg-white/10 rounded-lg h-2 appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-[8px] font-black text-gray-500">
                      <span>DECK 1</span>
                      <span>DECK 2</span>
                    </div>
                  </div>
                </div>

                <div className="bg-black/40 rounded-2xl p-4 border border-white/5 flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <div className="size-10 rounded-xl bg-white/5 text-white flex items-center justify-center">
                      <Users className="size-5" />
                    </div>
                    <div>
                      <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Listeners</p>
                      <p className="text-xs font-black uppercase text-white">{Object.keys(peerConnections.current).length}</p>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col justify-center gap-2">
                    <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Mic Volume</p>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={toggleMic}
                        className={`p-2 rounded-lg transition-colors ${isMicActive ? 'bg-red-500/20 text-red-500' : 'bg-white/5 text-gray-500'}`}
                      >
                        {isMicActive ? <Mic className="size-4" /> : <MicOff className="size-4" />}
                      </button>
                      <input 
                        type="range" 
                        min="0" 
                        max="2" 
                        step="0.01" 
                        value={micVolume}
                        onChange={(e) => updateMicVolume(parseFloat(e.target.value))}
                        className="flex-1 accent-primary bg-white/10 rounded-lg h-2 appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Current Info */}
              <div className="flex-1 space-y-4 w-full">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col w-full">
                    <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Current Song / Program</p>
                    <div className="flex items-center gap-2">
                      <input 
                        type="text" 
                        value={broadcastTitle}
                        onChange={(e) => setBroadcastTitle(e.target.value)}
                        className="bg-transparent border-b border-white/10 text-sm font-bold text-white focus:outline-none focus:border-primary py-1 w-full"
                      />
                      <button 
                        onClick={() => {
                           setStatusMessage({ type: 'success', text: 'Metadados atualizados!' });
                           setTimeout(() => setStatusMessage(null), 2000);
                        }}
                        className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all"
                      >
                        Update
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Encoder</p>
                    <p className="text-[10px] font-bold text-white">Opus 128Kbps @ 48kHz</p>
                  </div>
                  {icecastConfig && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Icecast Target</p>
                        <button 
                          onClick={() => socket.emit('live:test-connection')}
                          className="text-[6px] font-black uppercase tracking-widest text-primary hover:underline"
                        >
                          Testar Conexão
                        </button>
                      </div>
                      <p className="text-[10px] font-bold text-primary truncate">
                        {icecastConfig.server}:{icecastConfig.port}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Uptime</p>
                    <p className="text-[10px] font-bold text-white">00:00:00</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Broadcast Control (Cast) - Integrated at the top */}
          <section className="bg-white/5 rounded-[40px] border border-white/10 p-6 sm:p-8 hidden">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-sm font-black uppercase tracking-widest text-primary">Controle de Transmissão (Cast)</h2>
                <p className="text-[10px] text-gray-600 font-bold uppercase">Configurações globais do estúdio</p>
              </div>
              
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase tracking-widest text-gray-500">Título</label>
                  <input 
                    type="text" 
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-1.5 text-[10px] font-bold focus:outline-none focus:border-primary/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase tracking-widest text-gray-500">Programa</label>
                  <input 
                    type="text" 
                    value={programName}
                    onChange={(e) => setProgramName(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-1.5 text-[10px] font-bold focus:outline-none focus:border-primary/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase tracking-widest text-gray-500">WhatsApp</label>
                  <input 
                    type="text" 
                    placeholder="Ex: 5511999999999"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-1.5 text-[10px] font-bold focus:outline-none focus:border-primary/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase tracking-widest text-gray-500">Instagram</label>
                  <input 
                    type="text" 
                    placeholder="@usuario"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-1.5 text-[10px] font-bold focus:outline-none focus:border-primary/50"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Professional Mixing Desk Section */}
          <section className="bg-[#111] rounded-[40px] border border-white/10 p-4 sm:p-8 shadow-2xl relative overflow-hidden">
            {/* Background Texture for Desk */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5 pointer-events-none" />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-sm font-black uppercase tracking-widest text-gray-500">Mesa de Mixagem Profissional</h2>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 px-3 py-1 bg-black/40 rounded-full border border-white/5">
                    <div className={`size-1.5 rounded-full ${isInitialized ? 'bg-emerald-500' : 'bg-gray-700'}`} />
                    <span className="text-[8px] font-black uppercase tracking-widest text-gray-500">Mixer {isInitialized ? 'Ativo' : 'Inativo'}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
                {/* VU Meter Section - Larger and more prominent */}
                <div className="flex flex-col items-center gap-4 bg-black/40 p-6 rounded-[32px] border border-white/5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Master (VU)</span>
                  <div className="h-64 sm:h-80 w-full flex flex-col gap-4">
                    <VUMeter analyser={getAnalyser('master')} />
                    <div className="h-32 bg-black/60 rounded-xl overflow-hidden border border-white/5">
                      <AudioVisualizer analyser={getAnalyser('master')} />
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {[...Array(10)].map((_, i) => (
                      <div key={i} className={`w-1 h-1 rounded-full ${i > 7 ? 'bg-red-500/30' : i > 5 ? 'bg-yellow-500/30' : 'bg-emerald-500/30'}`} />
                    ))}
                  </div>
                </div>
                
                {/* Channels Grid */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-6 sm:gap-8">
                  {/* Channel 1: Microphone */}
                  <div className={`flex flex-col gap-6 bg-black/20 p-4 sm:p-6 rounded-[32px] border transition-all hover:scale-[1.02] hover:bg-black/30 ${
                    isMicActive ? 'border-red-500/30 shadow-lg shadow-red-500/5' : 'border-white/5 hover:border-white/10'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black uppercase tracking-widest text-primary">CH 01</span>
                        <span className="text-[12px] font-black uppercase text-white">Voz / Mic</span>
                      </div>
                      <button 
                        onClick={toggleMic}
                        className={`size-12 rounded-2xl flex items-center justify-center transition-all shadow-xl hover:scale-110 active:scale-90 ${
                          isMicActive 
                            ? 'bg-red-500 text-white animate-pulse shadow-red-500/40' 
                            : 'bg-white/5 text-gray-500 hover:bg-white/10'
                        }`}
                      >
                        {isMicActive ? <Mic className="size-6" /> : <MicOff className="size-6" />}
                      </button>
                    </div>
                    
                    <div className="flex-1 flex flex-row items-center gap-6 relative">
                      <div className="h-48 sm:h-64 w-12 bg-black/40 rounded-2xl p-2 flex flex-col items-center border border-white/5">
                        <VUMeter analyser={getAnalyser('mic')} />
                      </div>
                      <div className="h-48 sm:h-64 flex-1 bg-black/40 rounded-2xl p-4 flex flex-col items-center gap-4 border border-white/5 relative">
                        <input 
                          type="range" 
                          min="0" 
                          max="2" 
                          step="0.01"
                          value={micVolume}
                          onChange={(e) => updateMicVolume(parseFloat(e.target.value))}
                          className="h-full appearance-none bg-white/5 w-3 rounded-full cursor-pointer accent-primary vertical-range"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-mono text-primary font-bold">{Math.round(micVolume * 100)}%</span>
                      <span className="text-[8px] font-black uppercase tracking-widest text-gray-600 mt-1">Nível</span>
                    </div>
                  </div>

                  {/* Channel 2: Deck 1 */}
                  <div className="flex flex-col gap-6 bg-black/20 p-4 sm:p-6 rounded-[32px] border border-white/5 hover:border-white/10 hover:scale-[1.02] hover:bg-black/30 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black uppercase tracking-widest text-primary">CH 02</span>
                        <span className="text-[12px] font-black uppercase text-white">Deck 1</span>
                      </div>
                      <div className="size-12 rounded-2xl flex items-center justify-center bg-white/5 text-gray-500">
                        <Music2 className="size-6" />
                      </div>
                    </div>
                    
                    <div className="flex-1 flex flex-row items-center gap-6 relative">
                      <div className="h-48 sm:h-64 w-12 bg-black/40 rounded-2xl p-2 flex flex-col items-center border border-white/5">
                        <VUMeter analyser={getAnalyser('deck1')} />
                      </div>
                      <div className="h-48 sm:h-64 flex-1 bg-black/40 rounded-2xl p-4 flex flex-col items-center gap-4 border border-white/5 relative">
                        <div className="h-full w-full flex flex-col justify-center items-center gap-2">
                          <div className="text-[8px] font-black text-gray-600 uppercase">Deck 1</div>
                          <div className="flex-1 w-2 bg-white/5 rounded-full relative">
                            <div 
                              className="absolute bottom-0 w-full bg-primary rounded-full transition-all"
                              style={{ height: `${Math.cos((crossfader + 1) * 0.5 * Math.PI / 2) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-mono text-primary font-bold">
                        {Math.round(Math.cos((crossfader + 1) * 0.5 * Math.PI / 2) * 100)}%
                      </span>
                      <span className="text-[8px] font-black uppercase tracking-widest text-gray-600 mt-1">Nível</span>
                    </div>
                  </div>

                  {/* Channel 3: Deck 2 */}
                  <div className="flex flex-col gap-6 bg-black/20 p-4 sm:p-6 rounded-[32px] border border-white/5 hover:border-white/10 hover:scale-[1.02] hover:bg-black/30 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black uppercase tracking-widest text-primary">CH 03</span>
                        <span className="text-[12px] font-black uppercase text-white">Deck 2</span>
                      </div>
                      <div className="size-12 rounded-2xl flex items-center justify-center bg-white/5 text-gray-500">
                        <Music2 className="size-6" />
                      </div>
                    </div>
                    
                    <div className="flex-1 flex flex-row items-center gap-6 relative">
                      <div className="h-48 sm:h-64 w-12 bg-black/40 rounded-2xl p-2 flex flex-col items-center border border-white/5">
                        <VUMeter analyser={getAnalyser('deck2')} />
                      </div>
                      <div className="h-48 sm:h-64 flex-1 bg-black/40 rounded-2xl p-4 flex flex-col items-center gap-4 border border-white/5 relative">
                        <div className="h-full w-full flex flex-col justify-center items-center gap-2">
                          <div className="text-[8px] font-black text-gray-600 uppercase">Deck 2</div>
                          <div className="flex-1 w-2 bg-white/5 rounded-full relative">
                            <div 
                              className="absolute bottom-0 w-full bg-primary rounded-full transition-all"
                              style={{ height: `${Math.sin((crossfader + 1) * 0.5 * Math.PI / 2) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-mono text-primary font-bold">
                        {Math.round(Math.sin((crossfader + 1) * 0.5 * Math.PI / 2) * 100)}%
                      </span>
                      <span className="text-[8px] font-black uppercase tracking-widest text-gray-600 mt-1">Nível</span>
                    </div>
                  </div>

                  {/* Master Output Channel */}
                  <div className="flex flex-col gap-6 bg-primary/5 p-4 sm:p-6 rounded-[32px] border border-primary/10 hover:border-primary/20 hover:scale-[1.02] hover:bg-primary/10 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black uppercase tracking-widest text-primary">MASTER</span>
                        <span className="text-[12px] font-black uppercase text-white">Saída Geral</span>
                      </div>
                      <div className={`size-12 rounded-2xl flex items-center justify-center shadow-lg transition-all ${
                        isOnAir 
                          ? 'bg-red-500 text-white animate-pulse shadow-red-500/20' 
                          : 'bg-white/5 text-gray-500'
                      }`}>
                        <Volume2 className="size-6" />
                      </div>
                    </div>
                    
                    <div className="flex-1 flex flex-row items-center gap-6 relative">
                      <div className="h-48 sm:h-64 w-12 bg-black/40 rounded-2xl p-2 flex flex-col items-center border border-white/5">
                        <VUMeter analyser={getAnalyser('master')} />
                      </div>
                      <div className="h-48 sm:h-64 flex-1 bg-black/40 rounded-2xl p-4 flex flex-col items-center gap-4 border border-white/5 relative">
                        <input 
                          type="range" 
                          min="0" 
                          max="1.5" 
                          step="0.01"
                          value={masterVolume}
                          onChange={(e) => updateMasterVolume(parseFloat(e.target.value))}
                          className="h-full appearance-none bg-white/5 w-3 rounded-full cursor-pointer accent-primary vertical-range"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-mono text-primary font-bold">{Math.round(masterVolume * 100)}%</span>
                      <span className="text-[8px] font-black uppercase tracking-widest text-gray-600 mt-1">Nível</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Crossfader Section */}
              <div className="mt-12 flex flex-col items-center gap-4">
                <div className="flex justify-between w-full max-w-md px-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Deck 1</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Crossfader</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Deck 2</span>
                </div>
                <div className="w-full max-w-md h-12 bg-black/60 rounded-full border border-white/10 p-2 flex items-center relative">
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10" />
                  <input 
                    type="range" 
                    min="-1" 
                    max="1" 
                    step="0.01"
                    value={crossfader}
                    onChange={(e) => setCrossfader(parseFloat(e.target.value))}
                    className="w-full appearance-none bg-transparent cursor-pointer accent-primary h-2"
                  />
                </div>
                <div className="flex items-center gap-6 mt-2">
                  <button 
                    onClick={() => setIsDucking(!isDucking)}
                    className={`flex items-center gap-2 px-6 py-3 rounded-full border transition-all hover:scale-105 active:scale-95 shadow-lg ${
                      isDucking 
                        ? 'bg-primary/20 border-primary text-primary shadow-primary/10' 
                        : 'bg-white/5 border-white/10 text-gray-500'
                    }`}
                  >
                    <div className={`size-2 rounded-full ${isDucking ? 'bg-primary animate-pulse' : 'bg-gray-700'}`} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Talkover (Ducking)</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Cartucheira de Vinhetas */}
          <section className="bg-white/5 rounded-[40px] border border-white/10 p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-sm font-black uppercase tracking-widest text-gray-500">Cartucheira de Vinhetas</h2>
                    <p className="text-[10px] text-gray-600 font-bold uppercase">Toque instantâneo de áudios</p>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                      onClick={() => setIsManageModalOpen(true)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white/5 text-gray-400 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                    >
                      <Wand2 className="size-3" />
                      IA
                    </button>
                    <button 
                      onClick={() => {
                        setEditingVignette(null);
                        setVignetteForm({ name: '', url: '', file: null, bucket: 'vinhetas', mode: 'file' });
                        setIsVignetteFormOpen(true);
                      }}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all hover:scale-105 active:scale-95"
                    >
                      <Plus className="size-3" />
                      Novo
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                  {vignettes.map((v) => (
                    <div key={v.id} className="group relative hover:scale-[1.05] transition-all duration-300">
                      <div className="flex flex-col gap-1">
                        <div className="relative">
                          <button
                            onClick={() => playVignette(v.url, 'deck1')}
                            className="w-full h-16 bg-black/40 border border-white/5 rounded-t-2xl p-3 flex flex-col justify-between hover:bg-primary/20 hover:border-primary/30 transition-all text-left overflow-hidden active:scale-95"
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="text-[8px] font-black uppercase tracking-widest text-gray-400 group-hover:text-primary truncate pr-4">{v.name}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <Play className="size-3 text-primary fill-current opacity-50 group-hover:opacity-100" />
                              <span className="text-[7px] font-black text-gray-600 uppercase">Deck 1</span>
                            </div>
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteVignette(v);
                            }}
                            className="absolute top-2 right-2 p-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100 z-10"
                          >
                            <Trash2 className="size-3 text-red-500/50 hover:text-red-500" />
                          </button>
                        </div>
                        <button
                          onClick={() => playVignette(v.url, 'deck2')}
                          className="w-full h-16 bg-black/40 border border-white/5 rounded-b-2xl p-3 flex flex-col justify-between hover:bg-primary/20 hover:border-primary/30 transition-all text-left overflow-hidden active:scale-95"
                        >
                          <div className="flex items-center justify-between">
                            <Play className="size-3 text-primary fill-current opacity-50 group-hover:opacity-100" />
                            <span className="text-[7px] font-black text-gray-600 uppercase">Deck 2</span>
                          </div>
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {vignettes.length === 0 && !studioLoading && (
                    <div className="col-span-full py-12 text-center border-2 border-dashed border-white/5 rounded-[32px]">
                      <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Nenhuma vinheta encontrada no bucket /vinhetas</p>
                    </div>
                  )}
                  {studioLoading && (
                    <div className="col-span-full py-12 flex justify-center">
                      <Loader2 className="size-6 text-primary animate-spin" />
                    </div>
                  )}
                </div>
              </section>

              {/* Trilhas (Background Music) */}
              <section className="bg-white/5 rounded-[40px] border border-white/10 p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-sm font-black uppercase tracking-widest text-gray-500">Trilhas de Fundo</h2>
                    <p className="text-[10px] text-gray-600 font-bold uppercase">Músicas instrumentais em loop</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => {
                        setEditingVignette(null);
                        setVignetteForm({ name: '', url: '', file: null, bucket: 'trilhas', mode: 'file' });
                        setIsVignetteFormOpen(true);
                      }}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all hover:scale-105 active:scale-95"
                    >
                      <Plus className="size-3" />
                      Novo
                    </button>
                    <div className="flex items-center gap-2">
                      <Volume2 className="size-4 text-gray-500" />
                      <input 
                        type="range" min="0" max="1" step="0.01" value={trackVolume}
                        onChange={(e) => setTrackVolume(parseFloat(e.target.value))}
                        className="w-32 h-1 bg-white/10 rounded-full appearance-none accent-primary"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {tracks.map((track) => (
                    <div key={track.id} className="group relative">
                      <button
                        onClick={() => toggleTrack(track)}
                        className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all hover:scale-[1.02] active:scale-98 ${
                          activeTrack === track.id 
                            ? 'bg-primary/20 border-primary text-primary shadow-lg shadow-primary/10' 
                            : 'bg-black/40 border-white/5 text-gray-400 hover:border-white/20 hover:bg-black/60'
                        }`}
                      >
                        <div className={`size-10 rounded-xl flex items-center justify-center transition-colors ${activeTrack === track.id ? 'bg-primary/20' : 'bg-white/5 group-hover:bg-white/10'}`}>
                          {activeTrack === track.id ? <Loader2 className="size-5 animate-spin" /> : <Music2 className="size-5" />}
                        </div>
                        <div className="flex-1 text-left overflow-hidden">
                          <p className="text-[10px] font-black uppercase tracking-widest truncate">{track.name}</p>
                          <p className="text-[8px] font-bold uppercase opacity-50">{activeTrack === track.id ? 'Reproduzindo (Loop)' : 'Pronto'}</p>
                        </div>
                        {activeTrack === track.id && (
                          <div className="flex gap-0.5">
                            {[...Array(3)].map((_, i) => (
                              <div key={i} className="w-0.5 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
                            ))}
                          </div>
                        )}
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteVignette(track);
                        }}
                        className="absolute -top-2 -right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all hover:scale-110 shadow-lg z-10"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ))}
                  {tracks.length === 0 && !studioLoading && (
                    <div className="col-span-full py-8 text-center border-2 border-dashed border-white/5 rounded-[32px]">
                      <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Nenhuma trilha encontrada no bucket /trilhas</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Comercial Queue Section */}
            <section className="bg-white/5 rounded-[40px] border border-white/10 p-6 sm:p-8 flex flex-col h-full">
                <div className="flex flex-col gap-1 mb-8">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-black uppercase tracking-widest text-gray-500">Fila de Comerciais</h2>
                    <button 
                      onClick={() => {
                        setEditingVignette(null);
                        setVignetteForm({ name: '', url: '', file: null, bucket: 'comerciais', mode: 'file' });
                        setIsVignetteFormOpen(true);
                      }}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all hover:scale-105 active:scale-95"
                    >
                      <Plus className="size-3" />
                      Novo
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-600 font-bold uppercase">Programação de spots</p>
                </div>

              <div className="flex-1 flex flex-col gap-6 overflow-hidden">
                {/* Available Commercials */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Disponíveis</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {commercials.map((c) => (
                      <div key={c.id} className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/5 group">
                        <span className="text-[10px] font-bold text-gray-300 truncate flex-1">{c.name}</span>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button 
                            onClick={() => handleDeleteVignette(c)}
                            className="p-2 bg-red-500/10 rounded-lg text-red-500 hover:bg-red-500/20 transition-all"
                          >
                            <Trash2 className="size-3" />
                          </button>
                          <button 
                            onClick={() => addToQueue(c)}
                            className="p-2 bg-white/5 rounded-lg text-primary hover:bg-primary/20 transition-all"
                          >
                            <Plus className="size-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Current Queue */}
                <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Fila Atual</h3>
                    <button 
                      onClick={clearQueue}
                      disabled={queue.length === 0}
                      className="text-[8px] font-black uppercase tracking-widest text-red-500 hover:text-red-400 disabled:opacity-30 transition-colors"
                    >
                      Limpar Fila
                    </button>
                    <span className="text-[8px] font-black px-2 py-0.5 bg-primary/20 text-primary rounded-full">{queue.length}</span>
                  </div>
                  
                  <div className="flex-1 space-y-2 overflow-y-auto pr-2 custom-scrollbar">
                    {queue.map((item, index) => (
                      <div key={`${item.id}-${index}`} className="flex items-center gap-3 p-3 bg-primary/5 rounded-xl border border-primary/10">
                        <span className="text-[8px] font-black text-primary/50">{index + 1}</span>
                        <span className="text-[10px] font-bold text-white truncate flex-1">{item.name}</span>
                        <button onClick={() => removeFromQueue(item.id)} className="text-gray-500 hover:text-red-400">
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                    {queue.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-white/5 rounded-3xl">
                        <Loader2 className="size-8 text-gray-800 mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-600">Fila vazia</p>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={playNextInQueue}
                    disabled={queue.length === 0 || isVignettePlaying}
                    className="w-full py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20 hover:bg-primary/80 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                  >
                    {isVignettePlaying ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                    Disparar Próximo
                  </button>
                </div>
              </div>
            </section>
          </div>

          {/* Right Sidebar - Tabs & Chat */}
        <aside className="hidden xl:flex flex-col gap-6 h-[calc(100vh-160px)]">
          <div className="bg-white/5 rounded-[40px] border border-white/10 p-2 flex gap-1">
            {[
              { id: 'chat', icon: <Users className="size-3" />, label: 'Chat' },
              { id: 'listeners', icon: <Activity className="size-3" />, label: 'Ouvintes' },
              { id: 'history', icon: <RefreshCw className="size-3" />, label: 'Histórico' },
              { id: 'diagnostics', icon: <Settings className="size-3" />, label: 'Sistema' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === tab.id 
                    ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                    : 'text-gray-500 hover:bg-white/5'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 bg-white/5 rounded-[40px] border border-white/10 overflow-hidden flex flex-col">
            {activeTab === 'chat' && (
              <div className="flex-1 flex flex-col p-4">
                <Chat isAdmin={true} initialUserName="Estúdio GFC" />
              </div>
            )}

            {activeTab === 'listeners' && (
              <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                <h2 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-6">Monitor de Transmissão</h2>
                <div className="space-y-3">
                  {Object.entries(peerStats).length === 0 ? (
                    <p className="text-[10px] text-gray-600 font-bold uppercase text-center py-12">Sem conexões ativas</p>
                  ) : (
                    Object.entries(peerStats).map(([id, stats]) => (
                      <div key={id} className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/5">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-mono text-gray-400">ID: {id.slice(0, 8)}</span>
                          <span className={`text-[8px] font-black uppercase ${
                            stats.status === 'connected' ? 'text-emerald-500' : 'text-amber-500'
                          }`}>{stats.status}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-mono text-primary font-bold">{stats.latency}ms</span>
                          <p className="text-[8px] text-gray-600 font-black uppercase">Latência</p>
                        </div>
                      </div>
                    ))
                  )}
                  
                  <button 
                    onClick={forceReconnect}
                    className="w-full mt-4 py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="size-3" />
                    Forçar Reconexão Geral
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                <h2 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-6">Histórico de Sessão</h2>
                <div className="space-y-4">
                  {sessionHistory.length === 0 ? (
                    <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest text-center py-12">
                      Nenhuma atividade registrada.
                    </div>
                  ) : (
                    sessionHistory.map(item => (
                      <div key={item.id} className="flex flex-col gap-1 p-3 bg-white/5 rounded-2xl border border-white/5">
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] font-mono text-gray-500">{item.time}</span>
                          <div className={`size-1.5 rounded-full ${
                            item.type === 'success' ? 'bg-emerald-500' :
                            item.type === 'error' ? 'bg-red-500' :
                            item.type === 'warning' ? 'bg-amber-500' : 'bg-primary'
                          }`} />
                        </div>
                        <p className="text-[10px] font-bold text-gray-300 uppercase leading-tight">{item.event}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'diagnostics' && (
              <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-8">
                <div className="bg-black/40 rounded-3xl p-6 border border-white/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40">Diagnósticos</h3>
                    <div className="flex items-center gap-2">
                      <div className={`size-1.5 rounded-full ${serverStatus === 'online' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <span className="text-[8px] font-bold uppercase text-white/60">Servidor: {serverStatus}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                      <p className="text-[8px] font-bold text-white/40 uppercase mb-1">Latência</p>
                      <p className="text-sm font-black text-primary">{serverLatency ? `${serverLatency}ms` : '--'}</p>
                    </div>
                    <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                      <p className="text-[8px] font-bold text-white/40 uppercase mb-1">Database</p>
                      <p className={`text-sm font-black ${supabaseStatus === 'connected' ? 'text-emerald-500' : 'text-red-500'}`}>
                        {supabaseStatus === 'connected' ? 'OK' : 'ERRO'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-primary/10 rounded-3xl border border-primary/20 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Mic className="size-4 text-primary" />
                    <h2 className="text-[10px] font-black uppercase tracking-widest text-primary">Dicas</h2>
                  </div>
                  <ul className="space-y-3">
                    {[
                      "Mantenha o fader de voz entre 80% e 100%.",
                      "Use as vinhetas para pontuar transições.",
                      "O sistema reduz o volume da música ao falar.",
                      "Monitore o VU meter para evitar distorção."
                    ].map((tip, i) => (
                      <li key={i} className="flex gap-3 text-[10px] text-gray-400 leading-relaxed uppercase font-bold">
                        <div className="size-1 bg-primary rounded-full mt-1.5 shrink-0" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </aside>
      </main>

      {/* AI Vignette Modal */}
      <AnimatePresence>
        {isManageModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setIsManageModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-[32px] p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <Wand2 className="size-6 text-primary" />
                  <h3 className="text-xl font-black uppercase tracking-tighter">Gerar Vinheta com IA</h3>
                </div>
                <button onClick={() => setIsManageModalOpen(false)} className="p-2 text-gray-500 hover:text-white">
                  <X className="size-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">O que a IA deve dizer?</label>
                  <textarea 
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-primary/50 transition-colors min-h-[100px] resize-none"
                    placeholder="Ex: Diga com voz de rádio: George Fctech, a melhor rádio!"
                  />
                </div>
                
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl">
                  <p className="text-[10px] text-primary font-bold leading-relaxed">
                    Nota: Se você estiver usando o Vercel, certifique-se de configurar a variável <code className="bg-primary/10 px-1 rounded">GEMINI_API_KEY</code> nas configurações do seu projeto para que a geração funcione.
                  </p>
                </div>
                
                <button 
                  onClick={handleGenerateAiVignette}
                  disabled={isGeneratingVignette}
                  className="w-full bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  {isGeneratingVignette ? (
                    <>
                      <Loader2 className="size-5 animate-spin" />
                      Gerando Áudio...
                    </>
                  ) : (
                    <>
                      <Play className="size-4 fill-current" />
                      Gerar e Salvar
                    </>
                  )}
                </button>
                
                <p className="text-[10px] text-gray-500 text-center font-bold uppercase tracking-widest">
                  O áudio será gerado e adicionado automaticamente à sua lista.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Vignette Form Modal */}
      <AnimatePresence>
        {isVignetteFormOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setIsVignetteFormOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-[32px] p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black uppercase tracking-tighter">
                  {editingVignette ? 'Editar Vinheta' : 'Nova Vinheta'}
                </h3>
                <button onClick={() => setIsVignetteFormOpen(false)} className="p-2 text-gray-500 hover:text-white">
                  <X className="size-6" />
                </button>
              </div>

                <form onSubmit={handleSaveVignette} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Tipo de Áudio</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['vinhetas', 'trilhas', 'comerciais'] as const).map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setVignetteForm({ ...vignetteForm, bucket: b })}
                          className={`py-2 rounded-xl text-[8px] font-black uppercase tracking-widest border transition-all ${
                            vignetteForm.bucket === b 
                              ? 'bg-primary/20 border-primary text-primary' 
                              : 'bg-white/5 border-white/10 text-gray-500 hover:bg-white/10'
                          }`}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Origem do Áudio</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setVignetteForm({ ...vignetteForm, mode: 'file' })}
                        className={`py-2 rounded-xl text-[8px] font-black uppercase tracking-widest border transition-all ${
                          vignetteForm.mode === 'file' 
                            ? 'bg-primary/20 border-primary text-primary' 
                            : 'bg-white/5 border-white/10 text-gray-500 hover:bg-white/10'
                        }`}
                      >
                        Arquivo Local
                      </button>
                      <button
                        type="button"
                        onClick={() => setVignetteForm({ ...vignetteForm, mode: 'url' })}
                        className={`py-2 rounded-xl text-[8px] font-black uppercase tracking-widest border transition-all ${
                          vignetteForm.mode === 'url' 
                            ? 'bg-primary/20 border-primary text-primary' 
                            : 'bg-white/5 border-white/10 text-gray-500 hover:bg-white/10'
                        }`}
                      >
                        URL Externa
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Nome do Arquivo</label>
                    <input 
                      type="text" 
                      required
                      value={vignetteForm.name}
                      onChange={(e) => setVignetteForm({ ...vignetteForm, name: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-primary/50 transition-colors"
                      placeholder="Ex: Vinheta Abertura"
                    />
                  </div>

                  {vignetteForm.mode === 'file' ? (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Arquivo de Áudio (MP3/WAV)</label>
                      <div className="relative group">
                        <input 
                          type="file" 
                          accept="audio/*"
                          onChange={(e) => setVignetteForm({ ...vignetteForm, file: e.target.files?.[0] || null })}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm flex items-center justify-between group-hover:border-primary/30 transition-colors">
                          <span className="text-gray-500 truncate">
                            {vignetteForm.file ? vignetteForm.file.name : 'Clique para selecionar arquivo'}
                          </span>
                          <Plus className="size-4 text-gray-500" />
                        </div>
                      </div>
                      <p className="text-[8px] text-gray-600 font-bold uppercase mt-1">
                        Certifique-se de que o bucket <span className="text-primary">{vignetteForm.bucket}</span> existe no seu Supabase Storage.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">URL do Áudio</label>
                      <input 
                        type="url" 
                        required
                        value={vignetteForm.url}
                        onChange={(e) => setVignetteForm({ ...vignetteForm, url: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-primary/50 transition-colors"
                        placeholder="https://exemplo.com/audio.mp3"
                      />
                    </div>
                  )}
                  <button 
                    type="submit"
                    disabled={isGeneratingVignette}
                    className="w-full bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                  >
                    {isGeneratingVignette ? <Loader2 className="size-5 animate-spin mx-auto" /> : 'Salvar Vinheta'}
                  </button>
                </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Delete Modal */}
      <AnimatePresence>
        {isConfirmDeleteOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setIsConfirmDeleteOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-[32px] p-8 shadow-2xl"
            >
              <h3 className="text-xl font-black uppercase tracking-tighter mb-4">Excluir Vinheta?</h3>
              <p className="text-gray-400 text-sm mb-8">Esta ação não pode ser desfeita.</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setIsConfirmDeleteOpen(false)}
                  className="flex-1 py-4 bg-white/5 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDeleteVignette}
                  className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .vertical-range {
          appearance: none;
          transform: rotate(-90deg);
          width: 160px !important;
          height: 8px !important;
          margin-top: 80px;
        }
      `}</style>

      {/* Status Bar */}
      <footer className="h-10 bg-black/80 border-t border-white/5 px-6 flex items-center justify-between text-[8px] font-black uppercase tracking-[0.2em] text-gray-500">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className={`size-1.5 rounded-full ${isInitialized ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
            <span>Motor de Áudio: {isInitialized ? 'Operacional' : 'Inativo'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="size-3 text-primary" />
            <span>Latência: 12ms</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="size-3 text-gray-400" />
            <span>Ouvintes: {listeners}</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className={`size-1.5 rounded-full ${isMicActive ? 'bg-red-500 animate-pulse' : 'bg-gray-700'}`} />
            <span>Microfone: {isMicActive ? 'No Ar' : 'Mudo'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`size-1.5 rounded-full ${activeTrack ? 'bg-primary animate-pulse' : 'bg-gray-700'}`} />
            <span>Trilha: {activeTrack ? 'Ativa' : 'Parada'}</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
