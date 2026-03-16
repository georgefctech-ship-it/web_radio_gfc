import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Radio, Play, Square, Volume2, Users, Settings, X, Activity } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useAudioMixer, Vignette } from '../hooks/useAudioMixer';
import { VUMeter } from '../components/VUMeter';

const VIGNETTES: Vignette[] = [
  { id: '1', name: 'Vinheta Abertura', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: '2', name: 'Comercial 30s', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { id: '3', name: 'Efeito Transição', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
];

export const LiveStudio: React.FC = () => {
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
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
  
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

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 sm:p-8 font-sans">
      <header className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-4">
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
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-8">Quick Play (Vinhetas)</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {VIGNETTES.map((v) => (
                <button
                  key={v.id}
                  onClick={() => playVignette(v.url)}
                  className="group relative h-24 bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-between hover:bg-primary/10 hover:border-primary/50 transition-all text-left overflow-hidden"
                >
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 group-hover:text-primary">{v.name}</span>
                  <div className="flex items-center justify-between">
                    <Play className="size-4 text-primary" />
                    <div className="size-1 bg-primary/20 rounded-full" />
                  </div>
                  <div className="absolute bottom-0 left-0 h-1 bg-primary/20 w-0 group-active:w-full transition-all duration-[30s]" />
                </button>
              ))}
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
              Mantenha o ganho do microfone entre 80% e 100% para melhor clareza. Use as vinhetas para transições suaves entre falas.
            </p>
          </div>
        </aside>
      </main>

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
