import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Radio, Play, Square, Volume2, Users, Settings, X, Activity, Plus, Trash2, Edit2, LogOut, Wand2, Loader2 } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useNavigate, Link } from 'react-router-dom';
import { useAudioMixer } from '../hooks/useAudioMixer';
import { VUMeter } from '../components/VUMeter';
import { vignetteService, type Vignette } from '../services/vignetteService';
import { usePlayer } from '../context/PlayerContext';
import { supabase } from '../lib/supabase';
import { GoogleGenAI, Modality } from "@google/genai";

export const LiveStudio: React.FC = () => {
  const navigate = useNavigate();
  const { setIsDucked } = usePlayer();
  const {
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
  } = useAudioMixer();

  const [isOnAir, setIsOnAir] = useState(false);
  const [listeners, setListeners] = useState(0);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [vignettes, setVignettes] = useState<Vignette[]>([]);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isVignetteFormOpen, setIsVignetteFormOpen] = useState(false);
  const [editingVignette, setEditingVignette] = useState<Vignette | null>(null);
  const [vignetteForm, setVignetteForm] = useState({ name: '', url: '' });
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isGeneratingVignette, setIsGeneratingVignette] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('Diga com voz empolgada: Rádio George F C Tech, a sua rádio na web!');

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
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('listeners:count', (count: number) => setListeners(count));
    
    // WebRTC Signaling for listeners
    newSocket.on('webrtc:request-stream', async ({ listenerId }) => {
      if (!isOnAir) return;
      
      const stream = getMixedStream();
      if (!stream) return;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      peerConnections.current[listenerId] = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          newSocket.emit('webrtc:ice-candidate', {
            targetId: listenerId,
            candidate: event.candidate
          });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      newSocket.emit('webrtc:offer', {
        targetId: listenerId,
        offer
      });
    });

    newSocket.on('webrtc:answer', async ({ fromId, answer }) => {
      const pc = peerConnections.current[fromId];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    newSocket.on('webrtc:ice-candidate', async ({ fromId, candidate }) => {
      const pc = peerConnections.current[fromId];
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    return () => {
      newSocket.close();
      Object.values(peerConnections.current).forEach(pc => pc.close());
    };
  }, [isOnAir, getMixedStream]);

  const handleToggleOnAir = async () => {
    if (!isOnAir) {
      await initialize();
      socket?.emit('live:start');
      setIsOnAir(true);
    } else {
      socket?.emit('live:stop');
      setIsOnAir(false);
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
    if (confirm('Deseja excluir esta vinheta?')) {
      const success = await vignetteService.delete(id);
      if (success) {
        setVignettes(vignettes.filter(v => v.id !== id));
      }
    }
  };

  const handleGenerateAiVignette = async () => {
    if (!aiPrompt.trim()) return;
    setIsGeneratingVignette(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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
        const audioUrl = `data:audio/mp3;base64,${base64Audio}`;
        const name = aiPrompt.length > 20 ? aiPrompt.substring(0, 20) + '...' : aiPrompt;
        const created = await vignetteService.create({ name: `IA: ${name}`, url: audioUrl });
        if (created) {
          setVignettes([...vignettes, created]);
        }
      }
    } catch (err) {
      console.error("Erro ao gerar vinheta com IA:", err);
      alert("Falha ao gerar áudio com IA. Verifique sua conexão.");
    } finally {
      setIsGeneratingVignette(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 sm:p-8 font-sans">
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
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Microfone</span>
                    <button 
                      onClick={toggleMic}
                      className={`size-10 rounded-xl flex items-center justify-center transition-all ${
                        isMicActive ? 'bg-primary text-white' : 'bg-white/5 text-gray-500'
                      }`}
                    >
                      {isMicActive ? <Mic className="size-5" /> : <MicOff className="size-5" />}
                    </button>
                  </div>
                  <div className="h-64 bg-black/40 rounded-2xl p-4 flex flex-col items-center gap-4 border border-white/5">
                    <input 
                      type="range" 
                      min="0" 
                      max="2" 
                      step="0.01"
                      value={micVolume}
                      onChange={(e) => updateMicVolume(parseFloat(e.target.value))}
                      className="h-full appearance-none bg-white/10 w-2 rounded-full cursor-pointer accent-primary vertical-range"
                      style={{ writingMode: 'bt-lr' } as any}
                    />
                    <span className="text-[10px] font-mono text-gray-500">{Math.round(micVolume * 100)}%</span>
                  </div>
                </div>

                {/* Master Channel */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Master Out</span>
                    <div className="size-10 rounded-xl bg-white/5 flex items-center justify-center text-primary">
                      <Volume2 className="size-5" />
                    </div>
                  </div>
                  <div className="h-64 bg-black/40 rounded-2xl p-4 flex flex-col items-center gap-4 border border-white/5">
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
                    onClick={() => playVignette(v.url)}
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
                <span className="text-xs font-mono text-emerald-500">~24ms</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-black/40 rounded-2xl border border-white/5">
                <span className="text-[10px] font-bold text-gray-400">BITRATE</span>
                <span className="text-xs font-mono text-emerald-500">128kbps</span>
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
