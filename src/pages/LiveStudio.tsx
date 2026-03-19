import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Radio, Play, Square, Volume2, Users, Settings, X, Activity, Plus, Trash2, Edit2, LogOut, Wand2, Loader2, Music2, Zap, RefreshCw } from 'lucide-react';
import { socket } from '../lib/socket';
import { useNavigate, Link } from 'react-router-dom';
import { useAudioMixer } from '../hooks/useAudioMixer';
import { VUMeter } from '../components/VUMeter';
import { AudioVisualizer } from '../components/AudioVisualizer';
import { Chat } from '../components/Chat';
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
    toggleMonitoring,
    isMonitoring,
    isInitialized,
    isVignettePlaying,
    crossfader,
    setCrossfader,
    isDucking,
    setIsDucking
  } = useAudioMixer();

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
  const [aiPrompt, setAiPrompt] = useState('Diga com voz empolgada: RÁDIO GFC, a sua rádio na web!');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [supabaseStatus, setSupabaseStatus] = useState<'connected' | 'error' | 'checking'>('checking');
  const [serverStatus, setServerStatus] = useState<'online' | 'offline' | 'connecting'>('connecting');
  const [serverLatency, setServerLatency] = useState<number | null>(null);
  const [sessionHistory, setSessionHistory] = useState<{ id: string, time: string, event: string, type: 'info' | 'success' | 'warning' | 'error' }[]>([]);
  const [peerStats, setPeerStats] = useState<Record<string, { latency: number, status: string }>>({});

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
    const loadVignettes = async () => {
      // First try to list from bucket as requested
      const bucketVignettes = await vignetteService.listFromBucket();
      if (bucketVignettes.length > 0) {
        setVignettes(bucketVignettes);
      } else {
        // Fallback to database/default
        const data = await vignetteService.getAll();
        setVignettes(data);
      }
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

        socket.emit('live:start');
        setIsOnAir(true);
        setStatusMessage({ type: 'success', text: 'Você está no ar! Fale agora.' });
        setTimeout(() => setStatusMessage(null), 3000);
      } catch (err) {
        console.error("[Studio] Erro ao iniciar transmissão:", err);
        setStatusMessage({ type: 'error', text: 'Erro ao acessar microfone. Verifique as permissões.' });
      }
    } else {
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

          <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/10">
            <Users className="size-4 text-primary" />
            <span className="text-xs font-black">{listeners} OUVINTES</span>
          </div>

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
            onClick={handleToggleOnAir}
            className={`px-6 sm:px-8 py-3 rounded-2xl font-black uppercase tracking-widest transition-all flex items-center gap-3 w-full sm:w-auto justify-center ${
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

      <main className="grid xl:grid-cols-[1fr_350px] gap-8">
        <div className="space-y-8">
          {/* Broadcast Control (Cast) - Integrated at the top */}
          <section className="bg-white/5 rounded-[40px] border border-white/10 p-6 sm:p-8">
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
                  <div className="flex flex-col gap-6 bg-black/20 p-4 sm:p-6 rounded-[32px] border border-white/5 hover:border-white/10 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black uppercase tracking-widest text-primary">CH 01</span>
                        <span className="text-[12px] font-black uppercase text-white">Voz / Mic</span>
                      </div>
                      <button 
                        onClick={toggleMic}
                        className={`size-12 rounded-2xl flex items-center justify-center transition-all shadow-xl ${
                          isMicActive 
                            ? 'bg-red-500 text-white animate-pulse shadow-red-500/20' 
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
                  <div className="flex flex-col gap-6 bg-black/20 p-4 sm:p-6 rounded-[32px] border border-white/5 hover:border-white/10 transition-colors">
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
                  <div className="flex flex-col gap-6 bg-black/20 p-4 sm:p-6 rounded-[32px] border border-white/5 hover:border-white/10 transition-colors">
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
                  <div className="flex flex-col gap-6 bg-primary/5 p-4 sm:p-6 rounded-[32px] border border-primary/10 hover:border-primary/20 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black uppercase tracking-widest text-primary">MASTER</span>
                        <span className="text-[12px] font-black uppercase text-white">Saída Geral</span>
                      </div>
                      <div className={`size-12 rounded-2xl flex items-center justify-center bg-white/5 ${isOnAir ? 'text-red-500' : 'text-gray-500'}`}>
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
                    className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${
                      isDucking 
                        ? 'bg-primary/20 border-primary text-primary' 
                        : 'bg-white/5 border-white/10 text-gray-500'
                    }`}
                  >
                    <div className={`size-1.5 rounded-full ${isDucking ? 'bg-primary' : 'bg-gray-700'}`} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Talkover (Ducking)</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Quick Play & AI Tools Section */}
          <div className="grid md:grid-cols-[1fr_350px] gap-8">
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
                      setVignetteForm({ name: '', url: '' });
                      setIsVignetteFormOpen(true);
                    }}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all"
                  >
                    <Plus className="size-3" />
                    Novo
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                {vignettes.map((v) => (
                  <div key={v.id} className="group relative">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={async () => {
                          try {
                            await playVignette(v.url, 'deck1');
                          } catch (err: any) {
                            setStatusMessage({ type: 'error', text: 'Erro ao tocar vinheta: ' + (err.message || 'Falha no áudio') });
                            setTimeout(() => setStatusMessage(null), 3000);
                          }
                        }}
                        className="w-full h-16 bg-black/40 border border-white/5 rounded-t-2xl p-3 flex flex-col justify-between hover:bg-primary/10 hover:border-primary/30 transition-all text-left overflow-hidden group-active:scale-95"
                      >
                        <span className="text-[8px] font-black uppercase tracking-widest text-gray-400 group-hover:text-primary truncate pr-4">{v.name}</span>
                        <div className="flex items-center justify-between">
                          <Play className="size-3 text-primary fill-current opacity-50 group-hover:opacity-100" />
                          <span className="text-[7px] font-black text-gray-600 uppercase">Deck 1</span>
                        </div>
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await playVignette(v.url, 'deck2');
                          } catch (err: any) {
                            setStatusMessage({ type: 'error', text: 'Erro ao tocar vinheta: ' + (err.message || 'Falha no áudio') });
                            setTimeout(() => setStatusMessage(null), 3000);
                          }
                        }}
                        className="w-full h-16 bg-black/40 border border-white/5 rounded-b-2xl p-3 flex flex-col justify-between hover:bg-primary/10 hover:border-primary/30 transition-all text-left overflow-hidden group-active:scale-95"
                      >
                        <div className="flex items-center justify-between">
                          <Play className="size-3 text-primary fill-current opacity-50 group-hover:opacity-100" />
                          <span className="text-[7px] font-black text-gray-600 uppercase">Deck 2</span>
                        </div>
                      </button>
                    </div>
                    
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingVignette(v);
                          setVignetteForm({ name: v.name, url: v.url });
                          setIsVignetteFormOpen(true);
                        }}
                        className="p-1.5 bg-black/80 rounded-lg text-gray-400 hover:text-white"
                      >
                        <Edit2 className="size-3" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteVignette(v.id);
                        }}
                        className="p-1.5 bg-black/80 rounded-lg text-red-400 hover:text-red-300"
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
