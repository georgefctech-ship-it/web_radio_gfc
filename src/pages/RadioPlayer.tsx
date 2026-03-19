import { useEffect, useState, useRef, useMemo, FormEvent, useCallback } from 'react';
import Hls from 'hls.js';
import { getColorSync } from 'colorthief';
import { useJsApiLoader, Autocomplete } from '@react-google-maps/api';
import { Link } from 'react-router-dom';
import { 
  Radio, 
  Compass, 
  Heart, 
  Search, 
  User, 
  Zap, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX,
  Settings,
  Menu,
  X,
  Loader2,
  Plus,
  Globe,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Library,
  Crown,
  Shield,
  ChevronRight,
  ChevronDown,
  SkipBack,
  SkipForward,
  Share2,
  Maximize2,
  Trash2,
  Edit2,
  Bell,
  MoreHorizontal,
  Users,
  Mic,
  MicOff,
  Navigation,
  Info,
  Activity,
  Instagram,
  Youtube,
  Facebook,
  Linkedin,
  AtSign,
  Twitter,
  Music2,
  Newspaper,
  Map,
  Ticket,
  Mic2,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AudioVisualizer } from '../components/AudioVisualizer';
import { radioService, type RadioStation } from '../services/radioService';
import { GoogleMapView } from '../components/GoogleMapView';
import { Chat } from '../components/Chat';
import { socket } from '../lib/socket';
import { usePlayer } from '../context/PlayerContext';
import { useVoiceControl } from '../hooks/useVoiceControl';

const LIBRARIES: ("places")[] = ["places"];

