import { Link, useParams } from 'react-router-dom';
import { Chat } from '../components/Chat';
import { 
  Radio, 
  Search, 
  Compass, 
  Heart, 
  Mic2, 
  Bell, 
  Menu, 
  X, 
  Pause, 
  Play, 
  Share2, 
  MoreHorizontal, 
  Music,
  Volume2,
  Maximize2,
  ListMusic,
  FileText,
  ChevronLeft,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { radioService, type RadioStation } from '../services/radioService';

export default function StationDetails() {
  const { id } = useParams();
  const [station, setStation] = useState<RadioStation | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const loadStation = async () => {
      if (!id) return;
      setLoading(true);
      // In a real app, we'd fetch by ID. For now, we search or use top stations.
      const stations = await radioService.getTopBrazilStations();
      const found = stations.find(s => (s.stationuuid || s.name) === id);
      if (found) setStation(found);
      setLoading(false);
    };
    loadStation();
  }, [id]);

  if (loading) return (
    <div className="h-screen w-full bg-[#0b0e14] flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );

  return (
    <div className="bg-[#0b0e14] text-gray-100 font-display min-h-screen flex flex-col overflow-x-hidden">
      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 z-[100] bg-black/60 lg:hidden"
            />
            <motion.aside 
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              className="fixed inset-y-0 left-0 z-[110] w-72 bg-[#080B11] p-8 flex flex-col lg:hidden"
            >
              <div className="flex justify-between items-center mb-10">
                <span className="text-xl font-black text-white">MENU</span>
                <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400 hover:text-white">
                  <X className="size-6" />
                </button>
              </div>
              <nav className="space-y-4">
                <Link to="/" className="flex items-center gap-3 text-gray-400 hover:text-white py-2">
                  <Compass className="size-5" /> Explorar
                </Link>
                <Link to="/" className="flex items-center gap-3 text-gray-400 hover:text-white py-2">
                  <Globe className="size-5" /> Mapa
                </Link>
                <Link to="/podcasts" className="flex items-center gap-3 text-gray-400 hover:text-white py-2">
                  <Mic2 className="size-5" /> Podcasts
                </Link>
                <Link to="/" className="flex items-center gap-3 text-gray-400 hover:text-white py-2">
                  <Heart className="size-5" /> Favoritos
                </Link>
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="sticky top-0 z-50 glass-panel border-b border-white/5">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-900/20">
                <Radio className="size-6" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white uppercase">RÁDIO GFC</span>
            </Link>
            
            <div className="flex-1 max-w-2xl mx-12 hidden lg:block">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 size-5" />
                <input 
                  className="w-full bg-white/5 border-none rounded-full pl-12 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none" 
                  placeholder="Pesquisar estações globais..." 
                  type="text"
                />
              </div>
            </div>

            <div className="flex items-center space-x-4 md:space-x-6">
              <nav className="hidden lg:flex space-x-6">
                <Link to="/" className="text-blue-500 font-medium flex items-center gap-2">
                  <Compass className="size-5" /> Explorar
                </Link>
                <Link to="/podcasts" className="text-gray-400 hover:text-white transition-colors flex items-center gap-2">
                  <Mic2 className="size-5" /> Podcasts
                </Link>
                <Link to="/" className="text-gray-400 hover:text-white transition-colors flex items-center gap-2">
                  <Globe className="size-5" /> Mapa
                </Link>
                <Link to="/" className="text-gray-400 hover:text-white transition-colors flex items-center gap-2">
                  <Heart className="size-5" /> Biblioteca
                </Link>
              </nav>
              <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-gray-400 hover:text-white">
                <Menu className="size-6" />
              </button>
              <div className="h-8 w-[1px] bg-white/10 hidden lg:block"></div>
              <button className="relative hidden sm:block">
                <Bell className="text-gray-400 size-6" />
                <span className="absolute top-0 right-0 w-2 h-2 bg-blue-500 rounded-full"></span>
              </button>
              <Link to="/admin" className="w-9 h-9 rounded-full border border-white/20 overflow-hidden">
                <img 
                  alt="Profile" 
                  className="w-full h-full object-cover" 
                  src="https://picsum.photos/seed/user/100"
                />
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 md:px-6 py-8 flex flex-col gap-8">
        <Link to="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors w-fit">
          <ChevronLeft className="size-5" /> Voltar para Explorar
        </Link>

        <div className="flex flex-col xl:flex-row gap-8">
          {/* Left Column */}
          <div className="flex-1 space-y-8">
            <div className="flex flex-col md:flex-row gap-8 items-start">
              {/* Station Art & Waveform */}
              <div className="relative group w-full md:w-80 lg:w-96 flex-shrink-0">
                <div className="absolute inset-0 bg-blue-600/30 blur-3xl -z-10 rounded-full opacity-50"></div>
                <div className="relative aspect-square rounded-3xl overflow-hidden neon-glow-container group">
                  <img 
                    alt={station?.name} 
                    className="w-full h-full object-cover" 
                    src={station?.favicon || "https://picsum.photos/seed/radio/400"}
                    referrerPolicy="no-referrer"
                    onError={(e) => (e.currentTarget.src = "https://picsum.photos/seed/radio/400")}
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <button 
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center shadow-2xl hover:scale-105 transition-transform"
                    >
                      {isPlaying ? <Pause className="size-10 text-white fill-current" /> : <Play className="size-10 text-white fill-current ml-1" />}
                    </button>
                  </div>
                </div>
                <div className="mt-6 flex items-end justify-between h-12 px-4">
                  <div className="flex gap-[3px] items-end h-full">
                    {[40, 60, 80, 100, 70, 90, 50, 30, 60, 85, 45, 75, 55, 95, 35].map((h, i) => (
                      <div key={i} className="waveform-bar" style={{ height: `${isPlaying ? Math.random() * 60 + 40 : h}%` }}></div>
                    ))}
                  </div>
                  <span className="text-xs text-blue-500 font-mono tracking-widest uppercase">Live Stream • 320kbps</span>
                </div>
              </div>

              {/* Station Info */}
              <div className="flex-1 space-y-6 py-2">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-0.5 bg-red-500/10 text-red-500 text-[10px] font-bold rounded uppercase tracking-wider border border-red-500/20">Live</span>
                    <span className="text-blue-400 text-sm font-medium capitalize">{station?.tags?.split(',')[0] || 'Radio'}</span>
                  </div>
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-2">{station?.name}</h1>
                  <p className="text-lg md:text-xl text-gray-400 flex items-center gap-2">
                    <Music className="text-blue-500 size-6" />
                    A tocar agora: Sucessos Globais
                  </p>
                </div>
                <p className="text-gray-400 leading-relaxed max-w-2xl">
                  {station?.tags?.split(',').join(' • ') || 'Radio'} • O melhor da música internacional. Transmissão com qualidade cristalina.
                </p>
                <div className="flex flex-wrap gap-4 pt-4">
                  <button className="bg-blue-600 hover:bg-blue-500 text-white px-6 md:px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-600/20">
                    <Heart className="size-5" />
                    Adicionar à Biblioteca
                  </button>
                  <button className="glass-panel hover:bg-white/10 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all">
                    <Share2 className="size-5" />
                    Partilhar
                  </button>
                  <button className="glass-panel hover:bg-white/10 text-white px-3 py-3 rounded-xl transition-all">
                    <MoreHorizontal className="size-5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 pt-6 border-t border-white/5">
                  <div>
                    <span className="block text-gray-500 text-xs uppercase tracking-wider mb-1">Ouvintes</span>
                    <span className="text-xl font-bold text-white">{(station?.votes || 42893).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="block text-gray-500 text-xs uppercase tracking-wider mb-1">Localização</span>
                    <span className="text-xl font-bold text-white">{station?.country || 'Global'}</span>
                  </div>
                  <div className="hidden sm:block">
                    <span className="block text-gray-500 text-xs uppercase tracking-wider mb-1">Bitrate</span>
                    <span className="text-xl font-bold text-white">320kbps</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recently Played */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Reproduzido Recentemente</h2>
                <button className="text-sm text-blue-500 font-medium hover:underline">Histórico Completo</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { title: "Blinding Lights", artist: "The Weeknd", time: "14:22", img: "https://picsum.photos/seed/song1/100" },
                  { title: "Shape of You", artist: "Ed Sheeran", time: "14:18", img: "https://picsum.photos/seed/song2/100" },
                  { title: "Levitating", artist: "Dua Lipa", time: "14:14", img: "https://picsum.photos/seed/song3/100" },
                  { title: "Stay", artist: "The Kid LAROI", time: "14:10", img: "https://picsum.photos/seed/song4/100" }
                ].map((song, i) => (
                  <div key={i} className="glass-panel p-3 rounded-2xl flex items-center gap-4 group hover:border-blue-500/50 transition-colors cursor-pointer">
                    <img alt={song.title} className="w-12 h-12 rounded-lg object-cover" src={song.img} />
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-white">{song.title}</h4>
                      <p className="text-xs text-gray-400">{song.artist}</p>
                    </div>
                    <span className="text-xs text-gray-500 font-mono">{song.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column (Chat) */}
          <aside className="w-full xl:w-96 flex-shrink-0">
            <div className="h-[600px] xl:h-[750px]">
              <Chat />
            </div>
          </aside>
        </div>
      </main>

      {/* Player Bar */}
      <div className="fixed bottom-0 inset-x-0 glass-panel p-4 z-[60] border-t border-white/10">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4 md:gap-8">
          <div className="flex items-center space-x-4 w-auto md:w-72">
            <img 
              alt="Now Playing" 
              className="h-12 w-12 md:h-14 md:w-14 rounded-xl object-cover shadow-lg" 
              src={station?.favicon || "https://picsum.photos/seed/radio/100"}
              referrerPolicy="no-referrer"
              onError={(e) => (e.currentTarget.src = "https://picsum.photos/seed/radio/100")}
            />
            <div className="truncate hidden sm:block">
              <h4 className="text-sm font-bold text-white truncate">{station?.name}</h4>
              <p className="text-xs text-gray-400 truncate">Transmissão em Direto</p>
            </div>
            <button className="text-gray-400 hover:text-blue-500 transition-colors">
              <Heart className="size-5" />
            </button>
          </div>

          <div className="flex flex-col items-center flex-1 max-w-xl">
            <div className="flex items-center space-x-4 md:space-x-8 mb-2">
              <button className="hidden sm:block text-gray-500 hover:text-white"><ListMusic className="size-5" /></button>
              <button className="text-white hover:text-blue-500"><ChevronLeft className="size-8" /></button>
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-10 h-10 md:w-12 md:h-12 bg-white text-black rounded-full flex items-center justify-center hover:scale-110 transition-transform"
              >
                {isPlaying ? <Pause className="size-6 fill-current" /> : <Play className="size-6 fill-current ml-1" />}
              </button>
              <button className="text-white hover:text-blue-500"><Globe className="size-8 rotate-180" /></button>
              <button className="hidden sm:block text-gray-500 hover:text-white"><FileText className="size-5" /></button>
            </div>
            <div className="w-full hidden md:flex items-center gap-3">
              <span className="text-[10px] text-gray-500 font-mono">LIVE</span>
              <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden group cursor-pointer">
                <div className="w-full h-full bg-blue-500 relative"></div>
              </div>
              <span className="text-[10px] text-gray-500 font-mono">320KBPS</span>
            </div>
          </div>

          <div className="flex items-center justify-end w-auto md:w-72 space-x-4 md:space-x-6">
            <div className="hidden md:flex items-center space-x-3 group w-32">
              <Volume2 className="text-gray-400 text-lg size-5" />
              <div className="h-1 bg-white/10 rounded-full flex-1 relative cursor-pointer">
                <div className="absolute left-0 top-0 bottom-0 bg-white rounded-full w-2/3"></div>
              </div>
            </div>
            <button className="text-gray-400 hover:text-white"><Maximize2 className="size-5" /></button>
          </div>
        </div>
      </div>
      <div className="h-24"></div>
    </div>
  );
}
