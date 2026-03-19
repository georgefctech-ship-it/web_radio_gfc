import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Radio, 
  Mic, 
  Settings, 
  Power, 
  Activity, 
  Volume2, 
  VolumeX, 
  Headphones, 
  Music, 
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  Clock,
  Users,
  Wifi,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { socket } from '../lib/socket';
import { supabase } from '../lib/supabase';

// --- Types ---

interface AudioStats {
  encoder: string;
  bitrate: string;
  sampleRate: string;
  listeners: number;
  uptime: string;
}

interface DeckState {
  id: number;
  isActive: boolean;
  isMuted: boolean;
  gain: number;
  deviceId: string;
  label: string;
  dbLevel: number;
}

// --- Components ---

const VUMeter = ({ level, label }: { level: number; label: string }) => {
  // Convert dB to percentage for the meter (approximate)
  // -54dB is bottom, 0dB is top (green/yellow), +6dB is red
  const getPercentage = (db: number) => {
    if (db <= -54) return 0;
    if (db >= 6) return 100;
    return ((db + 54) / 60) * 100;
  };

  const percentage = getPercentage(level);
  
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="h-48 w-4 bg-gray-200 dark:bg-gray-800 rounded-sm relative overflow-hidden flex flex-col-reverse">
        {/* Scale markers */}
        {[0, -6, -12, -18, -24, -30, -36, -42, -48, -54].map((val) => (
          <div 
            key={val} 
            className="absolute w-full border-t border-black/10 dark:border-white/10" 
            style={{ bottom: `${getPercentage(val)}%` }}
          >
            <span className="absolute -left-5 text-[8px] font-bold text-gray-400">{val}</span>
          </div>
        ))}
        
        {/* Level Bar */}
        <motion.div 
          className={`w-full transition-all duration-75 ${
            level > 0 ? 'bg-red-500' : level > -12 ? 'bg-yellow-500' : 'bg-green-500'
          }`}
          animate={{ height: `${percentage}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      </div>
      <span className="text-[10px] font-black text-gray-400 uppercase">{label}</span>
    </div>
  );
};

const Deck = ({ 
  state, 
  devices, 
  onUpdate 
}: { 
  state: DeckState; 
  devices: MediaDeviceInfo[]; 
  onUpdate: (updates: Partial<DeckState>) => void;
}) => {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-white/5 flex flex-col gap-6">
      {/* Deck Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${state.isActive ? 'bg-emerald-500 text-white' : 'bg-gray-100 dark:bg-white/5 text-gray-400'}`}>
            <Mic className="size-5" />
          </div>
          <div>
            <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-tighter">Deck {state.id}</h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Input Source</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => onUpdate({ isMuted: !state.isMuted })}
            className={`p-2 rounded-xl transition-all ${state.isMuted ? 'bg-red-500 text-white' : 'bg-gray-100 dark:bg-white/5 text-gray-400 hover:text-gray-600 dark:hover:text-white'}`}
          >
            {state.isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
        </div>
      </div>

      {/* Device Selection */}
      <div className="space-y-2">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Input Device</label>
        <div className="relative group">
          <select 
            value={state.deviceId}
            onChange={(e) => onUpdate({ deviceId: e.target.value })}
            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl py-3 pl-4 pr-10 outline-none focus:border-emerald-500/50 transition-all text-xs font-bold appearance-none"
          >
            <option value="none">None</option>
            {devices.map(device => (
              <option key={device.deviceId} value={device.deviceId}>{device.label || `Device ${device.deviceId.slice(0, 5)}`}</option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
            <RefreshCw className="size-3" />
          </div>
        </div>
      </div>

      {/* Meters & Gain */}
      <div className="flex items-end justify-between gap-8 pt-4">
        <div className="flex-1 flex flex-col items-center gap-2">
          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{state.dbLevel.toFixed(1)} dB</span>
          <div className="flex gap-4">
            <VUMeter level={state.dbLevel} label="L" />
            <VUMeter level={state.dbLevel} label="R" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Gain</span>
          <div className="h-48 w-12 bg-gray-50 dark:bg-white/5 rounded-2xl relative flex flex-col items-center py-4">
            <input 
              type="range"
              min="-24"
              max="24"
              step="0.1"
              value={state.gain}
              onChange={(e) => onUpdate({ gain: parseFloat(e.target.value) })}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 -rotate-90 accent-emerald-500 cursor-pointer"
            />
            <div className="mt-auto text-[10px] font-black text-emerald-500">{state.gain > 0 ? `+${state.gain.toFixed(1)}` : state.gain.toFixed(1)}dB</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Studio() {
  const [isOnAir, setIsOnAir] = useState(false);
  const [isServerOnline, setIsServerOnline] = useState(true);
  const [currentSong, setCurrentSong] = useState('Live Broadcast!!!');
  const [uptime, setUptime] = useState('00:00:00');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [crossfader, setCrossfader] = useState(0); // -1 (Deck 1) to 1 (Deck 2)
  
  const [deck1, setDeck1] = useState<DeckState>({
    id: 1,
    isActive: true,
    isMuted: false,
    gain: 0,
    deviceId: 'none',
    label: 'MacBook Pro Microphone',
    dbLevel: -54
  });

  const [deck2, setDeck2] = useState<DeckState>({
    id: 2,
    isActive: false,
    isMuted: true,
    gain: 0,
    deviceId: 'none',
    label: 'None',
    dbLevel: -54
  });

  const [masterLevel, setMasterLevel] = useState(-54);
  const [monitorLevel, setMonitorLevel] = useState(-54);
  const [monitorDeviceId, setMonitorDeviceId] = useState('none');

  // --- Audio Engine Refs ---
  const audioContext = useRef<AudioContext | null>(null);
  const deck1Source = useRef<MediaStreamAudioSourceNode | null>(null);
  const deck2Source = useRef<MediaStreamAudioSourceNode | null>(null);
  const deck1Gain = useRef<GainNode | null>(null);
  const deck2Gain = useRef<GainNode | null>(null);
  const masterGain = useRef<GainNode | null>(null);
  const crossfaderNode = useRef<GainNode | null>(null);
  const analyser1 = useRef<AnalyserNode | null>(null);
  const analyser2 = useRef<AnalyserNode | null>(null);
  const analyserMaster = useRef<AnalyserNode | null>(null);

  // --- Initialization ---

  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        setDevices(allDevices.filter(d => d.kind === 'audioinput'));
      } catch (err) {
        console.error("Error accessing media devices:", err);
      }
    };
    getDevices();
  }, []);

  // --- Audio Logic ---

  const startAudioEngine = useCallback(async () => {
    if (!audioContext.current) {
      audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    if (audioContext.current.state === 'suspended') {
      await audioContext.current.resume();
    }
  }, []);

  const updateDeckStream = useCallback(async (deckId: number, deviceId: string) => {
    if (!audioContext.current) await startAudioEngine();
    const ctx = audioContext.current!;

    try {
      if (deviceId === 'none') {
        // Cleanup
        if (deckId === 1) {
          deck1Source.current?.disconnect();
          deck1Source.current = null;
        } else {
          deck2Source.current?.disconnect();
          deck2Source.current = null;
        }
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } }
      });

      const source = ctx.createMediaStreamSource(stream);
      const gain = ctx.createGain();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;

      if (deckId === 1) {
        deck1Source.current = source;
        deck1Gain.current = gain;
        analyser1.current = analyser;
        source.connect(gain);
        gain.connect(analyser);
        // Connect to master logic here...
      } else {
        deck2Source.current = source;
        deck2Gain.current = gain;
        analyser2.current = analyser;
        source.connect(gain);
        gain.connect(analyser);
      }
    } catch (err) {
      console.error(`Error updating deck ${deckId} stream:`, err);
    }
  }, [startAudioEngine]);

  // --- Animation Frame for Meters ---
  useEffect(() => {
    let rafId: number;
    const updateMeters = () => {
      if (analyser1.current) {
        const data = new Uint8Array(analyser1.current.frequencyBinCount);
        analyser1.current.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const db = avg > 0 ? 20 * Math.log10(avg / 255) : -54;
        setDeck1(prev => ({ ...prev, dbLevel: db }));
      }
      if (analyser2.current) {
        const data = new Uint8Array(analyser2.current.frequencyBinCount);
        analyser2.current.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const db = avg > 0 ? 20 * Math.log10(avg / 255) : -54;
        setDeck2(prev => ({ ...prev, dbLevel: db }));
      }
      rafId = requestAnimationFrame(updateMeters);
    };
    rafId = requestAnimationFrame(updateMeters);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // --- Uptime Timer ---
  useEffect(() => {
    if (!isOnAir) return;
    const start = Date.now();
    const interval = setInterval(() => {
      const diff = Date.now() - start;
      const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
      const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      setUptime(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [isOnAir]);

  const handleGoLive = () => {
    setIsOnAir(!isOnAir);
    if (!isOnAir) {
      // Logic to start broadcast
      socket.emit('live:start', { broadcasterId: 'admin' });
    } else {
      // Logic to stop broadcast
      socket.emit('live:stop');
      setUptime('00:00:00');
    }
  };

  const handleUpdateMetadata = () => {
    socket.emit('metadata:update', { title: currentSong });
    // Show toast or notification
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-bg-dark p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header / Control Bar */}
        <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 shadow-xl border border-gray-100 dark:border-white/5 flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4">
            <div className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${isOnAir ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/20' : 'bg-gray-100 dark:bg-white/5 text-gray-400'}`}>
              <div className={`size-2 rounded-full ${isOnAir ? 'bg-white' : 'bg-gray-400'}`} />
              {isOnAir ? 'On Air' : 'Off Air'}
            </div>
            
            <div className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-500/10 text-emerald-500 font-black uppercase tracking-widest text-xs border border-emerald-500/20">
              <Wifi className="size-4" />
              Server Online
            </div>

            <div className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-blue-500/10 text-blue-500 font-black uppercase tracking-widest text-xs border border-blue-500/20">
              <Activity className="size-4" />
              Health
            </div>

            <div className="hidden xl:flex flex-col gap-1 ml-4">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                <div className="size-1.5 rounded-full bg-emerald-500" />
                Encoder: <span className="text-gray-900 dark:text-white">Opus 96Kbps @ 48kHz</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                <div className="size-1.5 rounded-full bg-blue-500" />
                Listeners: <span className="text-gray-900 dark:text-white">0</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                <div className="size-1.5 rounded-full bg-purple-500" />
                Uptime: <span className="text-gray-900 dark:text-white">{uptime}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6 w-full lg:w-auto">
            <div className="flex items-center gap-3 bg-gray-50 dark:bg-white/5 p-2 rounded-2xl border border-gray-100 dark:border-white/10 w-full sm:w-auto">
              <div className="pl-4 text-gray-400"><Music className="size-4" /></div>
              <input 
                type="text" 
                value={currentSong}
                onChange={(e) => setCurrentSong(e.target.value)}
                className="bg-transparent border-none outline-none text-xs font-bold w-full sm:w-48 text-gray-900 dark:text-white"
                placeholder="Current Song..."
              />
              <button 
                onClick={handleUpdateMetadata}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                Update
              </button>
            </div>

            <button 
              onClick={handleGoLive}
              className={`w-full sm:w-48 py-4 rounded-3xl font-black uppercase tracking-[0.2em] text-sm flex items-center justify-center gap-3 transition-all shadow-2xl ${
                isOnAir 
                ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/20' 
                : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/20'
              }`}
            >
              <Power className="size-5" />
              {isOnAir ? 'Disconnect' : 'Go Live'}
            </button>

            <button className="p-4 bg-gray-100 dark:bg-white/5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-3xl transition-all">
              <Settings className="size-6" />
            </button>
          </div>
        </div>

        {/* Main Studio Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
          {/* Deck 1 */}
          <Deck 
            state={deck1} 
            devices={devices} 
            onUpdate={(u) => {
              setDeck1(prev => ({ ...prev, ...u }));
              if (u.deviceId) updateDeckStream(1, u.deviceId);
            }} 
          />

          {/* Deck 2 */}
          <Deck 
            state={deck2} 
            devices={devices} 
            onUpdate={(u) => {
              setDeck2(prev => ({ ...prev, ...u }));
              if (u.deviceId) updateDeckStream(2, u.deviceId);
            }} 
          />

          {/* Master Output */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-white/5 flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-500 text-white">
                <Activity className="size-5" />
              </div>
              <div>
                <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-tighter">Master</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Main Output</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                <span>Deck 1</span>
                <span>Both</span>
                <span>Deck 2</span>
              </div>
              <div className="relative h-12 bg-gray-50 dark:bg-white/5 rounded-2xl flex items-center px-4">
                <input 
                  type="range"
                  min="-1"
                  max="1"
                  step="0.01"
                  value={crossfader}
                  onChange={(e) => setCrossfader(parseFloat(e.target.value))}
                  className="w-full accent-purple-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-end justify-between gap-8 pt-4">
              <div className="flex-1 flex flex-col items-center gap-2">
                <span className="text-[10px] font-black text-purple-500 uppercase tracking-widest">{masterLevel.toFixed(1)} dB</span>
                <div className="flex gap-4">
                  <VUMeter level={masterLevel} label="L" />
                  <VUMeter level={masterLevel} label="R" />
                </div>
              </div>

              <div className="flex flex-col items-center gap-4">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Gain</span>
                <div className="h-48 w-12 bg-gray-50 dark:bg-white/5 rounded-2xl relative flex flex-col items-center py-4">
                  <input 
                    type="range"
                    min="-24"
                    max="24"
                    step="0.1"
                    defaultValue="0"
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 -rotate-90 accent-purple-500 cursor-pointer"
                  />
                  <div className="mt-auto text-[10px] font-black text-purple-500">0.0dB</div>
                </div>
              </div>
            </div>
          </div>

          {/* Monitor Output */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-white/5 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500 text-white">
                  <Headphones className="size-5" />
                </div>
                <div>
                  <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-tighter">Monitor</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Local Output</p>
                </div>
              </div>
              <button className="p-2 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-400">
                <VolumeX className="size-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Monitor Device</label>
              <div className="relative group">
                <select 
                  value={monitorDeviceId}
                  onChange={(e) => setMonitorDeviceId(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl py-3 pl-4 pr-10 outline-none focus:border-blue-500/50 transition-all text-xs font-bold appearance-none"
                >
                  <option value="none">None</option>
                  {devices.map(device => (
                    <option key={device.deviceId} value={device.deviceId}>{device.label || `Device ${device.deviceId.slice(0, 5)}`}</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <RefreshCw className="size-3" />
                </div>
              </div>
            </div>

            <div className="flex items-end justify-between gap-8 pt-4">
              <div className="flex-1 flex flex-col items-center gap-2">
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{monitorLevel.toFixed(1)} dB</span>
                <div className="flex gap-4">
                  <VUMeter level={monitorLevel} label="L" />
                  <VUMeter level={monitorLevel} label="R" />
                </div>
              </div>

              <div className="flex flex-col items-center gap-4">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Gain</span>
                <div className="h-48 w-12 bg-gray-50 dark:bg-white/5 rounded-2xl relative flex flex-col items-center py-4">
                  <input 
                    type="range"
                    min="-24"
                    max="24"
                    step="0.1"
                    defaultValue="0"
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 -rotate-90 accent-blue-500 cursor-pointer"
                  />
                  <div className="mt-auto text-[10px] font-black text-blue-500">0.0dB</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Info / Logs */}
        <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 shadow-xl border border-gray-100 dark:border-white/5">
          <div className="flex items-center gap-3 mb-6">
            <Activity className="size-5 text-emerald-500" />
            <h3 className="font-black text-gray-900 dark:text-white uppercase tracking-widest text-xs">System Logs & Events</h3>
          </div>
          <div className="space-y-3 font-mono text-[10px] text-gray-500">
            <div className="flex gap-4">
              <span className="text-emerald-500 font-bold">[13:51:17]</span>
              <span>Studio initialized successfully.</span>
            </div>
            <div className="flex gap-4">
              <span className="text-emerald-500 font-bold">[13:51:18]</span>
              <span>Connected to broadcast server: sapircast.caster.fm:19793</span>
            </div>
            <div className="flex gap-4">
              <span className="text-blue-500 font-bold">[13:51:20]</span>
              <span>Input devices detected: 3 sources available.</span>
            </div>
            {isOnAir && (
              <div className="flex gap-4 animate-pulse">
                <span className="text-red-500 font-bold">[{new Date().toLocaleTimeString()}]</span>
                <span className="text-red-500 font-bold">Broadcasting live to 100 listeners...</span>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