export default function RadioPlayer() {
  // Global Player State
  const { 
    currentStation, 
    setCurrentStation, 
    isPlaying, 
    setIsPlaying, 
    volume, 
    setVolume, 
    isMuted, 
    setIsMuted, 
    setIsDucked,
    isVignetteMuted,
    setIsVignetteMuted,
    analyser,
    audioRef
  } = usePlayer();

  // Local State
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [managedStations, setManagedStations] = useState<RadioStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [onlineListeners, setOnlineListeners] = useState(0);
  const [broadcasterId, setBroadcasterId] = useState<string | null>(null);
  const [socketStatus, setSocketStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const socketStatusRef = useRef(socketStatus);
  useEffect(() => {
    socketStatusRef.current = socketStatus;
  }, [socketStatus]);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [isLiveAudioPlaying, setIsLiveAudioPlaying] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [vignetteUrl, setVignetteUrl] = useState<string | null>(null);
  const vignetteAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<'explore' | 'favorites' | 'map' | 'chat'>('explore');
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isSavingStation, setIsSavingStation] = useState(false);
  const [editingStation, setEditingStation] = useState<RadioStation | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNavMenuOpen, setIsNavMenuOpen] = useState(false);
  const [isMobilePlayerOpen, setIsMobilePlayerOpen] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [filter, setFilter] = useState<'todas' | 'favoritas'>('todas');
  const [isVolumeHovered, setIsVolumeHovered] = useState(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const volumeBarRef = useRef<HTMLDivElement>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [userVotes, setUserVotes] = useState<Record<string, 'like' | 'dislike' | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [mapsAuthError, setMapsAuthError] = useState(false);
  const [dominantColor, setDominantColor] = useState<string>('#2563EB'); // Default primary color
  const [branding, setBranding] = useState({ 
    name: 'RÁDIO GFC', 
    logo: 'https://picsum.photos/seed/radio-gfc/800',
    maintenanceMode: false
  });
  const [logoClickCount, setLogoClickCount] = useState(0);
  const [isDriverMode, setIsDriverMode] = useState(false);
  const [lastVoiceCommand, setLastVoiceCommand] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [isVignettePlaying, setIsVignettePlaying] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
  const liveAudioRef = useRef<HTMLAudioElement | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Refs
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    // Google Maps calls this global function on auth failure
    (window as any).gm_authFailure = () => {
      console.error("Google Maps authentication failure detected in RadioPlayer.");
      setMapsAuthError(true);
    };
    return () => {
      (window as any).gm_authFailure = null;
    };
  }, []);

  const [liveAnalyser, setLiveAnalyser] = useState<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Initialize AudioContext for Visualizer
  useEffect(() => {
    if (isLiveAudioPlaying && liveAudioRef.current && !audioContextRef.current) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const node = ctx.createAnalyser();
      node.fftSize = 256;
      
      try {
        const source = ctx.createMediaElementSource(liveAudioRef.current);
        source.connect(node);
        node.connect(ctx.destination);
        
        audioContextRef.current = ctx;
        sourceNodeRef.current = source;
        setLiveAnalyser(node);
      } catch (err) {
        console.warn("[Player] Error connecting audio to visualizer:", err);
      }
    }
    
    return () => {
      if (!isLiveAudioPlaying && audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
        sourceNodeRef.current = null;
        setLiveAnalyser(null);
      }
    };
  }, [isLiveAudioPlaying]);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries: LIBRARIES
  });

  const onAutocompleteLoad = useCallback((autocompleteInstance: google.maps.places.Autocomplete) => {
    setAutocomplete(autocompleteInstance);
  }, []);

  const onPlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      if (place.formatted_address) {
        setSearchQuery(place.formatted_address);
      } else if (place.name) {
        setSearchQuery(place.name);
      }
    }
  };

  const stationToId = (s: RadioStation) => s.stationuuid || s.name;

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((e) => {
        console.error(`Error attempting to enable full-screen mode: ${e.message}`);
      });
      setIsFullScreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullScreen(false);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Global mouse/touch up to stop volume dragging
  useEffect(() => {
    const handleMove = (clientY: number) => {
      if (isDraggingVolume && volumeBarRef.current) {
        const rect = volumeBarRef.current.getBoundingClientRect();
        const height = rect.height;
        const y = clientY - rect.top;
        const newVolume = Math.max(0, Math.min(1, 1 - (y / height)));
        setVolume(newVolume);
      }
    };

    const handleGlobalMouseMove = (e: MouseEvent) => handleMove(e.clientY);
    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handleMove(e.touches[0].clientY);
    };

    const handleGlobalEnd = () => {
      if (isDraggingVolume) {
        setIsDraggingVolume(false);
        setIsVolumeHovered(false);
      }
    };

    if (isDraggingVolume) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalEnd);
      window.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
      window.addEventListener('touchend', handleGlobalEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalEnd);
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('touchend', handleGlobalEnd);
    };
  }, [isDraggingVolume]);

  // Extract dominant color from cover art
  useEffect(() => {
    if (currentStation?.favicon) {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = currentStation.favicon;
      img.onload = () => {
        try {
          const color = getColorSync(img);
          if (color) {
            setDominantColor(color.css());
          }
        } catch (e) {
          console.error("Error extracting color:", e);
          setDominantColor('#2563EB');
        }
      };
      img.onerror = () => {
        setDominantColor('#2563EB');
      };
    } else {
      setDominantColor('#2563EB');
    }
  }, [currentStation]);

  const playPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAdmin(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAdmin(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Update progress bar
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      setCurrentTime(audio.currentTime);
      // For radio streams, duration might be Infinity. 
      // If it is, we'll show a simulated duration or just keep it at 0.
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      } else {
        // Mock duration for radio feel if infinite
        setDuration(0); 
      }
    };

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', updateProgress);

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('loadedmetadata', updateProgress);
    };
  }, [audioRef]);

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return '00:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Initial Load
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        
        // Fetch branding first
        try {
          const { data: settings } = await supabase
            .from('settings')
            .select('*')
            .eq('id', 'global')
            .maybeSingle();

          if (settings) {
            setBranding({
              name: settings.name || 'RÁDIO GFC',
              logo: settings.logo || 'https://bcfckpzvbltnsryqbwif.supabase.co/storage/v1/object/public/meus_arquivos/logo-web-radio.png',
              maintenanceMode: settings.maintenance_mode || false
            });
          }
        } catch (e) {
          console.warn("Could not fetch branding:", e);
        }

        const fetchWithRetry = async (fn: () => Promise<any>, retries = 3) => {
          let lastErr;
          for (let i = 0; i < retries; i++) {
            try {
              return await fn();
            } catch (e) {
              lastErr = e;
              if (i < retries - 1) {
                console.warn(`[Supabase] Retry ${i + 1} failed:`, e);
                await new Promise(r => setTimeout(r, 1000 * (i + 1)));
              }
            }
          }
          throw lastErr;
        };

        try {
          console.log("[Supabase] Getting session...");
          const { data: sessionData, error: sessionError } = await fetchWithRetry(() => supabase.auth.getSession());
          if (sessionError) {
            console.warn("[Supabase] Session error:", sessionError.message);
          }
          const session = sessionData?.session;
          setIsAdmin(!!session);
          
          if (session) {
            console.log("[Supabase] Fetching favorites...");
            let favs = null;
            let favsError = null;
            
            try {
              const res = await fetchWithRetry(async () => {
                const r = await supabase.from('favorites').select('station_id');
                return r;
              });
              favs = res.data;
              favsError = res.error;
            } catch (err: any) {
              console.warn("[Supabase] Favorites direct fetch failed, trying proxy...", err.message);
              try {
                const proxyRes = await fetch(`/api/supabase/favorites?select=station_id&user_id=eq.${session.user.id}`);
                if (proxyRes.ok) {
                  favs = await proxyRes.json();
                } else {
                  favsError = { message: `Proxy failed with status ${proxyRes.status}` };
                }
              } catch (proxyErr: any) {
                favsError = { message: proxyErr.message };
              }
            }

            if (favsError) {
              console.warn("[Supabase] Favorites error:", favsError.message);
              // Fallback to localStorage if table is missing or other error
              const localFavs = localStorage.getItem('radio_favorites');
              if (localFavs) {
                try {
                  const parsedFavs = JSON.parse(localFavs);
                  if (Array.isArray(parsedFavs)) {
                    setFavorites(parsedFavs);
                  } else {
                    setFavorites([]);
                  }
                } catch (e) {
                  console.error("Error parsing local favorites:", e);
                }
              }
            }
            if (favs) {
              const favIds = favs.map((f: any) => f.station_id);
              setFavorites(favIds);
              localStorage.setItem('radio_favorites', JSON.stringify(favIds));
            }
          }

          console.log("[Supabase] Fetching stations...");
          let dbStations = null;
          let dbError = null;
          
          try {
            const res = await fetchWithRetry(async () => {
              const r = await supabase.from('stations').select('*');
              return r;
            });
            dbStations = res.data;
            dbError = res.error;
          } catch (err: any) {
            console.warn("[Supabase] Stations direct fetch failed, trying proxy...", err.message);
            try {
              const proxyRes = await fetch('/api/supabase/stations?select=*');
              if (proxyRes.ok) {
                dbStations = await proxyRes.json();
              } else {
                dbError = { message: `Proxy failed with status ${proxyRes.status}` };
              }
            } catch (proxyErr: any) {
              dbError = { message: proxyErr.message };
            }
          }

          if (dbError) console.error("[Supabase] Stations error:", dbError.message);

          const apiStations = await radioService.getTopBrazilStations();
          
          const formattedDbStations = (dbStations || []).map((s: any) => ({
            ...s,
            stationuuid: s.id?.toString(),
            url_resolved: s.stream_url || s.url,
            favicon: s.cover_url || s.favicon || s.logo_url,
            tags: Array.isArray(s.genre) ? s.genre.join(', ') : (s.genre || ''),
            isCustom: true
          }));

          setStations([...formattedDbStations, ...apiStations]);
          setManagedStations(formattedDbStations);
        } catch (err: any) {
          console.error("Error in fetchInitialData:", err);
          const errorMessage = err.message === 'Failed to fetch' 
            ? "Erro de conexão. Verifique sua internet ou se o servidor está ativo."
            : `Erro ao carregar dados: ${err.message}`;
          setError(errorMessage);
          
          const apiStations = await radioService.getTopBrazilStations();
          setStations(apiStations);
        }
      } catch (err: any) {
        console.error('Error fetching initial data:', err);
        setError("Erro crítico ao iniciar a rádio. Tente recarregar a página.");
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();

    console.log("[Player] Socket status:", socket.connected ? "Connected" : "Disconnected");
    setSocketStatus(socket.connected ? 'connected' : 'connecting');
    
    // Supabase Realtime Listener for Studio Commands
    const studioChannel = supabase.channel('radio-studio');
    
    studioChannel
      .on('broadcast', { event: 'comando_estudio' }, ({ payload }) => {
        console.log("[Player] Comando recebido do estúdio via Supabase:", payload);
        
        if (payload.acao === 'ENTRAR_NO_AR' && payload.streamUrl) {
          // Switch to live stream
          setLiveStream(payload.streamUrl);
          setIsLiveAudioPlaying(true);
          setIsLive(true);
          
          // If already playing something, pause it
          if (isPlaying) {
            setIsPlaying(false);
          }
          
          // Show notification
          const notification = document.createElement('div');
          notification.className = 'fixed top-24 left-1/2 -translate-x-1/2 bg-red-600 text-white px-8 py-4 rounded-full font-black z-[100] animate-bounce shadow-2xl border-4 border-white flex items-center gap-3';
          notification.innerHTML = '<span class="w-3 h-3 bg-white rounded-full animate-pulse"></span> 🔴 ESTAMOS AO VIVO AGORA!';
          document.body.appendChild(notification);
          setTimeout(() => {
            notification.classList.add('opacity-0', 'transition-opacity', 'duration-1000');
            setTimeout(() => notification.remove(), 1000);
          }, 6000);
        } else if (payload.acao === 'SAIR_DO_AR') {
          setIsLiveAudioPlaying(false);
          setIsLive(false);
          setLiveStream(null);
        }
      })
      .subscribe();

    // Ensure socket is connected
    if (!socket.connected) {
      console.log("[Player] Socket not connected, attempting to connect...");
      socket.connect();
    }
    
    const onConnect = () => {
      console.log("[Player] Socket conectado:", socket.id);
      setSocketStatus('connected');
      setSocketError(null);
    };
    
    const onDisconnect = (reason: string) => {
      console.warn("[Player] Socket desconectado:", reason);
      setSocketStatus('disconnected');
      if (reason === 'io server disconnect') {
        socket.connect();
      }
    };

    const onConnectError = (err: any) => {
      console.error("[Player] Socket connection error details:", {
        message: err.message,
        description: err.description,
        context: err.context,
        type: err.name
      });
      setSocketStatus('disconnected');
      setSocketError(err.message);
    };

    const onListenersCount = (count: number) => {
      console.log("[Socket] Received listener count:", count);
      setOnlineListeners(count);
    };

    const onLiveStatus = ({ isLive: liveStatus, broadcasterId: bId }: any) => {
      setIsLive(liveStatus);
      setBroadcasterId(bId);
      if (!liveStatus && !isVignettePlaying) {
        setLiveStream(null);
        setLatency(null);
        peerConnection.current?.close();
        peerConnection.current = null;
      }
    };

    const onVignetteStart = (data?: { url?: string }) => {
      console.log("[Socket] Vignette START", data?.url);
      setIsVignettePlaying(true);
      if (data?.url) {
        setVignetteUrl(data.url);
        if (!isLiveAudioPlaying && vignetteAudioRef.current) {
          vignetteAudioRef.current.src = data.url;
          vignetteAudioRef.current.play().catch(err => {
            console.warn("[Audio] Vignette fallback autoplay blocked:", err);
          });
        }
      }
    };
    
    const onVignetteEnd = () => {
      console.log("[Socket] Vignette END");
      setIsVignettePlaying(false);
      setVignetteUrl(null);
      if (vignetteAudioRef.current) {
        vignetteAudioRef.current.pause();
        vignetteAudioRef.current.src = "";
      }
    };

    const onWebRTCOffer = async ({ fromId, offer }: any) => {
      console.log(`[Player] Recebida oferta WebRTC de ${fromId}`);
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      peerConnection.current = pc;

      pc.ontrack = (event) => {
        console.log("[Player] Track recebida do estúdio:", event.streams[0]?.id);
        if (event.streams && event.streams[0]) {
          setLiveStream(event.streams[0]);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('webrtc:ice-candidate', {
            targetId: fromId,
            candidate: event.candidate
          });
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('webrtc:answer', {
        targetId: fromId,
        answer
      });
    };

    const onWebRTCBroadcastReady = () => {
      console.log("[Player] Broadcast is ready, requesting stream...");
      socket.emit('webrtc:request-stream');
    };

    const onWebRTCIceCandidate = async ({ candidate }: any) => {
      if (peerConnection.current) {
        try {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("[Player] Error adding received ice candidate", e);
        }
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('listeners:count', onListenersCount);
    socket.on('live:status', onLiveStatus);
    socket.on('vignette:start', onVignetteStart);
    socket.on('vignette:end', onVignetteEnd);
    socket.on('webrtc:offer', onWebRTCOffer);
    socket.on('webrtc:broadcast-ready', onWebRTCBroadcastReady);
    socket.on('webrtc:ice-candidate', onWebRTCIceCandidate);
    
    // Request initial count
    socket.emit('listeners:request');

    // Periodic connection check
    const connectionCheckInterval = setInterval(() => {
      if (!socket.connected && socketStatusRef.current !== 'connecting') {
        console.log("[Player] Socket connection check failed, attempting to connect...");
        socket.connect();
      }
    }, 10000);

    // Latency monitoring
    const latencyInterval = setInterval(async () => {
      if (!peerConnection.current) {
        setLatency(null);
        return;
      }

      try {
        const stats = await peerConnection.current.getStats();
        stats.forEach(report => {
          if (report.type === 'remote-candidate' && report.roundTripTime) {
            setLatency(Math.round(report.roundTripTime * 1000));
          } else if (report.type === 'candidate-pair' && report.currentRoundTripTime) {
            setLatency(Math.round(report.currentRoundTripTime * 1000));
          }
        });
      } catch (err) {
        console.warn("[Player] Error getting stats:", err);
      }
    }, 5000);

    return () => {
      supabase.removeChannel(studioChannel);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('listeners:count', onListenersCount);
      socket.off('live:status', onLiveStatus);
      socket.off('vignette:start', onVignetteStart);
      socket.off('vignette:end', onVignetteEnd);
      socket.off('webrtc:offer', onWebRTCOffer);
      socket.off('webrtc:broadcast-ready', onWebRTCBroadcastReady);
      socket.off('webrtc:ice-candidate', onWebRTCIceCandidate);
      clearInterval(latencyInterval);
      clearInterval(connectionCheckInterval);
    };
  }, [setIsLiveAudioPlaying, setLiveStream, isPlaying, setIsPlaying, isVignettePlaying, isLiveAudioPlaying]);

  // Ducking logic for live audio when vignette plays
  useEffect(() => {
    if (liveAudioRef.current) {
      if (isVignettePlaying) {
        liveAudioRef.current.volume = 0.2; // Duck to 20%
      } else {
        liveAudioRef.current.volume = 1.0;
      }
    }
  }, [isVignettePlaying]);

  // Request stream when live starts or vignette plays
  useEffect(() => {
    if ((isLive || isVignettePlaying) && !liveStream) {
      console.log("[WebRTC] Requesting stream (Live:", isLive, "Vignette:", isVignettePlaying, ")");
      socket.emit('webrtc:request-stream');
    }
  }, [isLive, isVignettePlaying, liveStream]);

  // Handle live audio playback with ducking and error handling
  useEffect(() => {
    if (liveStream && liveAudioRef.current) {
      const audio = liveAudioRef.current;
      
      if (liveStream instanceof MediaStream) {
        audio.srcObject = liveStream;
      } else if (typeof liveStream === 'string') {
        audio.src = liveStream;
        audio.srcObject = null;
      }
      
      const playAudio = async () => {
        try {
          await audio.play();
          setIsLiveAudioPlaying(true);
          setAudioError(null);
          setIsDucked(true);
        } catch (err) {
          console.error("[Audio] Playback failed:", err);
          setIsLiveAudioPlaying(false);
          setAudioError("Clique para ouvir o áudio ao vivo");
        }
      };

      playAudio();
    } else {
      setIsDucked(false);
      setIsLiveAudioPlaying(false);
    }
  }, [liveStream, setIsDucked]);

  const handleNext = useCallback(() => {
    if (!currentStation || stations.length === 0) return;
    const currentIndex = stations.findIndex(s => s.stationuuid === currentStation.stationuuid);
    const nextIndex = (currentIndex + 1) % stations.length;
    setCurrentStation(stations[nextIndex]);
    setIsPlaying(true);
  }, [currentStation, stations, setCurrentStation, setIsPlaying]);

  const handlePrevious = useCallback(() => {
    if (!currentStation || stations.length === 0) return;
    const currentIndex = stations.findIndex(s => s.stationuuid === currentStation.stationuuid);
    const prevIndex = (currentIndex - 1 + stations.length) % stations.length;
    setCurrentStation(stations[prevIndex]);
    setIsPlaying(true);
  }, [currentStation, stations, setCurrentStation, setIsPlaying]);

  const lastCommandTimeRef = useRef<number>(0);

  const handleVoiceCommand = useCallback((command: string, params?: string) => {
    const now = Date.now();
    // 2 second cooldown between commands to prevent loops
    if (now - lastCommandTimeRef.current < 2000) {
      console.log('[VoiceControl] Ignoring command due to cooldown:', command);
      return;
    }
    
    lastCommandTimeRef.current = now;
    setLastVoiceCommand(params ? `${command}: ${params}` : command);
    setTimeout(() => setLastVoiceCommand(null), 3000);

    console.log('[VoiceControl] Executing command:', command, params);

    switch (command) {
      case 'play_station':
        if (params) {
          const found = stations.find(s => 
            (s.name || '').toLowerCase().includes(params.toLowerCase()) || 
            (s.tags || '').toLowerCase().includes(params.toLowerCase())
          );
          if (found) {
            setCurrentStation(found);
            setIsPlaying(true);
          }
        }
        break;
      case 'next':
        handleNext();
        break;
      case 'previous':
        handlePrevious();
        break;
      case 'mute':
        setIsMuted(!isMuted);
        break;
      case 'play':
        if (!isPlaying) setIsPlaying(true);
        break;
      case 'pause':
        if (isPlaying) setIsPlaying(false);
        break;
      case 'volume_up':
        setVolume(Math.min(1, volume + 0.1));
        break;
      case 'volume_down':
        setVolume(Math.max(0, volume - 0.1));
        break;
      case 'help':
        setError("Comandos: Toque [nome], Próxima, Volta, Mute, Play, Pause, Aumentar/Abaixar Volume");
        setTimeout(() => setError(null), 5000);
        break;
    }
  }, [stations, setCurrentStation, isPlaying, setIsPlaying, isMuted, setIsMuted, volume, setVolume, handleNext, handlePrevious]);

  const { isListening, toggleListening, error: voiceError } = useVoiceControl({
    onCommand: handleVoiceCommand
  });

  useEffect(() => {
    if (voiceError) {
      setError(voiceError);
      setTimeout(() => setError(null), 5000);
    }
  }, [voiceError]);

  // Handlers
  const handleSaveStation = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isAdmin || !isSupabaseConfigured) return;

    setIsSavingStation(true);
    const formData = new FormData(e.currentTarget);
    const payload = {
      name: formData.get('name') as string,
      stream_url: formData.get('url') as string, // Updated to stream_url
      genre: (formData.get('genre') as string).split(',').map(g => g.trim()), // Updated to TEXT[]
      cover_url: formData.get('logo_url') as string, // Updated to cover_url
      listener_count: 0,
      updated_at: new Date().toISOString()
    };

    try {
      if (editingStation) {
        const { error } = await supabase.from('stations').update(payload).eq('id', editingStation.stationuuid);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('stations').insert([payload]).select().single();
        if (error) throw error;
      }
      
      // Refresh list
      const { data: dbStations } = await supabase.from('stations').select('*');
      if (dbStations) {
        const mapped = dbStations.map(s => ({
          ...s,
          stationuuid: s.id?.toString(),
          name: s.name,
          url_resolved: s.stream_url || s.url,
          tags: Array.isArray(s.genre) ? s.genre.join(', ') : (s.genre || ''),
          favicon: s.cover_url || s.favicon || s.logo_url,
          geo_lat: s.latitude,
          geo_long: s.longitude,
          votes: s.listeners_count || 0,
          country: s.country || 'Brazil',
          state: s.city || '',
          language: 'Portuguese',
          hls: (s.stream_url || s.url)?.includes('m3u8') ? 1 : 0,
          lastcheckok: 1,
          changeId: '', url: '', homepage: '', countrycode: '', lastchangetime: '', codec: '', bitrate: 0, lastchecktime: '', lastcheckoktime: '', lastlocalchecktime: '', clicktimestamp: '', clickcount: 0, clicktrend: 0
        }));
        setManagedStations(mapped);
      }

      setIsManageModalOpen(false);
      setEditingStation(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSavingStation(false);
    }
  };

  const handleDeleteStation = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta estação?')) return;
    try {
      const { error } = await supabase.from('stations').delete().eq('id', id);
      if (error) throw error;
      setManagedStations(prev => prev.filter(s => s.stationuuid !== id));
      setStations(prev => prev.filter(s => s.stationuuid !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const toggleFavorite = async (station: RadioStation) => {
    if (!isSupabaseConfigured) return;
    const id = stationToId(station);
    
    if (favorites?.includes(id)) {
      const newFavs = favorites.filter(fid => fid !== id);
      setFavorites(newFavs);
      localStorage.setItem('radio_favorites', JSON.stringify(newFavs));
      
      try {
        const { error } = await supabase.from('favorites').delete().eq('station_id', id);
        if (error) throw error;
      } catch (e) {
        console.warn("Supabase delete favorite failed, kept in local storage only", e);
      }
    } else {
      const newFavs = [...favorites, id];
      setFavorites(newFavs);
      localStorage.setItem('radio_favorites', JSON.stringify(newFavs));
      
      try {
        const { error } = await supabase.from('favorites').insert([{ station_id: id }]);
        if (error) throw error;
      } catch (e) {
        console.warn("Supabase insert favorite failed, kept in local storage only", e);
      }
    }
  };

  const filteredStations = stations.filter(s => 
    (s.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (s.tags?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const handleLike = () => {
    if (!currentStation) return;
    const id = stationToId(currentStation);
    const currentVote = userVotes[id];
    
    if (currentVote === 'like') {
      socket.emit('station:vote', { stationId: id, type: 'remove_like' });
      setUserVotes(prev => ({ ...prev, [id]: null }));
    } else {
      if (currentVote === 'dislike') {
        socket.emit('station:vote', { stationId: id, type: 'remove_dislike' });
      }
      socket.emit('station:vote', { stationId: id, type: 'like' });
      setUserVotes(prev => ({ ...prev, [id]: 'like' }));
    }
  };

  const handleDislike = () => {
    if (!currentStation) return;
    const id = stationToId(currentStation);
    const currentVote = userVotes[id];
    
    if (currentVote === 'dislike') {
      socket.emit('station:vote', { stationId: id, type: 'remove_dislike' });
      setUserVotes(prev => ({ ...prev, [id]: null }));
    } else {
      if (currentVote === 'like') {
        socket.emit('station:vote', { stationId: id, type: 'remove_like' });
      }
      socket.emit('station:vote', { stationId: id, type: 'dislike' });
      setUserVotes(prev => ({ ...prev, [id]: 'dislike' }));
    }
  };

  const displayStations = filter === 'favoritas' 
    ? filteredStations.filter(s => favorites?.includes(stationToId(s)))
    : filteredStations;

  if (branding.maintenanceMode && !isAdmin) {
    return (
      <div className="min-h-screen bg-bg-dark flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-6">
          <div className="size-24 bg-primary/10 rounded-[40px] flex items-center justify-center mx-auto border border-primary/20">
            <Settings className="size-12 text-primary animate-spin-slow" />
          </div>
          <h1 className="text-4xl font-black uppercase tracking-tighter">Modo de Manutenção</h1>
          <p className="text-gray-400 font-medium">Estamos a realizar algumas melhorias no sistema. Voltamos em breve!</p>
          <div className="pt-6">
            <Link to="/admin" className="text-primary font-bold uppercase tracking-widest text-xs hover:underline">Acesso Administrativo</Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-dark flex flex-col items-center justify-center p-6 text-center space-y-8">
        <div className="relative">
          <div className="size-32 bg-primary/10 rounded-[40px] flex items-center justify-center animate-pulse border border-primary/20 overflow-hidden">
            <img 
              src={branding.logo} 
              alt={branding.name} 
              className="w-full h-full object-cover opacity-80"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="absolute -inset-4 bg-primary/5 blur-2xl rounded-full animate-pulse" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black uppercase tracking-tighter animate-pulse">{branding.name}</h1>
          <p className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.3em]">Sintonizando as melhores estações</p>
        </div>
        <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-primary"
            animate={{ x: [-200, 200] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-bg-dark text-white overflow-hidden font-display selection:bg-primary selection:text-white">
      <audio ref={liveAudioRef} autoPlay />
      <audio ref={vignetteAudioRef} className="hidden" />
      {/* Left Sidebar - Immersive Player (Hunter Style) */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-full sm:w-[400px] p-2 sm:p-4 transform transition-transform duration-500 ease-in-out lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div 
          className="flex flex-col h-full p-6 sm:p-8 relative overflow-hidden rounded-[32px] sm:rounded-[48px] border border-white/10 shadow-2xl"
          style={{ backgroundColor: dominantColor }}
        >
          {/* Background Gradient Overlay for depth */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/30 pointer-events-none" />
          
          {/* Header Section with Highlight Border (as seen in screenshot) */}
          <div className="relative z-10 flex flex-col items-center mb-6 sm:mb-10 p-4 rounded-3xl border-2 border-indigo-400/30 bg-white/5 backdrop-blur-md shadow-2xl">
            {isLive && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.2em] flex items-center gap-2 shadow-lg shadow-blue-600/40 z-20"
              >
                <span className="size-1.5 bg-white rounded-full animate-pulse" />
                <Mic className="size-3" />
                Locução ao Vivo
              </motion.div>
            )}

            {isVignetteMuted && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.2em] flex items-center gap-2 shadow-lg shadow-indigo-500/40 z-20 whitespace-nowrap"
              >
                <Music2 className="size-2.5 animate-bounce" />
                Vinheta Ativa
              </motion.div>
            )}
            <div className="w-full flex items-center justify-between mb-4">
              <button 
                onClick={() => {
                  const nextMode = !isDriverMode;
                  setIsDriverMode(nextMode);
                  if (nextMode && !isListening) toggleListening();
                  if (!nextMode && isListening) toggleListening();
                }}
                className={`p-3 transition-all rounded-xl ${isDriverMode ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-white/80 hover:text-white'}`}
                title="Modo Motorista (Voz)"
              >
                <Navigation className={`size-6 ${isDriverMode ? 'animate-pulse' : ''}`} />
              </button>

              <div className="flex items-center gap-2">
                <button 
                  onClick={toggleFullScreen}
                  className={`p-2 transition-colors ${isFullScreen ? 'text-white' : 'text-white/80 hover:text-white'} hidden sm:block`}
                >
                  <Maximize2 className="size-5" />
                </button>
                <button className="p-2 text-white/80 hover:text-white lg:hidden" onClick={() => setIsSidebarOpen(false)}>
                  <X className="size-6" />
                </button>
              </div>
            </div>

            <div className="w-full flex flex-col items-center justify-center mb-6">
              <h1 
                onClick={() => {
                  setLogoClickCount(prev => {
                    if (prev + 1 >= 5) {
                      setShowDebug(!showDebug);
                      return 0;
                    }
                    return prev + 1;
                  });
                }}
                className="text-2xl sm:text-3xl font-black tracking-tighter uppercase text-white text-center drop-shadow-md mb-6 cursor-pointer select-none active:scale-95 transition-transform"
              >
                {branding.name}
              </h1>
              
              <div className="text-center space-y-1 mb-6">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Tocando Agora</p>
                <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tighter truncate w-full max-w-[220px] sm:max-w-[320px]">
                  {currentStation?.name || 'Selecione uma Rádio'}
                </h2>
              </div>
            </div>

            {isLive && (
              <div className="mb-6 px-4 py-2 bg-blue-600/20 border border-blue-600/30 rounded-2xl flex items-center gap-3 animate-pulse">
                <div className="size-2 bg-blue-600 rounded-full" />
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">ESTÚDIO AO VIVO</span>
              </div>
            )}
            
            <div className="w-full max-w-[320px] sm:max-w-[440px] aspect-square rounded-3xl border-4 border-white/20 overflow-hidden shadow-2xl bg-black/40 mb-2 group relative">
              {isLiveAudioPlaying && liveAnalyser ? (
                <div className="absolute inset-0 z-20 bg-black/60 flex flex-col items-center justify-center p-8 backdrop-blur-sm">
                  <div className="w-full h-48 mb-6">
                    <AudioVisualizer analyser={liveAnalyser} />
                  </div>
                  <div className="flex items-center gap-3 bg-red-600 px-4 py-2 rounded-full border-2 border-white shadow-lg animate-pulse">
                    <div className="size-2 bg-white rounded-full" />
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">TRANSMISSÃO AO VIVO</span>
                  </div>
                </div>
              ) : null}
              <img 
                src={currentStation?.favicon || branding.logo} 
                alt={currentStation?.name || branding.name} 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = branding.logo;
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
            </div>

            {/* Bottom Station Info */}
            <div className="w-full px-4 mb-2">
              <h3 className="text-lg font-black text-white uppercase tracking-tight truncate">
                {currentStation?.name || 'Rádio'}
              </h3>
              <p className="text-xs font-bold text-white/40 uppercase tracking-widest">
                {currentStation?.tags?.split(',')[0] || 'Web Radio'}
              </p>
            </div>
          </div>

          {/* Navigation Menu removed as requested */}

          {/* Player Controls Section */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-4 sm:gap-8 min-h-0">
            {/* Voice Command Indicator */}
            <AnimatePresence>
              {lastVoiceCommand && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="absolute top-0 left-1/2 -translate-x-1/2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 text-[10px] font-black uppercase tracking-widest text-white z-50 flex items-center gap-2"
                >
                  <Mic className="size-3 text-primary animate-pulse" />
                  Comando: {lastVoiceCommand}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Progress Bar */}
            <div className="w-full space-y-3 px-2">
              <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                  initial={{ width: '0%' }}
                  animate={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : isPlaying ? '100%' : '0%' }}
                  transition={{ 
                    duration: duration > 0 ? 0.5 : isPlaying ? 60 : 0, 
                    ease: duration > 0 ? "easeOut" : "linear" 
                  }}
                />
              </div>
              <div className="flex justify-between text-[9px] sm:text-[10px] font-black text-white/50 uppercase tracking-widest">
                <span>{formatTime(currentTime)}</span>
                <span>{duration > 0 ? formatTime(duration) : 'AO VIVO'}</span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="relative z-10 mt-auto pt-4 sm:pt-6 flex flex-col gap-4 sm:gap-6">
            <div className="flex items-center justify-center gap-1 sm:gap-3 px-2">
              <div className="flex items-center gap-0.5">
                <button 
                  onClick={toggleListening}
                  className={`p-3 transition-all rounded-full ${isListening ? 'text-primary' : 'text-white/80 hover:text-white'}`}
                  style={isListening ? { color: dominantColor } : {}}
                  title="Comando de Voz"
                >
                  {isListening ? <Mic className="size-6 animate-pulse" /> : <Mic className="size-6" />}
                </button>

                <div 
                  className="relative"
                  onMouseEnter={() => setIsVolumeHovered(true)}
                  onMouseLeave={() => !isDraggingVolume && setIsVolumeHovered(false)}
                >
                  <button className={`text-white/80 hover:text-white transition-all p-1.5 hover:scale-110 active:scale-90 ${(isVolumeHovered || isDraggingVolume) ? 'opacity-0' : 'opacity-100'}`}>
                    {isMuted || volume === 0 ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
                  </button>
                  <AnimatePresence>
                    {(isVolumeHovered || isDraggingVolume) && (
                      <motion.div 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="absolute bottom-[-6px] left-[-2px] w-10 sm:w-11 bg-white/30 backdrop-blur-3xl rounded-[20px] border border-white/20 shadow-2xl z-50 flex flex-col items-center py-3 gap-3"
                      >
                        <div 
                          className="h-28 sm:h-32 w-full flex flex-col items-center justify-center relative cursor-pointer touch-none"
                          onMouseDown={(e) => {
                            setIsDraggingVolume(true);
                            if (volumeBarRef.current) {
                              const rect = volumeBarRef.current.getBoundingClientRect();
                              const height = rect.height;
                              const y = e.clientY - rect.top;
                              setVolume(Math.max(0, Math.min(1, 1 - (y / height))));
                            }
                          }}
                          onTouchStart={(e) => {
                            setIsDraggingVolume(true);
                            if (volumeBarRef.current && e.touches[0]) {
                              const rect = volumeBarRef.current.getBoundingClientRect();
                              const height = rect.height;
                              const y = e.touches[0].clientY - rect.top;
                              setVolume(Math.max(0, Math.min(1, 1 - (y / height))));
                            }
                          }}
                        >
                          <div ref={volumeBarRef} className="h-full w-[2px] bg-white/20 rounded-full relative pointer-events-none">
                            <div 
                              className="absolute bottom-0 left-0 right-0 bg-white rounded-full transition-all duration-75"
                              style={{ height: `${volume * 100}%` }}
                            />
                            <div 
                              className="absolute left-1/2 -translate-x-1/2 size-3.5 sm:size-4 bg-white rounded-full shadow-lg border border-white/10"
                              style={{ bottom: `calc(${volume * 100}% - 8px)` }}
                            />
                          </div>
                        </div>
                        <div className="text-white drop-shadow-sm pb-0.5">
                          {isMuted || volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-4">
                <button 
                  onClick={handlePrevious}
                  className="p-1.5 text-white/80 hover:text-white hover:scale-110 transition-all active:scale-95"
                >
                  <SkipBack className="size-5 fill-current" />
                </button>

                <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="size-11 sm:size-12 bg-white text-primary rounded-full flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all"
                  style={{ color: dominantColor }}
                >
                  {isPlaying ? <Pause className="size-5 sm:size-6 fill-current" /> : <Play className="size-5 sm:size-6 fill-current ml-1" />}
                </button>

                <button 
                  onClick={handleNext}
                  className="p-1.5 text-white/80 hover:text-white hover:scale-110 transition-all active:scale-95"
                >
                  <SkipForward className="size-5 fill-current" />
                </button>
              </div>

              <button 
                onClick={() => currentStation && toggleFavorite(currentStation)}
                className={`transition-all p-1.5 hover:scale-110 active:scale-90 ${currentStation && favorites?.includes(stationToId(currentStation)) ? 'text-white' : 'text-white/80'}`}
              >
                <Heart className={`size-5 ${currentStation && favorites?.includes(stationToId(currentStation)) ? 'fill-current' : ''}`} />
              </button>
            </div>
            
            <div className="flex justify-center pb-2">
              <button className="text-white/40 hover:text-white transition-colors">
                <div className="flex gap-1.5">
                  <div className="size-1 sm:size-1.5 bg-current rounded-full" />
                  <div className="size-1 sm:size-1.5 bg-current rounded-full" />
                  <div className="size-1 sm:size-1.5 bg-current rounded-full" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 relative bg-bg-dark">
        {/* Connection Status Bar */}
        <AnimatePresence>
          {socketStatus !== 'connected' && isAdmin && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className={`w-full ${socketStatus === 'connecting' ? 'bg-amber-500/20 text-amber-500' : 'bg-red-500/20 text-red-500'} px-6 py-2 flex items-center justify-center gap-3 border-b border-white/5 z-[60] backdrop-blur-md`}
            >
              <div className={`size-2 rounded-full ${socketStatus === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-[10px] font-black uppercase tracking-widest">
                {socketStatus === 'connecting' ? 'Tentando conectar ao servidor...' : 'Sem conexão com o servidor de chat/estatísticas'}
              </span>
              {socketStatus === 'disconnected' && (
                <button 
                  onClick={() => socket.connect()}
                  className="ml-4 px-3 py-1 bg-red-500 text-white rounded-full text-[8px] font-black uppercase tracking-widest hover:bg-red-600 transition-colors"
                >
                  Reconectar
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[100] bg-red-500/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl border border-red-400/20 shadow-2xl flex flex-col items-center gap-3">
            <div className="flex items-center gap-3">
              <X className="size-5 cursor-pointer" onClick={() => setError(null)} />
              <span className="text-sm font-bold">{error}</span>
            </div>
            <button 
              onClick={() => { setError(null); window.location.reload(); }}
              className="px-4 py-1.5 bg-white text-red-600 rounded-xl text-xs font-black hover:bg-gray-100 transition-colors"
            >
              Tentar Novamente
            </button>
          </div>
        )}
        {/* Top Navigation Bar */}
        <header className="h-20 flex items-center justify-between px-4 sm:px-8 border-b border-white/5 bg-bg-dark/80 backdrop-blur-xl sticky top-0 z-40">
          {/* Left: Branding Logo */}
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-gray-400 hover:text-white bg-white/5 rounded-full transition-all active:scale-95">
              <Menu className="size-5" />
            </button>
            <Link to="/" className="flex items-center gap-3 group">
              <div className="relative">
                <img 
                  src={branding.logo} 
                  alt="Logo" 
                  className="size-10 rounded-xl object-cover border border-white/10 group-hover:border-primary/50 transition-all shadow-lg"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-sm font-black tracking-tighter uppercase text-white leading-none mb-0.5">{branding.name}</h1>
                <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest leading-none">Rádio Digital</p>
              </div>
            </Link>
          </div>

          {/* Center: Navigation (Desktop) */}
          <nav className="hidden lg:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
            {[
              { label: 'RÁDIOS', active: activeTab === 'explore', onClick: () => setActiveTab('explore') },
              { label: 'MAPA', active: activeTab === 'map', onClick: () => setActiveTab('map') },
              { label: 'CHAT', active: activeTab === 'chat', onClick: () => setActiveTab('chat') },
            ].map((item) => (
              <button 
                key={item.label}
                onClick={item.onClick}
                className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all relative py-2 ${
                  item.active ? 'text-primary' : 'text-gray-500 hover:text-white'
                }`}
              >
                {item.label}
                {item.active && (
                  <motion.div 
                    layoutId="nav-active"
                    className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                  />
                )}
              </button>
            ))}
            <div className="w-[1px] h-4 bg-white/10 mx-2" />
            <div className="flex items-center gap-8">
              <Link to="/guiche-web" className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${window.location.pathname === '/guiche-web' ? 'text-primary' : 'text-gray-500 hover:text-white'}`}>GUICHÊ WEB</Link>
              <Link to="/podcasts" className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${window.location.pathname === '/podcasts' ? 'text-primary' : 'text-gray-500 hover:text-white'}`}>PODCAST</Link>
              <Link to="/news" className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${window.location.pathname === '/news' ? 'text-primary' : 'text-gray-500 hover:text-white'}`}>NOTICIA</Link>
            </div>
          </nav>

          {/* Right: Search & Actions */}
          <div className="flex items-center gap-3 sm:gap-6">
            <div className="relative group hidden sm:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-3.5 text-gray-500 group-focus-within:text-primary transition-colors z-10" />
              {isLoaded && !mapsAuthError && !loadError && activeTab === 'map' ? (
                <Autocomplete
                  onLoad={onAutocompleteLoad}
                  onPlaceChanged={onPlaceChanged}
                  options={{
                    types: ['address', 'geocode'],
                    componentRestrictions: { country: 'br' }
                  }}
                >
                  <input 
                    type="text"
                    placeholder="Buscar endereço..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-full py-2.5 pl-11 pr-6 outline-none focus:border-primary/50 focus:bg-white/10 transition-all text-[10px] font-medium w-48 md:w-64 focus:w-80"
                  />
                </Autocomplete>
              ) : (
                <input 
                  type="text"
                  placeholder={activeTab === 'map' ? "Buscar endereço..." : "Buscar rádios..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-full py-2.5 pl-11 pr-6 outline-none focus:border-primary/50 focus:bg-white/10 transition-all text-[10px] font-medium w-48 md:w-64 focus:w-80"
                />
              )}
            </div>

            <div className="flex items-center gap-2">
              <button className="p-2.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-full transition-all hidden sm:flex">
                <Bell className="size-5" />
              </button>
              <Link to="/admin" className="p-2.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-full transition-all">
                <User className="size-5" />
              </Link>
              
              {/* Mobile Menu Toggle */}
              <button 
                onClick={() => setIsNavMenuOpen(true)}
                className="lg:hidden p-2.5 text-gray-400 hover:text-white bg-white/5 rounded-full border border-white/10 transition-all active:scale-95"
              >
                <Menu className="size-5" />
              </button>

              {isAdmin && (
                <button 
                  onClick={() => supabase.auth.signOut()}
                  className="p-2.5 text-red-500/60 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all"
                  title="Sair"
                >
                  <X className="size-5" />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-10">
          {activeTab === 'map' ? (
            <div className="h-full rounded-2xl sm:rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
              <GoogleMapView 
                stations={stations} 
                currentStation={currentStation}
                searchQuery={searchQuery}
                isLoaded={isLoaded}
                loadError={loadError}
                onStationSelect={(s) => { setCurrentStation(s); setIsPlaying(true); }} 
              />
            </div>
          ) : activeTab === 'chat' ? (
            <div className="h-full rounded-2xl sm:rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
              <Chat onClose={() => setActiveTab('explore')} />
            </div>
          ) : (
            <div className="space-y-8 sm:space-y-12">
              {/* Filter Pills */}
              <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
                <button 
                  onClick={() => setFilter('todas')}
                  className={`hunter-btn-pill shrink-0 ${filter === 'todas' ? 'hunter-btn-pill-active' : 'hunter-btn-pill-inactive'}`}
                >
                  Todas
                </button>
                <button 
                  onClick={() => setFilter('favoritas')}
                  className={`hunter-btn-pill shrink-0 ${filter === 'favoritas' ? 'hunter-btn-pill-active' : 'hunter-btn-pill-inactive'}`}
                >
                  Favoritas
                </button>
              </div>

              {/* Station Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4 md:gap-6">
                {displayStations.map((station) => (
                  <motion.div 
                    layout
                    key={station.stationuuid}
                    onClick={() => { setCurrentStation(station); setIsPlaying(true); }}
                    className="group flex flex-col gap-2 cursor-pointer"
                  >
                    <div className="relative aspect-square rounded-lg overflow-hidden bg-card-bg border border-white/5 group-hover:border-white/20 transition-all duration-500">
                      <img 
                        src={station.favicon || `https://picsum.photos/seed/${station.name}/400`}
                        alt={station.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-all duration-700 opacity-90 group-hover:opacity-100"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${station.name}/400`;
                        }}
                      />
                      
                      {/* Listener Count Overlay */}
                      <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded border border-white/5">
                        <span className="text-[9px] font-black text-white/90">{Math.floor(Math.random() * 5000).toLocaleString()}</span>
                      </div>

                      {/* Play Overlay */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="size-10 bg-primary rounded-full flex items-center justify-center shadow-2xl scale-75 group-hover:scale-100 transition-transform duration-300">
                          <Play className="size-4 fill-current text-white ml-0.5" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <h3 className="font-bold text-[10px] text-white group-hover:text-primary transition-colors truncate">{station.name}</h3>
                      <p className="text-gray-500 text-[8px] leading-tight truncate">
                        {station.tags?.split(',')[0] || 'Radio'}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <footer className="h-16 border-t border-white/5 px-4 sm:px-10 flex items-center justify-between text-[10px] font-bold text-gray-600 uppercase tracking-[0.2em] bg-bg-dark overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-4 sm:gap-8 whitespace-nowrap">
            <Link to="/admin" className="hover:text-white transition-colors">MODO ADMIN</Link>
            <button className="hover:text-white transition-colors">SOBRE</button>
            <button className="hover:text-white transition-colors">POLÍTICA DE PRIVACIDADE</button>
            <Link to="/support" className="hover:text-white transition-colors">SUPORTE</Link>
          </div>

          {/* Social Media Icons - Centered */}
          <div className="flex items-center gap-4 px-4 border-x border-white/5 h-8">
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors"><Instagram className="size-4" /></a>
            <a href="https://spotify.com" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors"><Music2 className="size-4" /></a>
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors"><Twitter className="size-4" /></a>
            <a href="https://threads.net" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors"><AtSign className="size-4" /></a>
            <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors"><Youtube className="size-4" /></a>
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors"><Facebook className="size-4" /></a>
            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors"><Linkedin className="size-4" /></a>
          </div>

          <div className="whitespace-nowrap ml-4">© 2026 {branding.name} - Todos os direitos reservados</div>
        </footer>
      </main>

      {/* Admin Modal */}
      <AnimatePresence>
        {isManageModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6"
          >
            <div className="max-w-4xl w-full bg-[#111] border border-white/10 rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
                <div>
                  <h2 className="text-3xl font-black tracking-tighter uppercase">Gerenciamento</h2>
                  <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Painel de Controle de Estações</p>
                </div>
                <button onClick={() => { setIsManageModalOpen(false); setEditingStation(null); }} className="size-10 bg-white/5 rounded-full flex items-center justify-center hover:bg-white/10 transition-all">
                  <X className="size-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 grid md:grid-cols-2 gap-12 custom-scrollbar">
                <div className="space-y-8">
                  <h3 className="text-sm font-black uppercase tracking-widest text-primary">{editingStation ? 'Editar Rádio' : 'Nova Rádio'}</h3>
                  <form onSubmit={handleSaveStation} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Nome</label>
                      <input name="name" defaultValue={editingStation?.name} required className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-primary transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">URL Stream</label>
                      <input name="url" defaultValue={editingStation?.url_resolved} required className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-primary transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Gêneros</label>
                      <input name="genre" defaultValue={editingStation?.tags} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-primary transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Logo URL</label>
                      <input name="logo_url" defaultValue={editingStation?.favicon} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-primary transition-all" />
                    </div>
                    <button 
                      disabled={isSavingStation}
                      className="w-full py-5 bg-primary text-white font-black uppercase tracking-widest rounded-2xl hover:scale-[1.02] transition-all disabled:opacity-50"
                    >
                      {isSavingStation ? 'Processando...' : editingStation ? 'Salvar Alterações' : 'Criar Estação'}
                    </button>
                  </form>
                </div>

                <div className="space-y-8">
                  <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                    <h3 className="text-sm font-black uppercase tracking-widest text-white mb-4">Outros Controles</h3>
                    <Link 
                      to="/news" 
                      className="flex items-center justify-between p-4 bg-primary/10 rounded-2xl border border-primary/20 hover:bg-primary/20 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <Newspaper className="size-5 text-primary" />
                        <span className="text-xs font-black uppercase tracking-widest">Gerenciar Notícias</span>
                      </div>
                      <ChevronRight className="size-4 text-primary group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>

                  <h3 className="text-sm font-black uppercase tracking-widest text-gray-500">Cadastradas</h3>
                  <div className="space-y-4">
                    {managedStations.map(s => (
                      <div key={s.stationuuid} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 group">
                        <div className="flex items-center gap-3 min-w-0">
                          <img 
                            src={s.favicon || `https://picsum.photos/seed/${s.name}/100`} 
                            className="size-12 rounded-xl object-cover" 
                            alt="" 
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://picsum.photos/seed/radio/100`;
                            }}
                          />
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate">{s.name}</p>
                            <p className="text-[9px] text-gray-500 uppercase font-bold truncate">{s.tags || 'Sem gênero'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditingStation(s)} className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"><Edit2 className="size-4" /></button>
                          <button onClick={() => handleDeleteStation(s.stationuuid)} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"><Trash2 className="size-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isNavMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNavMenuOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] md:hidden"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 bottom-0 w-[85%] max-w-sm bg-[#0b0e14] z-[70] md:hidden flex flex-col border-l border-white/5"
            >
              <div className="p-6 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="size-8 bg-primary rounded-lg flex items-center justify-center">
                    <Radio className="size-5 text-white" />
                  </div>
                  <span className="font-black uppercase tracking-tighter">Menu</span>
                </div>
                <button 
                  onClick={() => setIsNavMenuOpen(false)}
                  className="p-2 text-gray-400 hover:text-white bg-white/5 rounded-full"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Mobile Search */}
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-gray-500" />
                  <input 
                    type="text" 
                    placeholder="Pesquisar rádios..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-6 outline-none focus:border-primary/50 transition-all text-sm"
                  />
                </div>

                {/* Navigation Links */}
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-4 ml-2">Navegação</p>
                  {[
                    { icon: Radio, label: 'Rádios', active: activeTab === 'explore', onClick: () => setActiveTab('explore') },
                    { icon: Map, label: 'Mapa Interativo', active: activeTab === 'map', onClick: () => setActiveTab('map') },
                    { icon: MessageSquare, label: 'Chat da Galera', active: activeTab === 'chat', onClick: () => setActiveTab('chat') },
                    { to: '/guiche-web', icon: Ticket, label: 'Guichê Web' },
                    { to: '/podcasts', icon: Mic2, label: 'Podcasts' },
                    { to: '/news', icon: Newspaper, label: 'Notícias' },
                    { to: '/suporte', icon: HelpCircle, label: 'Suporte' },
                  ].map((link) => (
                    link.onClick ? (
                      <button
                        key={link.label}
                        onClick={() => { link.onClick!(); setIsNavMenuOpen(false); }}
                        className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all font-bold ${
                          link.active ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <link.icon className="size-5" />
                        {link.label}
                      </button>
                    ) : (
                      <Link
                        key={link.label}
                        to={link.to!}
                        onClick={() => setIsNavMenuOpen(false)}
                        className="flex items-center gap-4 p-4 rounded-2xl transition-all font-bold text-gray-400 hover:bg-white/5 hover:text-white"
                      >
                        <link.icon className="size-5" />
                        {link.label}
                      </Link>
                    )
                  ))}
                </div>

                {/* Quick Filters */}
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-4 ml-2">Filtros Rápidos</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => { setFilter('todas'); setIsNavMenuOpen(false); }}
                      className={`p-4 rounded-2xl border font-bold text-xs uppercase tracking-widest transition-all ${
                        filter === 'todas' ? 'bg-primary/10 border-primary text-primary' : 'bg-white/5 border-white/5 text-gray-500'
                      }`}
                    >
                      Todas
                    </button>
                    <button 
                      onClick={() => { setFilter('favoritas'); setIsNavMenuOpen(false); }}
                      className={`p-4 rounded-2xl border font-bold text-xs uppercase tracking-widest transition-all ${
                        filter === 'favoritas' ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-white/5 border-white/5 text-gray-500'
                      }`}
                    >
                      Favoritas
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-white/5 text-center">
                <p className="text-[9px] font-black text-gray-600 uppercase tracking-[0.3em]">© 2026 RÁDIO GFC</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* Debug Panel */}
      <AnimatePresence>
        {showDebug && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 right-6 z-[400] w-80 bg-black/95 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl p-6 font-mono text-[10px] space-y-4"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-primary font-black uppercase tracking-widest">Debug Console</h3>
              <button onClick={() => setShowDebug(false)} className="text-gray-500 hover:text-white"><X className="size-4" /></button>
            </div>
            
            <div className="space-y-2 text-gray-400">
              <div className="flex justify-between">
                <span>Socket Status:</span>
                <span className={socketStatus === 'connected' ? 'text-green-500' : 'text-red-500'}>{socketStatus.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span>Socket ID:</span>
                <span className="text-white truncate max-w-[120px]">{socket.id || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>Transport:</span>
                <span className="text-white">{(socket as any).io?.engine?.transport?.name || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>Socket URL:</span>
                <span className="text-white truncate max-w-[120px]">{(socket as any).io?.uri || 'N/A'}</span>
              </div>
              {socketError && (
                <div className="flex flex-col gap-1 pt-1">
                  <span className="text-red-400">Socket Error:</span>
                  <span className="text-red-500/80 break-words leading-tight">{socketError}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Audio State:</span>
                <span className={isPlaying ? 'text-green-500' : 'text-amber-500'}>{isPlaying ? 'PLAYING' : 'PAUSED'}</span>
              </div>
              <div className="flex justify-between">
                <span>HLS Supported:</span>
                <span className="text-white">{Hls.isSupported() ? 'YES' : 'NO'}</span>
              </div>
              <div className="flex justify-between">
                <span>Mobile Device:</span>
                <span className="text-white">{/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ? 'YES' : 'NO'}</span>
              </div>
              <div className="flex justify-between">
                <span>Network Type:</span>
                <span className="text-white">{(navigator as any).connection?.effectiveType || 'UNKNOWN'}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 space-y-2">
              <button 
                onClick={() => {
                  console.log("[Debug] Forcing socket reconnect...");
                  socket.disconnect().connect();
                }}
                className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all text-white uppercase font-bold"
              >
                Forçar Reconexão Socket
              </button>
              <button 
                onClick={() => {
                  console.log("[Debug] Forcing audio reload...");
                  if (audioRef.current) {
                    const src = audioRef.current.src;
                    audioRef.current.src = "";
                    setTimeout(() => {
                      audioRef.current!.src = src;
                      audioRef.current!.load();
                      if (isPlaying) audioRef.current!.play();
                    }, 500);
                  }
                }}
                className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all text-white uppercase font-bold"
              >
                Recarregar Áudio
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
