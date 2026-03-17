import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Radio, Play, Square, Volume2, Users, Settings, X, Activity, Plus, Trash2, Edit2, LogOut, Wand2, Loader2, Music2, Zap } from 'lucide-react';
import { socket } from '../lib/socket';
import { useNavigate, Link } from 'react-router-dom';
import { useAudioMixer } from '../hooks/useAudioMixer';
import { VUMeter } from '../components/VUMeter';
import { vignetteService, type Vignette } from '../services/vignetteService';
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
    isInitialized,
    isVignettePlaying
  } = useAudioMixer();

  const [isOnAir, setIsOnAir] = useState(false);
  const [socketStatus, setSocketStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [listeners, setListeners] = useState(0);
  const [latency, setLatency] = useState<number | null>(null);
  const [vignettes, setVignettes] = useState<Vignette[]>([]);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isVignetteFormOpen, setIsVignetteFormOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [vignetteToDelete, setVignetteToDelete] = useState<string | null>(null);
  const [editingVignette, setEditingVignette] = useState<Vignette | null>(null);
  const [vignetteForm, setVignetteForm] = useState({ name: '', url: '' });
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isGeneratingVignette, setIsGeneratingVignette] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('Diga com voz empolgada: Rádio George F C Tech, a sua rádio na web!');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

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

  // Load Vignettes
  useEffect(() => {
    const loadVignettes = async () => {
      const data = await vignetteService.getAll();
      setVignettes(data);
    };
    loadVignettes();
  }, []);

  // Socket and WebRTC Setup
  useEffect(() => {
    socket.on('listeners:count', (count: number) => setListeners(count));
    
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
      
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      peerConnections.current[listenerId] = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

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
      const connections = Object.values(peerConnections.current);
      if (connections.length === 0) {
        setLatency(null);
        return;
      }

      try {
        let totalRtt = 0;
        let count = 0;
        
        for (const pc of connections) {
          const stats = await pc.getStats();
          stats.forEach(report => {
            if (report.type === 'remote-candidate' && report.roundTripTime) {
              totalRtt += report.roundTripTime;
              count++;
            } else if (report.type === 'candidate-pair' && report.currentRoundTripTime) {
              totalRtt += report.currentRoundTripTime;
              count++;
            }
          });
        }

        if (count > 0) {
          setLatency(Math.round((totalRtt / count) * 1000));
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

  const handleToggleOnAir = async () => {
    if (!isOnAir) {
      try {
        await initialize();
        
        // Automatically activate mic if not active
        if (!isMicActive) {
          await toggleMic();
        }
        
        socket.emit('live:start');
        setIsOnAir(true);
        setStatusMessage({ type: 'success', text: 'Você está no ar! Fale agora.' });
        setTimeout(() => setStatusMessage(null), 3000);
      } catch (err) {
        console.error("[Studio] Erro ao iniciar transmissão:", err);
        setStatusMessage({ type: 'error', text: 'Erro ao acessar microfone. Verifique as permissões.' });
      }
    } else {
      socket.emit('live:stop');
      setIsOnAir(false);
      
      // Stop mic when stopping broadcast (optional, but cleaner)
      if (isMicActive) {
        await toggleMic();
      }
      
      Object.values(peerConnections.current).forEach(pc => pc.close());
      peerConnections.current = {};
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary"></div>
      </div>
    );
  }

  const handleSaveVignette = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingVignette) {
      const updated = await vignetteService.update(editingVignette.id, vignetteForm);
      if (updated) {
        setVignettes(vignettes.map(v => v.id === updated.id ? updated : v));
      }
    } else {
      const created = await vignetteService.create(vignetteForm);
      if (created) {
        setVignettes([...vignettes, created]);
      }
    }
    setIsVignetteFormOpen(false);
    setEditingVignette(null);
    setVignetteForm({ name: '', url: '' });
  };

  const handleDeleteVignette = async (id: string) => {
    setVignetteToDelete(id);
    setIsConfirmDeleteOpen(true);
  };

  const confirmDeleteVignette = async () => {
    if (!vignetteToDelete) return;
    const success = await vignetteService.delete(vignetteToDelete);
    if (success) {
      setVignettes(vignettes.filter(v => v.id !== vignetteToDelete));
      setStatusMessage({ type: 'success', text: 'Vinheta excluída!' });
    } else {
      setStatusMessage({ type: 'error', text: 'Erro ao excluir vinheta.' });
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
      // Try both Vite and process.env for compatibility
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : null);
      
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY não encontrada. Se você estiver no Vercel, adicione-a nas variáveis de ambiente.");
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

      console.log("[Studio] Resposta da IA recebida:", response);

      if (!response.candidates || response.candidates.length === 0) {
        throw new Error("A IA não retornou nenhum candidato de resposta.");
      }

      const base64Audio = response.candidates[0].content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        console.log("[Studio] Áudio recebido da IA, processando...");
        // Gemini TTS returns raw PCM 16-bit LE at 24kHz. 
        // We need to add a WAV header so decodeAudioData can handle it.
        const binaryString = atob(base64Audio);
        const pcmData = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          pcmData[i] = binaryString.charCodeAt(i);
        }
        
        const wavHeader = new ArrayBuffer(44);
        const view = new DataView(wavHeader);
        
        // RIFF chunk
        view.setUint32(0, 0x52494646, false); // "RIFF"
        view.setUint32(4, 36 + pcmData.length, true); // File size
        view.setUint32(8, 0x57415645, false); // "WAVE"
        
        // fmt chunk
        view.setUint32(12, 0x666d7420, false); // "fmt "
        view.setUint32(16, 16, true); // Chunk size
        view.setUint16(20, 1, true); // Audio format (PCM)
        view.setUint16(22, 1, true); // Num channels (Mono)
        view.setUint32(24, 24000, true); // Sample rate
        view.setUint32(28, 24000 * 2, true); // Byte rate
        view.setUint16(32, 2, true); // Block align
        view.setUint16(34, 16, true); // Bits per sample
        
        // data chunk
        view.setUint32(36, 0x64617461, false); // "data"
        view.setUint32(40, pcmData.length, true); // Data size
        
        const wavData = new Uint8Array(44 + pcmData.length);
        wavData.set(new Uint8Array(wavHeader), 0);
        wavData.set(pcmData, 44);
        
        // Convert back to base64 efficiently
        let binary = '';
        const chunk_size = 8192;
        for (let i = 0; i < wavData.length; i += chunk_size) {
          binary += String.fromCharCode.apply(null, Array.from(wavData.slice(i, i + chunk_size)));
        }
        const base64Wav = btoa(binary);
        
        const audioUrl = `data:audio/wav;base64,${base64Wav}`;
        const name = aiPrompt.length > 20 ? aiPrompt.substring(0, 20) + '...' : aiPrompt;
        
        console.log("[Studio] Vinheta processada (WAV), tamanho:", wavData.length, "bytes");
        console.log("[Studio] Tentando salvar vinheta no Supabase...");
        const created = await vignetteService.create({ name: `IA: ${name}`, url: audioUrl });
        
        if (created) {
          setVignettes(prev => [...prev, created]);
          console.log("[Studio] Vinheta salva com sucesso!");
        } else {
          console.warn("[Studio] Falha ao salvar no banco, adicionando localmente para uso imediato.");
          const localVignette: Vignette = {
            id: `local-${Date.now()}`,
            name: `IA: ${name} (Não salva)`,
            url: audioUrl
          };
          setVignettes(prev => [...prev, localVignette]);
        }
        setIsManageModalOpen(false);
      } else {
        throw new Error("Nenhum dado de áudio retornado pela IA.");
      }
    } catch (err: any) {
      console.error("[Studio] Erro ao gerar vinheta com IA:", err);
      alert(`Erro: ${err.message || "Falha ao gerar áudio com IA."}`);
    } finally {
      setIsGeneratingVignette(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 sm:p-8 font-sans">
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

      <header className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')}
            className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors mr-2"
            title="Sair do Estúdio"
          >
            <LogOut className="size-5 text-gray-400" />
          </button>
          <div className="size-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
            <Radio className="size-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase">Estúdio ao Vivo</h1>
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Console de Transmissão Profissional</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
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

          <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/10">
            <Users className="size-4 text-primary" />
            <span className="text-xs font-black">{listeners} OUVINTES</span>
          </div>
          <button 
            onClick={handleToggleOnAir}
            className={`px-8 py-3 rounded-2xl font-black uppercase tracking-widest transition-all flex items-center gap-3 ${
              isOnAir 
                ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/20' 
                : 'bg-white text-black hover:scale-105'
            }`}
          >
            {isOnAir ? <Square className="size-4 fill-current" /> : <Activity className="size-4" />}
            {isOnAir ? 'NO AR' : 'ENTRAR NO AR'}
          </button>
        </div>
      </header>

      <main className="grid lg:grid-cols-[1fr_400px] gap-8">
        <div className="space-y-8">
          {/* Mixer Section */}
          <section className="bg-white/5 rounded-[40px] border border-white/10 p-8">
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-8">Mixer de Áudio</h2>
            
            <div className="flex gap-12">
              <VUMeter analyser={getAnalyser()} />
              
              <div className="flex-1 grid grid-cols-2 gap-12">
                {/* Mic Channel */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Canal 01</span>
                      <span className="text-[12px] font-black uppercase text-white">Microfone</span>
                    </div>
                    <button 
                      onClick={toggleMic}
                      className={`size-12 rounded-2xl flex items-center justify-center transition-all shadow-xl ${
                        isMicActive 
                          ? 'bg-red-500 text-white animate-pulse shadow-red-500/20' 
                          : 'bg-white/5 text-gray-500 hover:bg-white/10'
                      }`}
                      title="Mandar um Alô"
                    >
                      {isMicActive ? <Mic className="size-6" /> : <MicOff className="size-6" />}
                    </button>
                  </div>
                  <div className="h-64 bg-black/40 rounded-2xl p-4 flex flex-col items-center gap-4 border border-white/5 relative">
                    <div className="absolute -left-8 top-1/2 -translate-y-1/2 -rotate-90 text-[8px] font-black uppercase tracking-[0.3em] text-gray-600">
                      Volume Locução
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="2" 
                      step="0.01"
                      value={micVolume}
                      onChange={(e) => updateMicVolume(parseFloat(e.target.value))}
                      className="h-full appearance-none bg-white/10 w-2 rounded-full cursor-pointer accent-primary vertical-range"
                    />
                    <span className="text-[10px] font-mono text-gray-500">{Math.round(micVolume * 100)}%</span>
                  </div>
                </div>

                {/* Master Channel */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Saída</span>
                      <span className="text-[12px] font-black uppercase text-white">Master</span>
                    </div>
                    <div className={`size-12 rounded-2xl flex items-center justify-center bg-white/5 ${isOnAir ? 'text-red-500' : 'text-gray-500'}`}>
                      <Volume2 className="size-6" />
                    </div>
                  </div>
                  <div className="h-64 bg-black/40 rounded-2xl p-4 flex flex-col items-center gap-4 border border-white/5 relative">
                    <div className="absolute -right-8 top-1/2 -translate-y-1/2 rotate-90 text-[8px] font-black uppercase tracking-[0.3em] text-gray-600">
                      Volume Geral
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="1.5" 
                      step="0.01"
                      value={masterVolume}
                      onChange={(e) => updateMasterVolume(parseFloat(e.target.value))}
                      className="h-full appearance-none bg-white/10 w-2 rounded-full cursor-pointer accent-primary vertical-range"
                    />
                    <span className="text-[10px] font-mono text-gray-500">{Math.round(masterVolume * 100)}%</span>
                  </div>
                </div>

                {/* Vignette Channel */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Canal 02</span>
                      <span className="text-[12px] font-black uppercase text-white">Vinhetas</span>
                    </div>
                    <button 
                      onClick={stopAllVignettes}
                      disabled={!isVignettePlaying}
                      className={`size-12 rounded-2xl flex items-center justify-center transition-all ${
                        isVignettePlaying 
                          ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                          : 'bg-white/5 text-gray-500 opacity-50'
                      }`}
                      title="Parar todas as vinhetas"
                    >
                      <Square className="size-5 fill-current" />
                    </button>
                  </div>
                  <div className="h-64 bg-black/40 rounded-2xl p-4 flex flex-col items-center gap-4 border border-white/5 relative">
                    <div className="absolute -right-8 top-1/2 -translate-y-1/2 rotate-90 text-[8px] font-black uppercase tracking-[0.3em] text-gray-600">
                      Volume Vinheta
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="1.5" 
                      step="0.01"
                      value={vignetteVolume}
                      onChange={(e) => updateVignetteVolume(parseFloat(e.target.value))}
                      className="h-full appearance-none bg-white/10 w-2 rounded-full cursor-pointer accent-primary vertical-range"
                    />
                    <span className="text-[10px] font-mono text-gray-500">{Math.round(vignetteVolume * 100)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Vignettes Section */}
          <section className="bg-white/5 rounded-[40px] border border-white/10 p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex flex-col gap-1">
                <h2 className="text-sm font-black uppercase tracking-widest text-gray-500">Quick Play (Vinhetas)</h2>
                <p className="text-[10px] text-gray-600 font-bold uppercase">Gerencie e toque seus áudios</p>
              </div>
              {isVignettePlaying && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-primary text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest animate-pulse flex items-center gap-2"
                >
                  <Music2 className="size-3" />
                  Vinheta no Ar
                </motion.div>
              )}
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsManageModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 text-gray-400 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  <Wand2 className="size-3" />
                  Gerar com IA
                </button>
                <button 
                  onClick={() => {
                    setEditingVignette(null);
                    setVignetteForm({ name: '', url: '' });
                    setIsVignetteFormOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all"
                >
                  <Plus className="size-3" />
                  Adicionar
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {vignettes.map((v) => (
                <div key={v.id} className="group relative">
                  <button
                    onClick={async () => {
                      try {
                        await playVignette(v.url);
                      } catch (err: any) {
                        setStatusMessage({ type: 'error', text: 'Erro ao tocar vinheta: ' + (err.message || 'Falha no áudio') });
                        setTimeout(() => setStatusMessage(null), 3000);
                      }
                    }}
                    className="w-full h-24 bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-between hover:bg-primary/10 hover:border-primary/50 transition-all text-left overflow-hidden"
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 group-hover:text-primary">{v.name}</span>
                    <div className="flex items-center justify-between">
                      <Play className="size-4 text-primary" />
                      <div className="size-1 bg-primary/20 rounded-full" />
                    </div>
                  </button>
                  
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingVignette(v);
                        setVignetteForm({ name: v.name, url: v.url });
                        setIsVignetteFormOpen(true);
                      }}
                      className="p-1.5 bg-black/60 rounded-lg text-gray-400 hover:text-white"
                    >
                      <Edit2 className="size-3" />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteVignette(v.id);
                      }}
                      className="p-1.5 bg-black/60 rounded-lg text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
              ))}
              
              {vignettes.length === 0 && (
                <div className="col-span-full py-12 text-center border-2 border-dashed border-white/5 rounded-[32px]">
                  <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Nenhuma vinheta cadastrada</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Sidebar / Status */}
        <aside className="space-y-8">
          <div className="bg-white/5 rounded-[40px] border border-white/10 p-8">
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-6">Status da Transmissão</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-black/40 rounded-2xl border border-white/5">
                <span className="text-[10px] font-bold text-gray-400">LATÊNCIA</span>
                <span className={`text-xs font-mono ${latency && latency < 100 ? 'text-emerald-500' : latency && latency < 300 ? 'text-yellow-500' : 'text-red-500'}`}>
                  {latency ? `~${latency}ms` : '---'}
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-black/40 rounded-2xl border border-white/5">
                <span className="text-[10px] font-bold text-gray-400">BITRATE</span>
                <span className="text-xs font-mono text-emerald-500">128kbps</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-black/40 rounded-2xl border border-white/5">
                <span className="text-[10px] font-bold text-gray-400">CONEXÕES</span>
                <span className="text-xs font-mono text-primary">{Object.keys(peerConnections.current).length}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-black/40 rounded-2xl border border-white/5">
                <span className="text-[10px] font-bold text-gray-400">FORMATO</span>
                <span className="text-xs font-mono text-gray-300">OPUS / WebRTC</span>
              </div>
            </div>
          </div>

          <div className="bg-primary/10 rounded-[40px] border border-primary/20 p-8">
            <div className="flex items-center gap-3 mb-4">
              <Settings className="size-5 text-primary" />
              <h2 className="text-sm font-black uppercase tracking-widest text-primary">Dicas de Estúdio</h2>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Mantenha o ganho do microfone entre 80% e 100% para melhor clareza. Use as vinhetas para transições suaves entre falas. O áudio da rádio baixa automaticamente quando o microfone é ativado.
              <br /><br />
              <strong className="text-primary">Dica Mobile:</strong> Use fones de ouvido para ouvir sua própria voz (monitoramento) sem causar eco.
            </p>
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
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Nome da Vinheta</label>
                  <input 
                    type="text" 
                    required
                    value={vignetteForm.name}
                    onChange={(e) => setVignetteForm({ ...vignetteForm, name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-primary/50 transition-colors"
                    placeholder="Ex: Vinheta Abertura"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">URL do Áudio (MP3)</label>
                  <input 
                    type="url" 
                    required
                    value={vignetteForm.url}
                    onChange={(e) => setVignetteForm({ ...vignetteForm, url: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-primary/50 transition-colors"
                    placeholder="https://exemplo.com/audio.mp3"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
                >
                  Salvar Vinheta
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
    </div>
  );
};
